import * as React from 'react';
import { ReviewModes } from '~/models/session';
import { updateCardType } from '~/queries';
import { getPluginPageData, inferReviewModeFromFields } from '~/queries/data';

const CARD_META_BLOCK_NAME = 'meta';
const getStringBetween = (string, from, to) =>
  string.substring(string.indexOf(from) + from.length, string.lastIndexOf(to));
const parseConfigString = (configString) => configString.split('::').map((s) => s.trim());

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;
const CARD_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const hasMetaReviewMode = (cardChildren: any[] = []): boolean => {
  const metaBlock = cardChildren.find((child) => child?.string === CARD_META_BLOCK_NAME);
  const metaChildren = metaBlock?.children || [];

  for (const block of metaChildren) {
    if (!block?.string) continue;
    const [key] = parseConfigString(block.string);
    if (key === 'reviewMode' || key === 'cardType') return true;
  }

  return false;
};

const hasLegacyCardType = (cardChildren: any[] = []): boolean => {
  const metaBlock = cardChildren.find((child) => child?.string === CARD_META_BLOCK_NAME);
  const metaChildren = metaBlock?.children || [];
  let hasCardType = false;
  let hasReviewMode = false;

  for (const block of metaChildren) {
    if (!block?.string) continue;
    const [key] = parseConfigString(block.string);
    if (key === 'cardType') hasCardType = true;
    if (key === 'reviewMode') hasReviewMode = true;
  }

  return hasCardType && !hasReviewMode;
};

const findSessionReviewModeBlocks = (cardChildren: any[] = []): { uid: string; string: string }[] => {
  const results: { uid: string; string: string }[] = [];

  for (const child of cardChildren) {
    if (!child?.string) continue;
    const headingDateString = getStringBetween(child.string, '[[', ']]');
    if (!headingDateString) continue;

    if (child.children) {
      for (const field of child.children) {
        if (!field?.string) continue;
        const [key] = parseConfigString(field.string);
        if (key === 'reviewMode' && field.uid) {
          results.push({ uid: field.uid, string: field.string });
        }
      }
    }
  }

  return results;
};

interface MigrationTask {
  cardUid: string;
  needsCardTypeRename: boolean;
  needsReviewModeWrite: boolean;
  needsSessionCleanup: boolean;
  cardTypeFieldUid?: string;
  cardTypeFieldValue?: string;
  sessionReviewModeUids: string[];
  resolvedMode: ReviewModes;
  lineByLineReview?: 'Y';
}

const MigrateLegacyDataPanel = ({ dataPageTitle }: { dataPageTitle: string }) => {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, migrated: 0, skipped: 0, phase: '' });

  const runMigration = async () => {
    setStatus('running');
    setProgress({ total: 0, migrated: 0, skipped: 0, phase: 'Scanning...' });

    try {
      const query = `[
        :find (pull ?pluginPageChildren [
          :block/string
          :block/children
          :block/order
          :block/uid
          {:block/children ...}])
        :in $ ?pageTitle ?dataBlockName
        :where
        [?page :node/title ?pageTitle]
        [?page :block/children ?pluginPageChildren]
        [?pluginPageChildren :block/string ?dataBlockName]
      ]`;

      const queryResultsData = await window.roamAlphaAPI.q(query, dataPageTitle, 'data');
      const dataChildren = queryResultsData.map((arr) => arr[0])[0]?.children || [];

      const pluginPageData = await getPluginPageData({ dataPageTitle, limitToLatest: false });
      const cardUids = Object.keys(pluginPageData);
      const total = cardUids.length;

      const tasks: MigrationTask[] = [];
      let skipped = 0;

      for (const cardUid of cardUids) {
        const cardData = pluginPageData[cardUid];
        if (!cardData) {
          skipped++;
          continue;
        }

        const rawCardChildren = dataChildren.find(
          (child) => getStringBetween(child?.string || '', '((', '))') === cardUid
        )?.children || [];

        const needsCardTypeRename = hasLegacyCardType(rawCardChildren);
        const needsReviewModeWrite = !hasMetaReviewMode(rawCardChildren);
        const sessionReviewModeBlocks = findSessionReviewModeBlocks(rawCardChildren);
        const sessionReviewModeUids = sessionReviewModeBlocks.map((b) => b.uid);
        const needsSessionCleanup = sessionReviewModeUids.length > 0;

        if (!needsCardTypeRename && !needsReviewModeWrite && !needsSessionCleanup) {
          skipped++;
          continue;
        }

        const sessions = Array.isArray(cardData) ? cardData : [cardData];
        const latestSession = sessions[sessions.length - 1];

        const resolvedMode = inferReviewModeFromFields(latestSession);
        const isLineByLine = latestSession?.lineByLineReview === 'Y';
        const finalMode = isLineByLine && resolvedMode === ReviewModes.SpacedInterval
          ? ReviewModes.SpacedIntervalLBL
          : resolvedMode;

        let cardTypeFieldUid: string | undefined;
        let cardTypeFieldValue: string | undefined;
        if (needsCardTypeRename) {
          const metaBlock = rawCardChildren.find((child) => child?.string === CARD_META_BLOCK_NAME);
          if (metaBlock?.children) {
            for (const field of metaBlock.children) {
              if (!field?.string) continue;
              const [key, value] = parseConfigString(field.string);
              if (key === 'cardType' && field.uid) {
                cardTypeFieldUid = field.uid;
                cardTypeFieldValue = value;
                break;
              }
            }
          }
        }

        tasks.push({
          cardUid,
          needsCardTypeRename,
          needsReviewModeWrite,
          needsSessionCleanup,
          cardTypeFieldUid,
          cardTypeFieldValue,
          sessionReviewModeUids,
          resolvedMode: finalMode,
          lineByLineReview: isLineByLine ? 'Y' : undefined,
        });
      }

      setProgress({ total, migrated: 0, skipped, phase: `Phase 1: Writing reviewMode to meta (${tasks.length} cards)` });

      let migrated = 0;
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        if (task.needsCardTypeRename || task.needsReviewModeWrite) {
          await updateCardType({
            refUid: task.cardUid,
            dataPageTitle,
            reviewMode: task.resolvedMode,
            lineByLineReview: task.lineByLineReview,
          });

          if (task.needsCardTypeRename && task.cardTypeFieldUid && task.cardTypeFieldValue) {
            await window.roamAlphaAPI.updateBlock({
              block: { uid: task.cardTypeFieldUid, string: `reviewMode:: ${task.cardTypeFieldValue}` },
            });
          }
        }

        migrated++;
        setProgress({ total, migrated, skipped, phase: `Phase 1: Writing reviewMode (${migrated}/${tasks.length})` });

        if ((i + 1) % BATCH_SIZE === 0) {
          await sleep(BATCH_DELAY_MS);
        } else {
          await sleep(CARD_DELAY_MS);
        }
      }

      const allSessionUids: string[] = tasks.flatMap((t) => t.sessionReviewModeUids);
      if (allSessionUids.length > 0) {
        setProgress({ total, migrated, skipped, phase: `Phase 2: Cleaning session records (${allSessionUids.length} blocks)` });

        let deleted = 0;
        for (let i = 0; i < allSessionUids.length; i++) {
          await window.roamAlphaAPI.deleteBlock({
            block: { uid: allSessionUids[i] },
          });

          deleted++;
          if (deleted % BATCH_SIZE === 0) {
            setProgress({ total, migrated, skipped, phase: `Phase 2: Cleaning session records (${deleted}/${allSessionUids.length})` });
            await sleep(BATCH_DELAY_MS);
          }
        }
      }

      setProgress({ total, migrated, skipped, phase: 'Done' });
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
          <div>{progress.phase}</div>
          <div>
            {progress.migrated + progress.skipped}/{progress.total} cards
            ({progress.migrated} migrated, {progress.skipped} skipped)
          </div>
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
