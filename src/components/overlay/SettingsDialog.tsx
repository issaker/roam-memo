import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import MigrateLegacyDataPanel from '~/components/MigrateLegacyDataPanel';
import HistoryCleanupSection from '~/components/overlay/HistoryCleanup';
import SettingsForm from '~/components/SettingsForm';
import { colors } from '~/theme';

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: {
    tagsListString: string;
    dataPageTitle: string;
    dailyLimit: number;
    historyCleanupKeepCount: number;
    rtlEnabled: boolean;
    shuffleCards: boolean;
    forgotReinsertOffset: number;
    readReinsertOffset: number;
    showBreadcrumbs: boolean;
    showModeBorders: boolean;
  };
  updateSetting: (key: string, value: any) => void;
  dataPageTitle: string;
}

const SettingsDialog = ({
  isOpen,
  onClose,
  settings,
  updateSetting,
  dataPageTitle,
}: SettingsDialogProps) => {
  const [historyCleanupKeepCount, setHistoryCleanupKeepCount] = React.useState(
    settings.historyCleanupKeepCount
  );

  React.useEffect(() => {
    setHistoryCleanupKeepCount(settings.historyCleanupKeepCount);
  }, [settings.historyCleanupKeepCount]);

  return (
    <Blueprint.Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="Memo Settings"
      style={{ maxWidth: '500px' }}
    >
      <div
        className="bp3-dialog-body"
        style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}
      >
        <SettingsForm
          settings={settings}
          updateSetting={updateSetting}
          dataPageTitle={dataPageTitle}
        />

        <div style={{ marginBottom: '20px', borderTop: '1px solid #394b59', paddingTop: '15px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>Data Migration</span>
          <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 10px 0' }}>
            Migrate card data to the current architecture: convert reviewMode fields to algorithm +
            interaction, and remove redundant reviewMode from session records. Safe to run
            multiple times.
          </p>
          <MigrateLegacyDataPanel dataPageTitle={dataPageTitle} />
        </div>

        <HistoryCleanupSection
          dataPageTitle={dataPageTitle}
          keepCount={historyCleanupKeepCount}
          onKeepCountChange={(nextKeepCount) => {
            setHistoryCleanupKeepCount(nextKeepCount);
            updateSetting('historyCleanupKeepCount', nextKeepCount);
          }}
        />
      </div>
    </Blueprint.Dialog>
  );
};

export default SettingsDialog;
