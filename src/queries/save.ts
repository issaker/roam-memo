/**
 * Practice Data Persistence
 *
 * Handles writing practice results to the Roam data page.
 *
 * Unified data layout — all fields stored in session blocks:
 *   ((cardUid))
 *   ├── [[Date]] 🟢            ← latest session block
 *   │   ├── algorithm:: SM2
 *   │   ├── interaction:: NORMAL
 *   │   ├── nextDueDate:: [[Date]]
 *   │   ├── lbl_progress:: {...}
 *   │   ├── sm2_grade:: 5
 *   │   ├── sm2_eFactor:: 2.5
 *   │   └── ...
 *   └── [[Date]] 🔴            ← older session block
 *       └── ...
 *
 * The meta block has been removed. algorithm and interaction are now
 * stored in each session record alongside algorithm-specific fields.
 * lineByLineReview is no longer stored — its function is encoded in
 * the interaction value (e.g. LINE_BY_LINE).
 */
import * as stringUtils from '~/utils/string';
import * as dateUtils from '~/utils/date';
import { LineByLineProgressMap, SchedulingAlgorithm, InteractionStyle } from '~/models/session';
import { parseConfigString } from '~/utils/string';
import {
  createChildBlock,
  getChildBlock,
  getOrCreateBlockOnPage,
  getOrCreateChildBlock,
  getOrCreatePage,
} from '~/queries/utils';

const getEmojiFromGrade = (grade) => {
  switch (grade) {
    case 5:
      return '🟢';
    case 4:
      return '🔵';
    case 3:
      return '🟠';
    case 2:
      return '🟠';
    case 1:
      return '🟠';
    case 0:
      return '🔴';
    default:
      return '🟢';
  }
};

/**
 * Upsert a field in the latest session block for a card.
 * Finds the most recent date-headed block and updates or creates the field.
 */
const upsertLatestSessionField = async ({
  cardDataBlockUid,
  key,
  value,
}: {
  cardDataBlockUid: string;
  key: string;
  value: string;
}) => {
  const cardChildren = await window.roamAlphaAPI.q(
    `[:find (pull ?card [:block/children :block/uid {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}])
         :in $ ?cardUid
         :where [?card :block/uid ?cardUid]]`,
    cardDataBlockUid
  );

  const children = cardChildren?.[0]?.[0]?.children || [];
  const dateBlocks = children
    .filter((c) => {
      if (!c?.string) return false;
      const dateStr = stringUtils.getStringBetween(c.string, '[[', ']]');
      return !!stringUtils.parseRoamDateString(dateStr);
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!dateBlocks.length) return;

  const latestDateBlock = dateBlocks[0];
  if (!latestDateBlock?.children) {
    await createChildBlock(latestDateBlock.uid, `${key}:: ${value}`, -1, { open: false });
    return;
  }

  const existingField = latestDateBlock.children.find((c) => {
    if (!c?.string) return false;
    return c.string.startsWith(`${key}::`);
  });

  if (existingField) {
    await window.roamAlphaAPI.updateBlock({
      block: { uid: existingField.uid, string: `${key}:: ${value}` },
    });
  } else {
    await createChildBlock(latestDateBlock.uid, `${key}:: ${value}`, -1, { open: false });
  }
};

/**
 * Save a single practice session result to the data page.
 * All fields (including algorithm, interaction, nextDueDate, lineByLineProgress)
 * are written to the session block.
 */
export const savePracticeData = async ({ refUid, dataPageTitle, dateCreated, ...data }) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  const referenceDate = dateCreated || new Date();
  const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(referenceDate);
  const emoji = getEmojiFromGrade(data.sm2_grade);
  const newDataBlockId = await createChildBlock(
    cardDataBlockUid,
    `[[${dateCreatedRoamDateString}]] ${emoji}`,
    0,
    { open: false }
  );

  const nextDueDate = data.nextDueDate || dateUtils.addDays(referenceDate, data.sm2_interval);

  for (const key of Object.keys(data)) {
    if (data[key] === undefined) continue;
    if (key === 'reviewMode') continue;
    if (key === 'algorithm') continue;
    if (key === 'interaction') continue;

    let value = data[key];
    if (key === 'nextDueDate') {
      value = `[[${stringUtils.dateToRoamDateString(nextDueDate)}]]`;
    }
    if (key === 'lbl_progress') {
      value = JSON.stringify(data[key]);
    }

    await createChildBlock(newDataBlockId, `${key}:: ${value}`, -1);
  }

  if (data.algorithm) {
    await createChildBlock(newDataBlockId, `algorithm:: ${data.algorithm}`, -1);
  }
  if (data.interaction) {
    await createChildBlock(newDataBlockId, `interaction:: ${data.interaction}`, -1);
  }
};

/**
 * Update lineByLineProgress in the latest session block.
 * Also updates nextDueDate:
 *   - If there are unread children (progress entries < totalChildren),
 *     sets nextDueDate to today so the card stays "due" in subsequent sessions.
 *   - Otherwise, sets nextDueDate to the earliest child due date.
 */
export const updateLineByLineProgress = async ({
  refUid,
  dataPageTitle,
  progress,
  totalChildren,
}: {
  refUid: string;
  dataPageTitle: string;
  progress: LineByLineProgressMap;
  totalChildren?: number;
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getChildBlock(dataBlockUid, `((${refUid}))`);
  if (!cardDataBlockUid) return;

  const progressString = JSON.stringify(progress);
  await upsertLatestSessionField({
    cardDataBlockUid,
    key: 'lbl_progress',
    value: progressString,
  });

  const reviewedCount = Object.keys(progress).length;
  const hasUnreadChildren = totalChildren !== undefined && reviewedCount < totalChildren;

  if (hasUnreadChildren) {
    const todayString = `[[${stringUtils.dateToRoamDateString(new Date())}]]`;
    await upsertLatestSessionField({
      cardDataBlockUid,
      key: 'nextDueDate',
      value: todayString,
    });
  } else {
    const earliestDueDate = Object.values(progress).reduce((earliest, child) => {
      if (!child?.nextDueDate) return earliest;
      const d = new Date(child.nextDueDate);
      return !earliest || d < earliest ? d : earliest;
    }, null as Date | null);

    if (earliestDueDate) {
      const dueDateString = `[[${stringUtils.dateToRoamDateString(earliestDueDate)}]]`;
      await upsertLatestSessionField({
        cardDataBlockUid,
        key: 'nextDueDate',
        value: dueDateString,
      });
    }
  }
};

/**
 * Update algorithm and interaction in the latest session block.
 * lineByLineReview is no longer stored — LBL is encoded in interaction.
 */
export const updateReviewConfig = async ({
  refUid,
  dataPageTitle,
  algorithm,
  interaction,
}: {
  refUid: string;
  dataPageTitle: string;
  algorithm?: SchedulingAlgorithm;
  interaction?: InteractionStyle;
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  if (algorithm) {
    await upsertLatestSessionField({ cardDataBlockUid, key: 'algorithm', value: algorithm });
  }
  if (interaction) {
    await upsertLatestSessionField({ cardDataBlockUid, key: 'interaction', value: interaction });
  }
};

const DEDUP_FIELD_KEYS = ['algorithm', 'interaction', 'intervalMultiplierType'];

export const deduplicateSessionFields = async ({
  dataPageTitle,
}: {
  dataPageTitle: string;
}): Promise<{ cleaned: number; errors: number }> => {
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

  let cleaned = 0;
  let errors = 0;

  for (const cardChild of dataChildren) {
    if (!cardChild?.children) continue;

    for (const sessionBlock of cardChild.children) {
      if (!sessionBlock?.children) continue;

      const keyBlocks: Record<string, { uid: string; string: string }[]> = {};

      for (const field of sessionBlock.children) {
        if (!field?.string || !field.uid) continue;
        const [key] = parseConfigString(field.string);
        if (DEDUP_FIELD_KEYS.includes(key)) {
          if (!keyBlocks[key]) keyBlocks[key] = [];
          keyBlocks[key].push({ uid: field.uid, string: field.string });
        }
      }

      for (const key of Object.keys(keyBlocks)) {
        const blocks = keyBlocks[key];
        if (blocks.length <= 1) continue;

        const keepBlock = blocks[blocks.length - 1];
        for (const block of blocks) {
          if (block.uid === keepBlock.uid) continue;
          try {
            await window.roamAlphaAPI.deleteBlock({ block: { uid: block.uid } });
            cleaned++;
          } catch (err) {
            console.error(`[Memo] Dedup error deleting ${key} block ${block.uid}:`, err);
            errors++;
          }
        }
      }
    }
  }

  return { cleaned, errors };
};
