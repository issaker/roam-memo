import * as React from 'react';
import { ReviewModes } from '~/models/session';
import { updateCardType } from '~/queries';
import { getPluginPageData, inferReviewModeFromFields } from '~/queries/data';

const CARD_META_BLOCK_NAME = 'meta';
const getStringBetween = (string, from, to) =>
  string.substring(string.indexOf(from) + from.length, string.lastIndexOf(to));
const parseConfigString = (configString) => configString.split('::').map((s) => s.trim());

/**
 * Check whether a card's meta block has a reviewMode or legacy cardType field.
 */
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

/**
 * Check whether a card's meta block has the legacy cardType field (not reviewMode).
 */
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

/**
 * Find all session blocks that contain a reviewMode:: field.
 */
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

/**
 * MigrateLegacyDataPanel
 *
 * Migrates card data to the current architecture where reviewMode is the
 * single source of truth stored in the meta block, and session records
 * contain only algorithm-specific parameters (no reviewMode).
 *
 * Three migration tasks:
 * 1. cardType → reviewMode: Rename legacy cardType:: to reviewMode:: in meta blocks
 * 2. Missing reviewMode: Infer and write reviewMode to meta for cards without one
 * 3. Session cleanup: Remove redundant reviewMode:: from session records
 *
 * Safe to run multiple times — already-migrated cards are skipped.
 */
const MigrateLegacyDataPanel = ({ dataPageTitle }: { dataPageTitle: string }) => {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, migrated: 0, skipped: 0 });

  const runMigration = async () => {
    setStatus('running');
    setProgress({ total: 0, migrated: 0, skipped: 0 });

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
      let migrated = 0;
      let skipped = 0;

      for (const cardUid of cardUids) {
        const cardData = pluginPageData[cardUid];
        if (!cardData) {
          skipped++;
          setProgress({ total, migrated, skipped });
          continue;
        }

        const rawCardChildren = dataChildren.find(
          (child) => getStringBetween(child?.string || '', '((', '))') === cardUid
        )?.children || [];

        const needsCardTypeRename = hasLegacyCardType(rawCardChildren);
        const needsReviewModeWrite = !hasMetaReviewMode(rawCardChildren);
        const sessionReviewModeBlocks = findSessionReviewModeBlocks(rawCardChildren);
        const needsSessionCleanup = sessionReviewModeBlocks.length > 0;

        if (!needsCardTypeRename && !needsReviewModeWrite && !needsSessionCleanup) {
          skipped++;
          setProgress({ total, migrated, skipped });
          continue;
        }

        const sessions = Array.isArray(cardData) ? cardData : [cardData];
        const latestSession = sessions[sessions.length - 1];

        if (needsCardTypeRename || needsReviewModeWrite) {
          const resolvedMode = inferReviewModeFromFields(latestSession);
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

          if (needsCardTypeRename) {
            const metaBlock = rawCardChildren.find((child) => child?.string === CARD_META_BLOCK_NAME);
            if (metaBlock?.children) {
              for (const field of metaBlock.children) {
                if (!field?.string) continue;
                const [key, value] = parseConfigString(field.string);
                if (key === 'cardType' && field.uid) {
                  await window.roamAlphaAPI.updateBlock({
                    block: { uid: field.uid, string: `reviewMode:: ${value}` },
                  });
                }
              }
            }
          }
        }

        if (needsSessionCleanup) {
          for (const block of sessionReviewModeBlocks) {
            await window.roamAlphaAPI.deleteBlock({
              block: { uid: block.uid },
            });
          }
        }

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
