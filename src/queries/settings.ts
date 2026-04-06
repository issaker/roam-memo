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
    // Check if the page exists
    const queryResults = await window.roamAlphaAPI.q(
      `[:find ?uid :in $ ?title :where [?page :node/title ?title] [?page :block/uid ?uid]]`,
      dataPageTitle
    );

    if (!queryResults || queryResults.length === 0) {
      console.log('Memo: Settings page not found, using defaults');
      return null;
    }

    // Get the settings block
    const settingsBlockUid = await getChildBlock(queryResults[0][0], SETTINGS_BLOCK_NAME, {
      exactMatch: true,
    });

    if (!settingsBlockUid) {
      console.log('Memo: Settings block not found, using defaults');
      return null;
    }

    // Query for all settings child blocks
    const settingsQuery = `[:find (pull ?b [:block/string]) :in $ ?parent :where [?b :block/parents ?parent]]`;
    const results = await window.roamAlphaAPI.q(settingsQuery, settingsBlockUid);

    if (!results || results.length === 0) {
      console.log('Memo: No settings found, using defaults');
      return null;
    }

    // Parse settings from blocks
    const loadedSettings: Partial<Settings> = {};
    
    results.forEach((result: any) => {
      const blockString = result[0]?.string;
      if (blockString && blockString.includes('::')) {
        const [key, ...valueParts] = blockString.split('::');
        const value = valueParts.join('::').trim();
        const trimmedKey = key.trim();

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
