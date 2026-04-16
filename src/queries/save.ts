/**
 * Practice Data Persistence
 *
 * Handles writing practice results to the Roam data page.
 *
 * Unified data layout — all fields stored in session blocks:
 *   ((cardUid))
 *   ├── [[Date]] 🟢            ← latest session block
 *   │   ├── reviewMode:: FIXED_PROGRESSIVE
 *   │   ├── nextDueDate:: [[Date]]
 *   │   ├── lineByLineProgress:: {...}
 *   │   ├── grade:: 5
 *   │   ├── eFactor:: 2.5
 *   │   └── ...
 *   └── [[Date]] 🔴            ← older session block
 *       └── ...
 *
 * The meta block has been removed. reviewMode and nextDueDate are now
 * stored in each session record alongside algorithm-specific fields.
 * lineByLineReview is no longer stored — its function is encoded in
 * the reviewMode value (e.g. SPACED_INTERVAL_LBL, FIXED_PROGRESSIVE_LBL).
 */
import * as stringUtils from '~/utils/string';
import * as dateUtils from '~/utils/date';
import { LineByLineProgressMap, ReviewModes } from '~/models/session';
import {
  createChildBlock,
  getChildBlock,
  getOrCreateBlockOnPage,
  getOrCreateChildBlock,
  getOrCreatePage,
} from '~/queries/utils';

import { CARD_META_SESSION_KEYS } from '~/constants';

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
 * All fields (including reviewMode, nextDueDate, lineByLineProgress)
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
  const emoji = getEmojiFromGrade(data.grade);
  const newDataBlockId = await createChildBlock(
    cardDataBlockUid,
    `[[${dateCreatedRoamDateString}]] ${emoji}`,
    0,
    { open: false }
  );

  const nextDueDate = data.nextDueDate || dateUtils.addDays(referenceDate, data.interval);

  for (const key of Object.keys(data)) {
    if (data[key] === undefined) continue;
    if (CARD_META_SESSION_KEYS.has(key)) continue;

    let value = data[key];
    if (key === 'nextDueDate') {
      value = `[[${stringUtils.dateToRoamDateString(nextDueDate)}]]`;
    }
    if (key === 'lineByLineProgress') {
      value = JSON.stringify(data[key]);
    }

    await createChildBlock(newDataBlockId, `${key}:: ${value}`, -1);
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
    key: 'lineByLineProgress',
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
 * Update reviewMode in the latest session block.
 * lineByLineReview is no longer stored — LBL is encoded in reviewMode.
 */
export const updateCardType = async ({
  refUid,
  dataPageTitle,
  reviewMode,
}: {
  refUid: string;
  dataPageTitle: string;
  reviewMode: ReviewModes;
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  await upsertLatestSessionField({ cardDataBlockUid, key: 'reviewMode', value: reviewMode });
};
