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
      showBreadcrumbs: settings.showBreadcrumbs.toString(),
      showModeBorders: settings.showModeBorders.toString(),
    };

    for (const [key, value] of Object.entries(settingsToSave)) {
      try {
        // Delete existing block if it exists
        const existingBlockUid = await getChildBlock(settingsBlockUid, `${key}::`, {
          exactMatch: false,
        });
        
        if (existingBlockUid) {
          await window.roamAlphaAPI.deleteBlock({ block: { uid: existingBlockUid } });
        }

        // Create new block with updated value
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
    // Get the page UID
    const pageUid = await getOrCreatePage(dataPageTitle);
    
    if (!pageUid) {
      return null;
    }

    // Use getChildBlock to find the settings block
    const settingsBlockUid = await getChildBlock(pageUid, SETTINGS_BLOCK_NAME, {
      exactMatch: true,
    });

    if (!settingsBlockUid) {
      return null;
    }

    // Query for all child blocks of the settings block
    // Use a simple query that doesn't pass UIDs as parameters in lookup ref position
    const childrenQuery = `
      [:find ?child-uid ?child-string
       :where
       [?parent :block/uid "${settingsBlockUid}"]
       [?child :block/parents ?parent]
       [?child :block/uid ?child-uid]
       [?child :block/string ?child-string]
      ]
    `;
    
    const results = window.roamAlphaAPI.q(childrenQuery);
    
    if (!results || results.length === 0) {
      return null;
    }

    const loadedSettings: Partial<Settings> = {};
    
    // Parse each setting
    for (const [blockUid, blockString] of results) {
      try {
        if (blockString && blockString.includes('::')) {
          const [keyPart, ...valueParts] = blockString.split('::');
          const key = keyPart.trim();
          const value = valueParts.join('::').trim();
          
          // Convert values to appropriate types
          switch (key) {
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
            case 'showBreadcrumbs':
              loadedSettings.showBreadcrumbs = value === 'true';
              break;
            case 'showModeBorders':
              loadedSettings.showModeBorders = value === 'true';
              break;
          }
        }
      } catch (err) {
        console.error('Memo: Error parsing setting from block', blockUid, blockString, err);
      }
    }

    
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
