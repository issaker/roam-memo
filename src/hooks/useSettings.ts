/**
 * useSettings Hook
 *
 * Manages plugin settings with dual-mode support:
 * - Roam Depot: Uses extensionAPI.settings for persistence
 * - roam/js: Uses in-memory storage with page-based persistence
 *
 * Settings are synced via custom events ('roamMemoSettingsChanged')
 * to support cross-component updates.
 */
import React from 'react';
import settingsPanelConfig from '~/settingsPanelConfig';

export type Settings = {
  tagsListString: string;
  dataPageTitle: string;
  dailyLimit: number;
  rtlEnabled: boolean;
  shuffleCards: boolean;
  forgotReinsertOffset: number;
  showBreadcrumbs: boolean;
  borderColorEnabled: boolean;
};

export const defaultSettings: Settings = {
  tagsListString: 'memo',
  dataPageTitle: 'roam/memo',
  dailyLimit: 0,
  rtlEnabled: false,
  shuffleCards: false,
  forgotReinsertOffset: 3,
  showBreadcrumbs: false,
  borderColorEnabled: true,
};

const SETTING_TYPES = {
  dailyLimit: 'number',
  rtlEnabled: 'boolean',
  shuffleCards: 'boolean',
  showBreadcrumbs: 'boolean',
  borderColorEnabled: 'boolean',
} as const;

const coerceSettingValue = (key: string, value: any): any => {
  const type = SETTING_TYPES[key];
  if (type === 'number') return Number(value);
  if (type === 'boolean') return value === true || value === 'true';
  return value;
};

const coerceAllSettings = (allSettings: Record<string, any>): Record<string, any> => {
  return Object.keys(allSettings).reduce((acc, key) => {
    acc[key] = coerceSettingValue(key, allSettings[key]);
    return acc;
  }, {});
};

const useSettings = () => {
  const [settings, setSettings] = React.useState(defaultSettings);

  React.useEffect(() => {
    if (!settings.tagsListString.trim()) {
      setSettings((currentSettings) => ({
        ...currentSettings,
        tagsListString: defaultSettings.tagsListString,
      }));
    }
  }, [settings.tagsListString]);

  React.useEffect(() => {
    window.roamMemo.extensionAPI.settings.panel.create(
      settingsPanelConfig({ settings, setSettings })
    );
  }, [setSettings, settings]);

  const syncSettingsFromAPI = React.useCallback(() => {
    const allSettings = window.roamMemo.extensionAPI.settings.getAll() || {};

    if (!('shuffleCards' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('shuffleCards', defaultSettings.shuffleCards);
    }
    if (!('showBreadcrumbs' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('showBreadcrumbs', defaultSettings.showBreadcrumbs);
    }

    const filteredSettings = coerceAllSettings(allSettings);
    setSettings((currentSettings) => ({ ...currentSettings, ...filteredSettings }));
  }, [setSettings]);

  React.useEffect(() => {
    syncSettingsFromAPI();
  }, [syncSettingsFromAPI]);

  React.useEffect(() => {
    const handleSettingsChange = () => {
      syncSettingsFromAPI();
    };

    window.addEventListener('roamMemoSettingsChanged', handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener('roamMemoSettingsChanged', handleSettingsChange as EventListener);
    };
  }, [syncSettingsFromAPI]);

  return settings;
};

export default useSettings;
