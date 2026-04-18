/**
 * Data Migration Panel
 *
 * Migrates legacy data structures to the unified session-block architecture:
 *
 * Phase 1: cardType → reviewMode rename + write reviewMode to session + duplicate cleanup + meta block merge into session
 * Phase 2: Delete session-level reviewMode field blocks
 * Phase 3: Convert reviewMode → algorithm + interaction in session blocks
 * Phase 4: Deduplicate algorithm/interaction fields + rename old field names to {owner}_{purpose} convention + convert READ → LBL
 * Phase 5: Compact latest session snapshots (fill missing fields from merged history)
 */
import * as React from 'react';
import { Alert } from '@blueprintjs/core';
import {
  SchedulingAlgorithm,
  InteractionStyle,
  isLBLReviewMode,
  resolveReviewConfig,
} from '~/models/session';

const DEBUG_MIGRATION = false;
const debugLog = (...args: any[]) => { if (DEBUG_MIGRATION) console.log(...args); };

const LEGACY_MODE_TO_CONFIG: Record<string, { algorithm: SchedulingAlgorithm; interaction: InteractionStyle }> = {
  SPACED_INTERVAL: { algorithm: SchedulingAlgorithm.SM2, interaction: InteractionStyle.NORMAL },
  SPACED_INTERVAL_LBL: { algorithm: SchedulingAlgorithm.SM2, interaction: InteractionStyle.LBL },
  FIXED_PROGRESSIVE: { algorithm: SchedulingAlgorithm.PROGRESSIVE, interaction: InteractionStyle.NORMAL },
  FIXED_PROGRESSIVE_LBL: { algorithm: SchedulingAlgorithm.PROGRESSIVE, interaction: InteractionStyle.LBL },
  FIXED_DAYS: { algorithm: SchedulingAlgorithm.FIXED_DAYS, interaction: InteractionStyle.NORMAL },
  FIXED_WEEKS: { algorithm: SchedulingAlgorithm.FIXED_WEEKS, interaction: InteractionStyle.NORMAL },
  FIXED_MONTHS: { algorithm: SchedulingAlgorithm.FIXED_MONTHS, interaction: InteractionStyle.NORMAL },
  FIXED_YEARS: { algorithm: SchedulingAlgorithm.FIXED_YEARS, interaction: InteractionStyle.NORMAL },
};
import { updateReviewConfig, deduplicateSessionFields } from '~/queries';
import { getPluginPageData, SESSION_SNAPSHOT_KEYS } from '~/queries/data';
import { getStringBetween, parseConfigString } from '~/utils/string';

const CARD_META_BLOCK_NAME = 'meta';

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

interface ReviewModeFieldInfo {
  uid: string;
  value: string;
  location: 'session' | 'meta';
}

interface ReviewModeConversionTask {
  cardUid: string;
  reviewModeFields: ReviewModeFieldInfo[];
  resolvedMode: string;
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
  latestSessionBlockUid?: string;
  hasAlgorithm: boolean;
  hasInteraction: boolean;
}

interface ScanResult {
  cardsNeedingConversion: number;
  cardsAlreadyConverted: number;
  conversionTasks: ReviewModeConversionTask[];
}

interface MigrationTask {
  cardUid: string;
  needsCardTypeRename: boolean;
  cardTypeBlockUid?: string;
  cardTypeBlockValue?: string;
  needsReviewModeWrite: boolean;
  needsDuplicateCleanup: boolean;
  duplicateBlockUids: string[];
  sessionReviewModeUids: string[];
  resolvedMode: string;
  needsMetaMerge: boolean;
  metaBlockUid?: string;
  metaFields: Record<string, { uid: string; value: string }>;
  latestSessionBlockUid?: string;
}

const scanReviewModeFields = (cardChildren: any[] = []): ReviewModeFieldInfo[] => {
  const fields: ReviewModeFieldInfo[] = [];

  const latestSession = findLatestSessionBlock(cardChildren);
  if (latestSession?.children) {
    for (const field of latestSession.children) {
      if (!field?.string) continue;
      const [key, value] = parseConfigString(field.string);
      if (key === 'reviewMode' && field.uid) {
        fields.push({ uid: field.uid, value: value || '', location: 'session' });
      }
    }
  }

  const metaBlock = findMetaBlock(cardChildren);
  if (metaBlock?.children) {
    for (const field of metaBlock.children) {
      if (!field?.string) continue;
      const [key, value] = parseConfigString(field.string);
      if (key === 'reviewMode' && field.uid) {
        fields.push({ uid: field.uid, value: value || '', location: 'meta' });
      }
    }
  }

  return fields;
};

const hasAlgorithmInteractionFields = (cardChildren: any[] = []): { hasAlgorithm: boolean; hasInteraction: boolean } => {
  const latestSession = findLatestSessionBlock(cardChildren);
  let hasAlgorithm = false;
  let hasInteraction = false;

  if (latestSession?.children) {
    for (const field of latestSession.children) {
      if (!field?.string) continue;
      const [key] = parseConfigString(field.string);
      if (key === 'algorithm') hasAlgorithm = true;
      if (key === 'interaction') hasInteraction = true;
    }
  }

  return { hasAlgorithm, hasInteraction };
};

const MigrateLegacyDataPanel = ({ dataPageTitle }: { dataPageTitle: string }) => {
  const [status, setStatus] = React.useState<'idle' | 'scanning' | 'ready' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, migrated: 0, skipped: 0, phase: '' });
  const [errorDetail, setErrorDetail] = React.useState('');
  const [scanResult, setScanResult] = React.useState<ScanResult | null>(null);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [errorMessages, setErrorMessages] = React.useState<string[]>([]);

  const runScan = async () => {
    setStatus('scanning');
    setScanResult(null);
    setErrorDetail('');
    setErrorMessages([]);

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

      const conversionTasks: ReviewModeConversionTask[] = [];
      let cardsAlreadyConverted = 0;

      for (const cardUid of cardUids) {
        const cardData = pluginPageData[cardUid];
        if (!cardData) continue;

        const rawCardChildren =
          dataChildren.find(
            (child) => getStringBetween(child?.string || '', '((', '))') === cardUid
          )?.children || [];

        const reviewModeFields = scanReviewModeFields(rawCardChildren);
        const { hasAlgorithm, hasInteraction } = hasAlgorithmInteractionFields(rawCardChildren);

        if (reviewModeFields.length === 0) continue;

        if (hasAlgorithm && hasInteraction) {
          cardsAlreadyConverted++;
          continue;
        }

        const sessions = Array.isArray(cardData) ? cardData : [cardData];
        const latestSession = sessions[sessions.length - 1];

        const resolvedConfig = resolveReviewConfig(latestSession.algorithm, latestSession.interaction);
        const resolvedMode = LEGACY_MODE_TO_CONFIG[`${resolvedConfig.algorithm}_${resolvedConfig.interaction}`]
          ? `${resolvedConfig.algorithm}_${resolvedConfig.interaction}`
          : 'SPACED_INTERVAL';
        const isLineByLine =
          (latestSession as any)?.lineByLineReview === 'Y' || isLBLReviewMode(resolvedConfig.interaction);
        const finalMode =
          isLineByLine && resolvedConfig.algorithm === SchedulingAlgorithm.SM2 && resolvedConfig.interaction === InteractionStyle.NORMAL
            ? 'SPACED_INTERVAL_LBL'
            : isLineByLine && resolvedConfig.algorithm === SchedulingAlgorithm.PROGRESSIVE && resolvedConfig.interaction === InteractionStyle.NORMAL
            ? 'FIXED_PROGRESSIVE_LBL'
            : resolvedMode;

        const config = LEGACY_MODE_TO_CONFIG[finalMode];
        const latestSessionBlock = findLatestSessionBlock(rawCardChildren);

        conversionTasks.push({
          cardUid,
          reviewModeFields,
          resolvedMode: finalMode,
          algorithm: config.algorithm,
          interaction: config.interaction,
          latestSessionBlockUid: latestSessionBlock?.uid,
          hasAlgorithm,
          hasInteraction,
        });
      }

      const result: ScanResult = {
        cardsNeedingConversion: conversionTasks.length,
        cardsAlreadyConverted,
        conversionTasks,
      };

      debugLog('[Memo] Scan complete:', {
        cardsNeedingConversion: result.cardsNeedingConversion,
        cardsAlreadyConverted: result.cardsAlreadyConverted,
      });

      setScanResult(result);
      setStatus('ready');
    } catch (error) {
      console.error('[Memo] Scan error:', error);
      setErrorDetail(`Scan failed: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('error');
    }
  };

  const runMigration = async () => {
    setShowConfirm(false);
    setStatus('running');
    setProgress({ total: 0, migrated: 0, skipped: 0, phase: 'Scanning...' });
    setErrorDetail('');
    setErrorMessages([]);

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

        const resolvedConfig = resolveReviewConfig(latestSession.algorithm, latestSession.interaction);
        const resolvedMode = LEGACY_MODE_TO_CONFIG[`${resolvedConfig.algorithm}_${resolvedConfig.interaction}`]
          ? `${resolvedConfig.algorithm}_${resolvedConfig.interaction}`
          : 'SPACED_INTERVAL';
        const isLineByLine =
          (latestSession as any)?.lineByLineReview === 'Y' || isLBLReviewMode(resolvedConfig.interaction);
        const finalMode =
          isLineByLine && resolvedConfig.algorithm === SchedulingAlgorithm.SM2 && resolvedConfig.interaction === InteractionStyle.NORMAL
            ? 'SPACED_INTERVAL_LBL'
            : isLineByLine && resolvedConfig.algorithm === SchedulingAlgorithm.PROGRESSIVE && resolvedConfig.interaction === InteractionStyle.NORMAL
            ? 'FIXED_PROGRESSIVE_LBL'
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
      const errMsgs: string[] = [];

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
            debugLog(`[Memo] Phase 1: card ${task.cardUid} — renamed cardType → reviewMode`);
          }

          if (task.needsReviewModeWrite || task.needsCardTypeRename) {
            const config = LEGACY_MODE_TO_CONFIG[task.resolvedMode];
            await updateReviewConfig({
              refUid: task.cardUid,
              dataPageTitle,
              algorithm: config?.algorithm,
              interaction: config?.interaction,
            });
            debugLog(`[Memo] Phase 1: card ${task.cardUid} — wrote reviewMode (mode=${task.resolvedMode})`);
          }

          if (task.needsDuplicateCleanup && task.duplicateBlockUids.length > 0) {
            for (const uid of task.duplicateBlockUids) {
              await window.roamAlphaAPI.deleteBlock({ block: { uid } });
            }
            debugLog(`[Memo] Phase 1: card ${task.cardUid} — cleaned ${task.duplicateBlockUids.length} duplicate blocks`);
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
            debugLog(`[Memo] Phase 1: card ${task.cardUid} — merged meta block into session`);
          }

          migrated++;
        } catch (err) {
          const msg = `Card ${task.cardUid}: ${err instanceof Error ? err.message : String(err)}`;
          console.error(`[Memo] Phase 1 migration error on card ${task.cardUid}:`, err);
          errMsgs.push(msg);
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
            const msg = `Session cleanup block ${allSessionUids[i]}: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[Memo] Phase 2 session cleanup error:`, err);
            errMsgs.push(msg);
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

      setProgress({
        total,
        migrated,
        skipped,
        phase: 'Phase 3: Converting reviewMode → algorithm + interaction',
      });

      const conversionTasks = scanResult?.conversionTasks || [];
      let phase3Converted = 0;
      let phase3Skipped = 0;
      let phase3Errors = 0;

      if (conversionTasks.length > 0) {
        for (let i = 0; i < conversionTasks.length; i++) {
          const task = conversionTasks[i];

          try {
            if (!task.latestSessionBlockUid) {
              debugLog(`[Memo] Phase 3: SKIP card ${task.cardUid} — no session block found`);
              phase3Skipped++;
              continue;
            }

            if (!task.hasAlgorithm) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': task.latestSessionBlockUid, order: -1 },
                block: { string: `algorithm:: ${task.algorithm}`, open: false },
              });
            }

            if (!task.hasInteraction) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': task.latestSessionBlockUid, order: -1 },
                block: { string: `interaction:: ${task.interaction}`, open: false },
              });
            }

            for (const field of task.reviewModeFields) {
              await window.roamAlphaAPI.deleteBlock({ block: { uid: field.uid } });
            }

            debugLog(`[Memo] Phase 3: card ${task.cardUid} — reviewMode=${task.resolvedMode} → algorithm=${task.algorithm}, interaction=${task.interaction} (SUCCESS)`);
            phase3Converted++;
          } catch (err) {
            const msg = `Phase 3 card ${task.cardUid}: ${err instanceof Error ? err.message : String(err)}`;
            console.error(`[Memo] Phase 3 migration error on card ${task.cardUid}:`, err);
            errMsgs.push(msg);
            phase3Errors++;
          }

          setProgress({
            total,
            migrated,
            skipped,
            phase: `Phase 3: Converting reviewMode (${phase3Converted + phase3Skipped + phase3Errors}/${conversionTasks.length})`,
          });

          if ((i + 1) % BATCH_SIZE === 0) {
            await sleep(BATCH_DELAY_MS);
          } else {
            await sleep(CARD_DELAY_MS);
          }
        }
      }

      debugLog(`[Memo] Migration summary:`, {
        phase1: { migrated, errors, skipped },
        phase2: { sessionBlocksCleaned: allSessionUids.length },
        phase3: { converted: phase3Converted, skipped: phase3Skipped, errors: phase3Errors },
      });

      setProgress({
        total,
        migrated,
        skipped,
        phase: 'Phase 4: Deduplicating fields & renaming fields',
      });

      try {
        const dedupResult = await deduplicateSessionFields({ dataPageTitle });
        debugLog(`[Memo] Phase 4 dedup: cleaned=${dedupResult.cleaned}, errors=${dedupResult.errors}`);
      } catch (err) {
        console.error('[Memo] Phase 4 dedup error:', err);
        errMsgs.push(`Phase 4 dedup: ${err instanceof Error ? err.message : String(err)}`);
      }

      const FIELD_RENAME_MAP: Record<string, string> = {
        repetitions: 'sm2_repetitions',
        interval: 'sm2_interval',
        eFactor: 'sm2_eFactor',
        grade: 'sm2_grade',
        progressiveRepetitions: 'progressive_repetitions',
        progressiveInterval: 'progressive_interval',
        intervalMultiplier: 'fixed_multiplier',
        lineByLineProgress: 'lbl_progress',
      };

      const FIELDS_TO_DELETE = ['intervalMultiplierType', 'lineByLineReview'];

      setProgress({
        total,
        migrated,
        skipped,
        phase: 'Phase 4: Renaming fields & converting READ → LBL',
      });

      const renameQuery = `[
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

      const renameQueryResults = await window.roamAlphaAPI.q(renameQuery, dataPageTitle, 'data');
      const renameDataChildren = renameQueryResults.map((arr) => arr[0])[0]?.children || [];

      let phase4Renamed = 0;
      let phase4Deleted = 0;
      let phase4ReadConverted = 0;
      let phase4Errors = 0;

      for (const cardChild of renameDataChildren) {
        if (!cardChild?.children) continue;

        for (const sessionBlock of cardChild.children) {
          if (!sessionBlock?.children) continue;

          for (const field of sessionBlock.children) {
            if (!field?.string || !field.uid) continue;
            const [key, value] = parseConfigString(field.string);

            if (FIELDS_TO_DELETE.includes(key)) {
              try {
                await window.roamAlphaAPI.deleteBlock({ block: { uid: field.uid } });
                phase4Deleted++;
              } catch (err) {
                console.error(`[Memo] Phase 4 delete error for ${key}:`, err);
                phase4Errors++;
              }
              continue;
            }

            if (key === 'interaction' && value === 'READ') {
              try {
                await window.roamAlphaAPI.updateBlock({
                  block: { uid: field.uid, string: 'interaction:: LBL' },
                });
                phase4ReadConverted++;
              } catch (err) {
                console.error(`[Memo] Phase 4 READ→LBL error:`, err);
                phase4Errors++;
              }
              continue;
            }

            if (FIELD_RENAME_MAP[key]) {
              try {
                await window.roamAlphaAPI.updateBlock({
                  block: { uid: field.uid, string: `${FIELD_RENAME_MAP[key]}:: ${value}` },
                });
                phase4Renamed++;
              } catch (err) {
                console.error(`[Memo] Phase 4 rename error for ${key}:`, err);
                phase4Errors++;
              }
            }
          }
        }
      }

      debugLog(`[Memo] Phase 4 summary:`, {
        renamed: phase4Renamed,
        deleted: phase4Deleted,
        readConverted: phase4ReadConverted,
        errors: phase4Errors,
      });

      setProgress({
        total,
        migrated,
        skipped,
        phase: 'Phase 5: Compacting latest session snapshots',
      });

      let phase5Compacted = 0;
      let phase5Skipped = 0;
      let phase5Errors = 0;

      try {
        const compactedData = await getPluginPageData({ dataPageTitle, limitToLatest: false });
        const compactQuery = `[
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

        const compactQueryResults = await window.roamAlphaAPI.q(compactQuery, dataPageTitle, 'data');
        const compactDataChildren = compactQueryResults.map((arr) => arr[0])[0]?.children || [];

        for (const cardChild of compactDataChildren) {
          if (!cardChild?.string) continue;
          const cardUid = getStringBetween(cardChild.string, '((', '))');
          if (!cardUid) continue;

          const sessions = compactedData[cardUid];
          if (!sessions || !Array.isArray(sessions) || !sessions.length) {
            phase5Skipped++;
            continue;
          }

          const mergedSnapshot = sessions[sessions.length - 1];

          const sessionBlocks = (cardChild.children || [])
            .filter((c) => {
              if (!c?.string) return false;
              const dateStr = getStringBetween(c.string, '[[', ']]');
              return !!dateStr;
            })
            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

          if (!sessionBlocks.length) {
            phase5Skipped++;
            continue;
          }

          const latestBlock = sessionBlocks[0];
          const existingFields = new Set<string>();
          if (latestBlock.children) {
            for (const field of latestBlock.children) {
              if (!field?.string) continue;
              const [key] = parseConfigString(field.string);
              if (key) existingFields.add(key);
            }
          }

          const missingFields: { key: string; value: string }[] = [];
          for (const key of SESSION_SNAPSHOT_KEYS) {
            if (existingFields.has(key)) continue;
            const value = (mergedSnapshot as any)[key];
            if (value === undefined || value === null) continue;

            if (key === 'nextDueDate' && value instanceof Date) {
              const dateStr = value.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }).replace(/(\d+)(st|nd|rd|th)/, '$1$2');
              missingFields.push({ key, value: `[[${dateStr}]]` });
            } else if (key === 'lbl_progress') {
              missingFields.push({ key, value: typeof value === 'string' ? value : JSON.stringify(value) });
            } else {
              missingFields.push({ key, value: String(value) });
            }
          }

          if (missingFields.length === 0) {
            phase5Skipped++;
            continue;
          }

          try {
            for (const { key, value } of missingFields) {
              await window.roamAlphaAPI.createBlock({
                location: { 'parent-uid': latestBlock.uid, order: -1 },
                block: { string: `${key}:: ${value}`, open: false },
              });
            }
            phase5Compacted++;
          } catch (err) {
            console.error(`[Memo] Phase 5 compact error for card ${cardUid}:`, err);
            phase5Errors++;
          }

          if ((phase5Compacted + phase5Skipped + phase5Errors) % BATCH_SIZE === 0) {
            setProgress({
              total,
              migrated,
              skipped,
              phase: `Phase 5: Compacting snapshots (${phase5Compacted + phase5Skipped + phase5Errors}/${compactDataChildren.length})`,
            });
            await sleep(BATCH_DELAY_MS);
          } else {
            await sleep(CARD_DELAY_MS);
          }
        }
      } catch (err) {
        console.error('[Memo] Phase 5 compact error:', err);
        errMsgs.push(`Phase 5 compact: ${err instanceof Error ? err.message : String(err)}`);
      }

      debugLog(`[Memo] Phase 5 summary:`, {
        compacted: phase5Compacted,
        skipped: phase5Skipped,
        errors: phase5Errors,
      });

      setProgress({ total, migrated, skipped, phase: 'Done' });

      const totalErrors = errors + phase3Errors;
      if (totalErrors > 0) {
        setErrorDetail(`${totalErrors} cards had errors.`);
        setErrorMessages(errMsgs);
      }
      setStatus('done');
    } catch (error) {
      console.error('[Memo] Migration error:', error);
      setErrorDetail(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
      setStatus('error');
    }
  };

  const handleConfirmMigrate = () => {
    setShowConfirm(true);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <Alert
        isOpen={showConfirm}
        cancelButtonText="Cancel"
        confirmButtonText="Migrate"
        intent="warning"
        onConfirm={() => { runMigration(); }}
        onCancel={() => { setShowConfirm(false); }}
      >
        <p>
          This migration will convert <strong>reviewMode</strong> fields to the new{' '}
          <strong>algorithm</strong> + <strong>interaction</strong> format, and delete the old{' '}
          reviewMode field blocks.
        </p>
        {scanResult && (
          <p>
            <strong>{scanResult.cardsNeedingConversion}</strong> cards need migration.{' '}
            <strong>{scanResult.cardsAlreadyConverted}</strong> cards already have algorithm +
            interaction fields.
          </p>
        )}
      </Alert>

      {(status === 'idle' || status === 'ready') && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            className="bp3-button"
            onClick={runScan}
            style={{ fontSize: '12px' }}
          >
            Scan for Migration
          </button>
          {scanResult && (
            <button
              className="bp3-button bp3-intent-primary"
              onClick={handleConfirmMigrate}
              style={{ fontSize: '12px' }}
            >
              Migrate Legacy Data
            </button>
          )}
        </div>
      )}

      {status === 'scanning' && (
        <div style={{ fontSize: '12px', color: '#888' }}>
          Scanning cards for reviewMode fields...
        </div>
      )}

      {status === 'ready' && scanResult && (
        <div style={{ fontSize: '12px', color: '#5c7080', marginTop: '8px' }}>
          <div>
            Cards needing conversion: <strong>{scanResult.cardsNeedingConversion}</strong>
          </div>
          <div>
            Cards already converted: <strong>{scanResult.cardsAlreadyConverted}</strong>
          </div>
        </div>
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
          {errorMessages.length > 0 && (
            <div style={{ fontSize: '11px', color: '#a66921', marginTop: '4px', maxHeight: '120px', overflowY: 'auto' }}>
              {errorMessages.slice(0, 10).map((msg, idx) => (
                <div key={idx}>{msg}</div>
              ))}
              {errorMessages.length > 10 && (
                <div>...and {errorMessages.length - 10} more errors</div>
              )}
            </div>
          )}
          <button
            className="bp3-button"
            onClick={() => {
              setStatus('idle');
              setScanResult(null);
              setErrorMessages([]);
            }}
            style={{ fontSize: '12px', marginTop: '8px' }}
          >
            Reset
          </button>
        </div>
      )}

      {status === 'error' && (
        <div>
          <div style={{ fontSize: '12px', color: '#c23030' }}>
            Migration failed. {errorDetail || 'Check the console for details.'}
          </div>
          {errorMessages.length > 0 && (
            <div style={{ fontSize: '11px', color: '#c23030', marginTop: '4px', maxHeight: '120px', overflowY: 'auto' }}>
              {errorMessages.slice(0, 10).map((msg, idx) => (
                <div key={idx}>{msg}</div>
              ))}
              {errorMessages.length > 10 && (
                <div>...and {errorMessages.length - 10} more errors</div>
              )}
            </div>
          )}
          <button
            className="bp3-button"
            onClick={() => {
              setStatus('idle');
              setScanResult(null);
              setErrorMessages([]);
            }}
            style={{ fontSize: '12px', marginTop: '8px' }}
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
};

export default MigrateLegacyDataPanel;
