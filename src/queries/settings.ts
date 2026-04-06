import { getOrCreatePage, getOrCreateBlockOnPage, getChildBlock } from '~/queries/utils';
import { defaultSettings, Settings } from '~/hooks/useSettings';

const SETTINGS_BLOCK_NAME = 'settings';

/**
 * Save settings to the roam/memo page
 */
export const saveSettingsToPage = async (dataPageTitle: string, settings: Settings) => {
  try {
    // Ensure the data page exists
    await getOrCreatePage(dataPageTitle);
    
    // Get or create the settings block
    const settingsBlockUid = await getOrCreateBlockOnPage(dataPageTitle, SETTINGS_BLOCK_NAME, -1, {
      open: false,
      heading: 3,
    });

    // Save each setting as a child block
    const settingsToSave = {
      tagsListString: settings.tagsListString,
      dataPageTitle: settings.dataPageTitle,
      dailyLimit: settings.dailyLimit.toString(),
      rtlEnabled: settings.rtlEnabled.toString(),
      shuffleCards: settings.shuffleCards.toString(),
      forgotReinsertOffset: settings.forgotReinsertOffset.toString(),
    };

    for (const [key, value] of Object.entries(settingsToSave)) {
      try {
        // Delete existing block if it exists
        const existingBlockUid = await getChildBlock(settingsBlockUid, `${key}::`, {
          exactMatch: false,
        });
        
        if (existingBlockUid) {
          console.log('Memo: Deleting existing setting', key, existingBlockUid);
          await window.roamAlphaAPI.deleteBlock({ block: { uid: existingBlockUid } });
        }

        // Create new block with updated value
        console.log('Memo: Creating setting', key, value);
        await window.roamAlphaAPI.createBlock({
          location: { 'parent-uid': settingsBlockUid, order: -1 },
          block: {
            string: `${key}:: ${value}`,
            open: false,
          },
        });
      } catch (err) {
        console.error(`Memo: Failed to save setting ${key}`, err);
        throw err; // Re-throw to be caught by outer try-catch
      }
    }

    console.log('Memo: Settings saved to page', dataPageTitle);
    return true;
  } catch (error) {
    console.error('Memo: Failed to save settings', error);
    return false;
  }
};

/**
 * Load settings from the roam/memo page
 */
export const loadSettingsFromPage = async (dataPageTitle: string): Promise<Settings | null> => {
  try {
    // Use getOrCreatePage to get the page UID properly
    const pageUid = await getOrCreatePage(dataPageTitle);
    
    if (!pageUid) {
      console.log('Memo: Settings page not found, using defaults');
      return null;
    }

    console.log('Memo: Found page with UID', pageUid);

    // Get the settings block using proper block query
    const settingsBlockQuery = `
      [:find ?block_uid
       :in $ ?page_uid ?block_string
       :where
       [?page :block/uid ?page_uid]
       [?block :block/parents ?page]
       [?block :block/string ?block_string]
       [?block :block/uid ?block_uid]
      ]
    `;
    
    const settingsBlockResults = await window.roamAlphaAPI.q(
      settingsBlockQuery,
      pageUid,
      SETTINGS_BLOCK_NAME
    );

    if (!settingsBlockResults || settingsBlockResults.length === 0) {
      console.log('Memo: Settings block not found, using defaults');
      return null;
    }

    const settingsBlockUid = settingsBlockResults[0][0];
    console.log('Memo: Found settings block with UID', settingsBlockUid);

    // Query for all settings child blocks
    const settingsQuery = `
      [:find (pull ?b [:block/string])
       :in $ ?pu
       :where
       [?b :block/parents [:block/uid ?pu]]
      ]
    `;
    const results = await window.roamAlphaAPI.q(settingsQuery, settingsBlockUid);

    if (!results || results.length === 0) {
      console.log('Memo: No settings found, using defaults');
      return null;
    }

    console.log('Memo: Found', results.length, 'settings blocks');

    // Parse settings from blocks
    const loadedSettings: Partial<Settings> = {};
    
    results.forEach((result: any) => {
      try {
        const blockString = result[0]?.string;
        if (blockString && blockString.includes('::')) {
          const [key, ...valueParts] = blockString.split('::');
          const value = valueParts.join('::').trim();
          const trimmedKey = key.trim();

          console.log('Memo: Loading setting', trimmedKey, '=', value);

          // Convert values to appropriate types
          switch (trimmedKey) {
            case 'tagsListString':
              loadedSettings.tagsListString = value;
              break;
            case 'dataPageTitle':
              loadedSettings.dataPageTitle = value;
              break;
            case 'dailyLimit':
              loadedSettings.dailyLimit = Number(value) || 0;
              break;
            case 'rtlEnabled':
              loadedSettings.rtlEnabled = value === 'true';
              break;
            case 'shuffleCards':
              loadedSettings.shuffleCards = value === 'true';
              break;
            case 'forgotReinsertOffset':
              loadedSettings.forgotReinsertOffset = Number(value) || 3;
              break;
          }
        }
      } catch (err) {
        console.error('Memo: Error parsing setting block', result, err);
      }
    });

    console.log('Memo: Settings loaded from page', dataPageTitle, loadedSettings);
    
    // Merge with defaults to ensure all fields are present
    return {
      ...defaultSettings,
      ...loadedSettings,
    };
  } catch (error) {
    console.error('Memo: Failed to load settings', error);
    return null;
  }
};
