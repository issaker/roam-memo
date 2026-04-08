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
};

export const defaultSettings: Settings = {
  tagsListString: 'memo',
  dataPageTitle: 'roam/memo',
  dailyLimit: 0,
  rtlEnabled: false,
  shuffleCards: false,
  forgotReinsertOffset: 3,
  showBreadcrumbs: false,
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
  }, [settings]);

  React.useEffect(() => {
    window.roamMemo.extensionAPI.settings.panel.create(
      settingsPanelConfig({ settings, setSettings })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setSettings, settings.dataPageTitle]);

  React.useEffect(() => {
    const allSettings = window.roamMemo.extensionAPI.settings.getAll() || {};
    if (!('shuffleCards' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('shuffleCards', defaultSettings.shuffleCards);
    }
    if (!('showBreadcrumbs' in allSettings)) {
      window.roamMemo.extensionAPI.settings.set('showBreadcrumbs', defaultSettings.showBreadcrumbs);
    }

    const numbers = ['dailyLimit'];
    const booleans = ['rtlEnabled', 'shuffleCards', 'showBreadcrumbs'];

    const filteredSettings = Object.keys(allSettings).reduce((acc, key) => {
      const value = allSettings[key];
      if (numbers.includes(key)) {
        acc[key] = Number(value);
      } else if (booleans.includes(key)) {
        acc[key] = value === true || value === 'true';
      } else {
        acc[key] = value;
      }
      return acc;
    }, {});

    setSettings((currentSettings) => ({ ...currentSettings, ...filteredSettings }));
  }, [setSettings]);

  React.useEffect(() => {
    const handleSettingsChange = (event: CustomEvent) => {
      const allSettings = window.roamMemo.extensionAPI.settings.getAll() || {};
      const numbers = ['dailyLimit'];
      const booleans = ['rtlEnabled', 'shuffleCards', 'showBreadcrumbs'];

      const filteredSettings = Object.keys(allSettings).reduce((acc, key) => {
        const value = allSettings[key];
        if (numbers.includes(key)) {
          acc[key] = Number(value);
        } else if (booleans.includes(key)) {
          acc[key] = value === true || value === 'true';
        } else {
          acc[key] = value;
        }
        return acc;
      }, {});

      setSettings((currentSettings) => ({ ...currentSettings, ...filteredSettings }));
    };

    window.addEventListener('roamMemoSettingsChanged', handleSettingsChange as EventListener);

    return () => {
      window.removeEventListener('roamMemoSettingsChanged', handleSettingsChange as EventListener);
    };
  }, [setSettings]);

  return settings;
};

export default useSettings;
