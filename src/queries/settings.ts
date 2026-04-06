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
    // Get the page UID
    const pageUid = await getOrCreatePage(dataPageTitle);
    
    if (!pageUid) {
      console.log('Memo: Settings page not found, using defaults');
      return null;
    }

    console.log('Memo: Found page with UID', pageUid);

    // Use getChildBlock to find the settings block
    const settingsBlockUid = await getChildBlock(pageUid, SETTINGS_BLOCK_NAME, {
      exactMatch: true,
    });

    if (!settingsBlockUid) {
      console.log('Memo: Settings block not found, using defaults');
      return null;
    }

    console.log('Memo: Found settings block with UID', settingsBlockUid);

    // Use getChildBlock with startsWith query to find all setting child blocks
    // We need to query each setting key individually
    const settingKeys = [
      'tagsListString',
      'dataPageTitle', 
      'dailyLimit',
      'rtlEnabled',
      'shuffleCards',
      'forgotReinsertOffset',
    ];

    const loadedSettings: Partial<Settings> = {};
    
    for (const key of settingKeys) {
      try {
        const blockUid = await getChildBlock(settingsBlockUid, `${key}::`, {
          exactMatch: false,
        });
        
        if (blockUid) {
          // Get the block string using roamAlphaAPI.pull with correct syntax
          const blockData = window.roamAlphaAPI.pull(
            '[:block/string]',
            [':block/uid', blockUid]
          );
          
          const blockString = blockData?.[':block/string'];
          if (blockString && blockString.includes('::')) {
            const [keyPart, ...valueParts] = blockString.split('::');
            const value = valueParts.join('::').trim();
            
            console.log('Memo: Loading setting', key, '=', value);
            
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
            }
          }
        }
      } catch (err) {
        console.error('Memo: Error loading setting', key, err);
      }
    }

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
