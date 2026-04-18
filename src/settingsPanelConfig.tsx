import * as React from 'react';
import * as asyncUtils from '~/utils/async';
import MigrateLegacyDataPanel from '~/components/MigrateLegacyDataPanel';
import SettingsForm, { SettingsFormHandle, SettingsFormSettings } from '~/components/SettingsForm';
import { defaultSettings } from './hooks/useSettings';

const settingsPanelConfig = ({ settings, setSettings }) => {
  const formRef = React.createRef<SettingsFormHandle>();

  const syncFn = async ({ key, value }: { key: string; value: any }) => {
    window.roamMemo.extensionAPI.settings.set(key, value);
    setSettings((currentSettings) => {
      return { ...currentSettings, [key]: value };
    });
  };

  const processChange = asyncUtils.debounce((e) => syncFn(e));

  const updateSetting = (key: string, value: any) => {
    processChange({ key, value });
  };

  const handleApply = () => {
    const formSettings = formRef.current?.getSettings();
    if (formSettings) {
      (Object.keys(formSettings) as (keyof SettingsFormSettings)[]).forEach((key) => {
        updateSetting(key, formSettings[key]);
      });
    }
  };

  return {
    tabTitle: 'Memo',
    settings: [
      {
        id: 'settings-form',
        name: 'Settings',
        action: {
          type: 'reactComponent',
          component: () => (
            <div>
              <SettingsForm
                ref={formRef}
                settings={settings}
                dataPageTitle={settings.dataPageTitle}
              />
              <div style={{ marginTop: '15px', borderTop: '1px solid #394b59', paddingTop: '10px', textAlign: 'right' }}>
                <button
                  className="bp3-button bp3-intent-primary"
                  onClick={handleApply}
                >
                  Apply
                </button>
              </div>
            </div>
          ),
        },
      },
      {
        id: 'historyCleanupKeepCount',
        name: 'History Cleanup Keep Count',
        description:
          'When running "Clean Up History Data", keep only the N most recent session blocks per card.',
        action: {
          type: 'input',
          placeholder: defaultSettings.historyCleanupKeepCount,
          onChange: (e) => {
            const value = e.target.value.trim();
            const isNumber = !isNaN(Number(value));
            processChange({
              key: 'historyCleanupKeepCount',
              value: isNumber ? Math.max(0, Number(value)) : 3,
            });
          },
        },
      },
      {
        id: 'migrate-legacy-data',
        name: 'Data Migration',
        description:
          'Migrate card data to the current architecture: convert reviewMode fields to algorithm + interaction, and remove redundant reviewMode from session records. Safe to run multiple times.',
        action: {
          type: 'reactComponent',
          component: () => <MigrateLegacyDataPanel dataPageTitle={settings.dataPageTitle} />,
        },
      },
    ],
  };
};

export default settingsPanelConfig;
