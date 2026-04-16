/**
 * Data Migration Panel
 *
 * Migrates legacy data structures to the unified session-block architecture:
 *
 * Phase 1: cardType → reviewMode rename in meta blocks
 * Phase 2: Merge meta block fields (reviewMode, nextDueDate, lineByLineProgress)
 *          into the latest session block, then delete the meta block
 * Phase 3: Convert lineByLineReview:: Y → LBL reviewMode
 * Phase 4: Clean up redundant session-level reviewMode blocks
 */
import * as React from 'react';
import { ReviewModes, isSM2LBLMode } from '~/models/session';
import { updateCardType } from '~/queries';
import { getPluginPageData, inferReviewModeFromFields } from '~/queries/data';

const CARD_META_BLOCK_NAME = 'meta';
const getStringBetween = (string, from, to) =>
  string.substring(string.indexOf(from) + from.length, string.lastIndexOf(to));
const parseConfigString = (configString: string): [string, string] => {
  const parts = configString.split('::');
  const key = parts[0].trim();
  const value = parts.slice(1).join('::').trim();
  return [key, value];
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;
const CARD_DELAY_MS = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const findMetaBlock = (cardChildren: any[] = []) =>
  cardChildren.find((child) => child?.string === CARD_META_BLOCK_NAME);

const hasMetaBlock = (cardChildren: any[] = []): boolean => !!findMetaBlock(cardChildren);

const hasMetaReviewMode = (cardChildren: any[] = []): boolean => {
  const metaBlock = findMetaBlock(cardChildren);
  const metaChildren = metaBlock?.children || [];

  for (const block of metaChildren) {
    if (!block?.string) continue;
    const [key] = parseConfigString(block.string);
    if (key === 'reviewMode' || key === 'cardType') return true;
  }

  return false;
};

const hasLegacyCardType = (cardChildren: any[] = []): boolean => {
  const metaBlock = findMetaBlock(cardChildren);
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

const hasDuplicateReviewMode = (cardChildren: any[] = []): boolean => {
  const metaBlock = findMetaBlock(cardChildren);
  const metaChildren = metaBlock?.children || [];
  let reviewModeCount = 0;
  let hasCardType = false;

  for (const block of metaChildren) {
    if (!block?.string) continue;
    const [key] = parseConfigString(block.string);
    if (key === 'reviewMode') reviewModeCount++;
    if (key === 'cardType') hasCardType = true;
  }

  return reviewModeCount > 1 || (reviewModeCount >= 1 && hasCardType);
};

const findMetaCardTypeBlock = (cardChildren: any[] = []): { uid: string; value: string } | null => {
  const metaBlock = findMetaBlock(cardChildren);
  const metaChildren = metaBlock?.children || [];

  for (const block of metaChildren) {
    if (!block?.string) continue;
    const [key, value] = parseConfigString(block.string);
    if (key === 'cardType' && block.uid) {
      return { uid: block.uid, value };
    }
  }

  return null;
};

const findDuplicateMetaBlocks = (cardChildren: any[] = []): { uid: string; key: string }[] => {
  const metaBlock = findMetaBlock(cardChildren);
  const metaChildren = metaBlock?.children || [];
  const keyCount: Record<string, number> = {};
  const duplicates: { uid: string; key: string }[] = [];

  for (const block of metaChildren) {
    if (!block?.string || !block.uid) continue;
    const [key] = parseConfigString(block.string);
    keyCount[key] = (keyCount[key] || 0) + 1;
    if (keyCount[key] > 1) {
      duplicates.push({ uid: block.uid, key });
    }
  }

  for (const block of metaChildren) {
    if (!block?.string || !block.uid) continue;
    const [key] = parseConfigString(block.string);
    if (key === 'cardType' && keyCount['reviewMode'] >= 1) {
      duplicates.push({ uid: block.uid, key });
    }
  }

  return duplicates;
};

const findSessionReviewModeBlocks = (cardChildren: any[] = []): { uid: string }[] => {
  const results: { uid: string }[] = [];

  for (const child of cardChildren) {
    if (!child?.string) continue;
    const headingDateString = getStringBetween(child.string, '[[', ']]');
    if (!headingDateString) continue;

    if (child.children) {
      for (const field of child.children) {
        if (!field?.string) continue;
        const [key] = parseConfigString(field.string);
        if (key === 'reviewMode' && field.uid) {
          results.push({ uid: field.uid });
        }
      }
    }
  }

  return results;
};

const extractMetaFields = (
  cardChildren: any[] = []
): Record<string, { uid: string; value: string }> => {
  const metaBlock = findMetaBlock(cardChildren);
  const metaChildren = metaBlock?.children || [];
  const fields: Record<string, { uid: string; value: string }> = {};

  for (const block of metaChildren) {
    if (!block?.string || !block.uid) continue;
    const [key, value] = parseConfigString(block.string);
    if (key && value !== undefined) {
      fields[key] = { uid: block.uid, value };
    }
  }

  return fields;
};

const findLatestSessionBlock = (
  cardChildren: any[] = []
): { uid: string; children: any[] } | null => {
  const sessionBlocks = cardChildren.filter((child) => {
    if (!child?.string) return false;
    const dateStr = getStringBetween(child.string, '[[', ']]');
    return !!dateStr;
  });

  if (!sessionBlocks.length) return null;

  const sorted = [...sessionBlocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return sorted[0];
};

interface MigrationTask {
  cardUid: string;
  needsCardTypeRename: boolean;
  cardTypeBlockUid?: string;
  cardTypeBlockValue?: string;
  needsReviewModeWrite: boolean;
  needsDuplicateCleanup: boolean;
  duplicateBlockUids: string[];
  sessionReviewModeUids: string[];
  resolvedMode: ReviewModes;
  needsMetaMerge: boolean;
  metaBlockUid?: string;
  metaFields: Record<string, { uid: string; value: string }>;
  latestSessionBlockUid?: string;
}

const MigrateLegacyDataPanel = ({ dataPageTitle }: { dataPageTitle: string }) => {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, migrated: 0, skipped: 0, phase: '' });
  const [errorDetail, setErrorDetail] = React.useState('');

  const runMigration = async () => {
    setStatus('running');
    setProgress({ total: 0, migrated: 0, skipped: 0, phase: 'Scanning...' });
    setErrorDetail('');

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

        const rawCardChildren =
          dataChildren.find(
            (child) => getStringBetween(child?.string || '', '((', '))') === cardUid
          )?.children || [];

        const needsCardTypeRename = hasLegacyCardType(rawCardChildren);
        const needsReviewModeWrite = !hasMetaReviewMode(rawCardChildren);
        const needsDuplicateCleanup = hasDuplicateReviewMode(rawCardChildren);
        const duplicateBlockUids = needsDuplicateCleanup
          ? findDuplicateMetaBlocks(rawCardChildren).map((b) => b.uid)
          : [];
        const sessionReviewModeUids = findSessionReviewModeBlocks(rawCardChildren).map(
          (b) => b.uid
        );

        const needsMetaMerge = hasMetaBlock(rawCardChildren);
        const metaFields = needsMetaMerge ? extractMetaFields(rawCardChildren) : {};
        const metaBlock = findMetaBlock(rawCardChildren);
        const latestSessionBlock = findLatestSessionBlock(rawCardChildren);

        const hasWork =
          needsCardTypeRename ||
          needsReviewModeWrite ||
          needsDuplicateCleanup ||
          sessionReviewModeUids.length > 0 ||
          needsMetaMerge;

        if (!hasWork) {
          skipped++;
          continue;
        }

        const sessions = Array.isArray(cardData) ? cardData : [cardData];
        const latestSession = sessions[sessions.length - 1];

        const resolvedMode = inferReviewModeFromFields(latestSession);
        const isLineByLine =
          (latestSession as any)?.lineByLineReview === 'Y' || isSM2LBLMode(resolvedMode);
        const finalMode =
          isLineByLine && resolvedMode === ReviewModes.SpacedInterval
            ? ReviewModes.SpacedIntervalLBL
            : isLineByLine && resolvedMode === ReviewModes.FixedProgressive
            ? ReviewModes.FixedProgressiveLBL
            : resolvedMode;

        let cardTypeBlockUid: string | undefined;
        let cardTypeBlockValue: string | undefined;
        if (needsCardTypeRename) {
          const cardTypeBlock = findMetaCardTypeBlock(rawCardChildren);
          if (cardTypeBlock) {
            cardTypeBlockUid = cardTypeBlock.uid;
            cardTypeBlockValue = cardTypeBlock.value;
          }
        }

        tasks.push({
          cardUid,
          needsCardTypeRename,
          cardTypeBlockUid,
          cardTypeBlockValue,
          needsReviewModeWrite,
          needsDuplicateCleanup,
          duplicateBlockUids,
          sessionReviewModeUids,
          resolvedMode: finalMode,
          needsMetaMerge,
          metaBlockUid: metaBlock?.uid,
          metaFields,
          latestSessionBlockUid: latestSessionBlock?.uid,
        });
      }

      setProgress({
        total,
        migrated: 0,
        skipped,
        phase: 'Phase 1: Renaming cardType → reviewMode',
      });

      let migrated = 0;
      let errors = 0;

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];

        try {
          if (task.needsCardTypeRename && task.cardTypeBlockUid && task.cardTypeBlockValue) {
            await window.roamAlphaAPI.updateBlock({
              block: {
                uid: task.cardTypeBlockUid,
                string: `reviewMode:: ${task.cardTypeBlockValue}`,
              },
            });
          }

          if (task.needsReviewModeWrite || task.needsCardTypeRename) {
            await updateCardType({
              refUid: task.cardUid,
              dataPageTitle,
              reviewMode: task.resolvedMode,
            });
          }

          if (task.needsDuplicateCleanup && task.duplicateBlockUids.length > 0) {
            for (const uid of task.duplicateBlockUids) {
              await window.roamAlphaAPI.deleteBlock({ block: { uid } });
            }
          }

          if (task.needsMetaMerge && task.latestSessionBlockUid) {
            const { reviewMode, nextDueDate, lineByLineProgress } = task.metaFields;

            if (reviewMode && task.latestSessionBlockUid) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': task.latestSessionBlockUid, order: -1 },
                block: { string: `reviewMode:: ${reviewMode.value}`, open: false },
              });
            }

            if (nextDueDate && task.latestSessionBlockUid) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': task.latestSessionBlockUid, order: -1 },
                block: { string: `nextDueDate:: ${nextDueDate.value}`, open: false },
              });
            }

            if (lineByLineProgress && task.latestSessionBlockUid) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': task.latestSessionBlockUid, order: -1 },
                block: { string: `lineByLineProgress:: ${lineByLineProgress.value}`, open: false },
              });
            }

            if (task.metaBlockUid) {
              await window.roamAlphaAPI.deleteBlock({ block: { uid: task.metaBlockUid } });
            }
          }

          migrated++;
        } catch (err) {
          console.error(`[Memo] Migration error on card ${task.cardUid}:`, err);
          errors++;
        }

        setProgress({
          total,
          migrated,
          skipped,
          phase: `Phase 1: Writing reviewMode (${migrated + errors}/${tasks.length})`,
        });

        if ((i + 1) % BATCH_SIZE === 0) {
          await sleep(BATCH_DELAY_MS);
        } else {
          await sleep(CARD_DELAY_MS);
        }
      }

      const allSessionUids: string[] = tasks.flatMap((t) => t.sessionReviewModeUids);
      if (allSessionUids.length > 0) {
        setProgress({
          total,
          migrated,
          skipped,
          phase: `Phase 2: Cleaning session records (${allSessionUids.length} blocks)`,
        });

        let deleted = 0;
        for (let i = 0; i < allSessionUids.length; i++) {
          try {
            await window.roamAlphaAPI.deleteBlock({ block: { uid: allSessionUids[i] } });
            deleted++;
          } catch (err) {
            console.error(`[Memo] Session cleanup error:`, err);
          }

          if (deleted % BATCH_SIZE === 0) {
            setProgress({
              total,
              migrated,
              skipped,
              phase: `Phase 2: Cleaning session records (${deleted}/${allSessionUids.length})`,
            });
            await sleep(BATCH_DELAY_MS);
          }
        }
      }

      setProgress({ total, migrated, skipped, phase: 'Done' });
      if (errors > 0) {
        setErrorDetail(`${errors} cards had errors — check console for details.`);
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
          <div>{progress.phase}</div>
          <div>
            {progress.migrated + progress.skipped}/{progress.total} cards ({progress.migrated}{' '}
            migrated, {progress.skipped} skipped)
          </div>
        </div>
      )}
      {status === 'done' && (
        <div>
          <div style={{ fontSize: '12px', color: '#0d8050' }}>
            Migration complete! {progress.migrated} cards migrated, {progress.skipped} already
            up-to-date.
          </div>
          {errorDetail && (
            <div style={{ fontSize: '12px', color: '#d29922', marginTop: '4px' }}>
              {errorDetail}
            </div>
          )}
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
