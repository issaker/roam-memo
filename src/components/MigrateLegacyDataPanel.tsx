import * as React from 'react';
import { ReviewModes, resolveReviewMode } from '~/models/session';
import { getPluginPageData, updateCardType } from '~/queries';

const MigrateLegacyDataPanel = ({ dataPageTitle }: { dataPageTitle: string }) => {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, migrated: 0, skipped: 0 });

  const runMigration = async () => {
    setStatus('running');
    setProgress({ total: 0, migrated: 0, skipped: 0 });

    try {
      const pluginPageData = await getPluginPageData({ dataPageTitle, limitToLatest: true });
      const cardUids = Object.keys(pluginPageData);
      const total = cardUids.length;
      let migrated = 0;
      let skipped = 0;

      for (const cardUid of cardUids) {
        const cardData = pluginPageData[cardUid];
        if (!cardData) {
          skipped++;
          setProgress({ total, migrated, skipped });
          continue;
        }

        const latestSession = Array.isArray(cardData)
          ? cardData[cardData.length - 1]
          : cardData;

        if ((latestSession as any)?.reviewMode && (latestSession as any).reviewMode in ReviewModes) {
          skipped++;
          setProgress({ total, migrated, skipped });
          continue;
        }

        const rawMode = latestSession?.reviewMode;
        const resolvedMode = resolveReviewMode(rawMode);
        const isLineByLine = latestSession?.lineByLineReview === 'Y';

        const finalMode = isLineByLine && resolvedMode === ReviewModes.SpacedInterval
          ? ReviewModes.SpacedIntervalLBL
          : resolvedMode;

        await updateCardType({
          refUid: cardUid,
          dataPageTitle,
          reviewMode: finalMode,
          lineByLineReview: isLineByLine ? 'Y' : undefined,
        });

        migrated++;
        setProgress({ total, migrated, skipped });
      }

      setStatus('done');
    } catch (error) {
      console.error('[Memo] Migration error:', error);
      setStatus('error');
    }
  };

  return (
    <div style={{ marginTop: '8px' }}>
      {status === 'idle' && (
        <button
          className="bp3-button bp3-intent-primary"
          onClick={runMigration}
          style={{ fontSize: '12px' }}
        >
          Migrate Legacy Data
        </button>
      )}
      {status === 'running' && (
        <div style={{ fontSize: '12px', color: '#888' }}>
          Migrating... {progress.migrated + progress.skipped}/{progress.total} cards processed
          ({progress.migrated} migrated, {progress.skipped} skipped)
        </div>
      )}
      {status === 'done' && (
        <div style={{ fontSize: '12px', color: '#0d8050' }}>
          Migration complete! {progress.migrated} cards migrated, {progress.skipped} already
          up-to-date.
        </div>
      )}
      {status === 'error' && (
        <div style={{ fontSize: '12px', color: '#c23030' }}>
          Migration failed. Check the console for details.
        </div>
      )}
    </div>
  );
};

export default MigrateLegacyDataPanel;
