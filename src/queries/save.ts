import * as stringUtils from '~/utils/string';
import * as dateUtils from '~/utils/date';
import { CardType, CompleteRecords, LineByLineProgressMap } from '~/models/session';
import {
  createChildBlock,
  getChildBlock,
  getOrCreateBlockOnPage,
  getOrCreateChildBlock,
  getOrCreatePage,
} from '~/queries/utils';

import { CARD_META_BLOCK_NAME, CARD_META_SESSION_KEYS } from '~/constants';

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

const getLatestSessionUid = (cardDataBlockUid: string) => {
  const sessionHeadingQuery = `
    [:find ?childUid ?childOrder
     :where
     [?parent :block/uid "${cardDataBlockUid}"]
     [?child :block/parents ?parent]
     [?child :block/uid ?childUid]
     [?child :block/order ?childOrder]
     [?child :block/string ?childString]
     [(clojure.string/starts-with? ?childString "[[")]
    ]
  `;
  const sessionHeadings = window.roamAlphaAPI.q(sessionHeadingQuery);
  if (!sessionHeadings?.length) return;

  sessionHeadings.sort((a, b) => a[1] - b[1]);
  return sessionHeadings[0][0];
};

const getOrCreateCardMetaBlock = async (cardDataBlockUid: string) =>
  getOrCreateChildBlock(cardDataBlockUid, CARD_META_BLOCK_NAME, 0, {
    open: false,
  });

const upsertCardMetaField = async ({
  cardDataBlockUid,
  key,
  value,
}: {
  cardDataBlockUid: string;
  key: string;
  value: string;
}) => {
  const cardMetaBlockUid = await getOrCreateCardMetaBlock(cardDataBlockUid);
  const existingFieldBlockUid = await getChildBlock(cardMetaBlockUid, `${key}::`, {
    exactMatch: false,
  });

  if (existingFieldBlockUid) {
    await window.roamAlphaAPI.updateBlock({
      block: { uid: existingFieldBlockUid, string: `${key}:: ${value}` },
    });
    return;
  }

  await createChildBlock(cardMetaBlockUid, `${key}:: ${value}`, -1, {
    open: false,
  });
};

export const savePracticeData = async ({ refUid, dataPageTitle, dateCreated, ...data }) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  // Get child that matches refUid
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
    {
      open: false,
    }
  );

  // Insert new block info
  const nextDueDate = data.nextDueDate || dateUtils.addDays(referenceDate, data.interval);

  for (const key of Object.keys(data)) {
    if (CARD_META_SESSION_KEYS.has(key)) {
      await upsertCardMetaField({
        cardDataBlockUid,
        key,
        value: data[key],
      });
      continue;
    }

    let value = data[key];
    if (key === 'nextDueDate') {
      value = `[[${stringUtils.dateToRoamDateString(nextDueDate)}]]`;
    }

    await createChildBlock(newDataBlockId, `${key}:: ${value}`, -1);
  }
};
interface BulkSavePracticeDataOptions {
  token: string;
  records: CompleteRecords;
  selectedUids: string[];
  dataPageTitle: string;
}

interface RoamBatchAction {
  action: string;
  block?: { uid?: string; string?: string; open?: boolean };
  location?: { 'parent-uid': string; order: number };
}

const getLatestCardMetaFromSessions = (sessions: CompleteRecords[string] = []) => {
  const meta = {} as Record<string, string>;

  for (let i = sessions.length - 1; i >= 0; i--) {
    const session = sessions[i];
    for (const key of Array.from(CARD_META_SESSION_KEYS)) {
      if (!(key in meta) && session[key] !== undefined) {
        meta[key] = session[key];
      }
    }

    if (Object.keys(meta).length === CARD_META_SESSION_KEYS.size) {
      break;
    }
  }

  return meta;
};

export const bulkSavePracticeData = async ({
  token,
  records,
  selectedUids,
  dataPageTitle,
}: BulkSavePracticeDataOptions) => {
  // Uncomment during development to prevent accidental data loss
  // if (dataPageTitle === 'roam/memo') {
  //   alert('NOPE! Protecting your graph data. Cannot save data to memo page during dev');
  //   return;
  // }
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });
  const graphName = window.roamAlphaAPI.graph.name;

  const payload = {
    graphName,
    data: {
      action: 'batch-actions',
      actions: [] as RoamBatchAction[],
    },
  };

  // Create practice entries
  for (const refUid of selectedUids) {
    // Check if entry already exists, if it does, delete it first so we don't
    // have duplicates
    const existingEntryUid = await getChildBlock(dataBlockUid, `((${refUid}))`);
    if (existingEntryUid) {
      payload.data.actions.push({
        action: 'delete-block',
        block: {
          uid: existingEntryUid,
        },
      });
    }

    const entryUid = window.roamAlphaAPI.util.generateUID();
    payload.data.actions.push({
      action: 'create-block',
      location: {
        'parent-uid': dataBlockUid,
        order: 0,
      },
      block: {
        string: `((${refUid}))`,
        uid: entryUid,
        open: false,
      },
    });

    // Add sessions
    const sessions = records[refUid];
    const cardMeta = getLatestCardMetaFromSessions(sessions);

    if (Object.keys(cardMeta).length) {
      const metaBlockUid = window.roamAlphaAPI.util.generateUID();
      payload.data.actions.push({
        action: 'create-block',
        location: {
          'parent-uid': entryUid,
          order: 0,
        },
        block: {
          string: CARD_META_BLOCK_NAME,
          uid: metaBlockUid,
          open: false,
        },
      });

      for (const [key, value] of Object.entries(cardMeta)) {
        payload.data.actions.push({
          action: 'create-block',
          location: {
            'parent-uid': metaBlockUid,
            order: -1,
          },
          block: {
            string: `${key}:: ${value}`,
            open: false,
          },
        });
      }
    }

    for (const session of sessions) {
      // Add Session Heading
      const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(session.dateCreated);
      const emoji = getEmojiFromGrade(session.grade);
      const sessionHeadingUid = window.roamAlphaAPI.util.generateUID();
      payload.data.actions.push({
        action: 'create-block',
        location: {
          'parent-uid': entryUid,
          order: 0,
        },
        block: {
          string: `[[${dateCreatedRoamDateString}]] ${emoji}`,
          uid: sessionHeadingUid,
          open: false,
        },
      });

      // Add Session Data
      for (const key of Object.keys(session)) {
        if (CARD_META_SESSION_KEYS.has(key)) continue;
        let value = session[key];
        if (key === 'dateCreated') continue; // no need to store this
        if (key === 'nextDueDate') {
          value = `[[${stringUtils.dateToRoamDateString(value)}]]`;
        }
        payload.data.actions.push({
          action: 'create-block',
          location: {
            'parent-uid': sessionHeadingUid,
            order: -1,
          },
          block: {
            string: `${key}:: ${value}`,
            open: false,
          },
        });
      }
    }
  }
  const baseUrl = 'https://roam-memo-server.onrender.com';
  // const baseUrl = 'http://localhost:3000';
  try {
    await fetch(`${baseUrl}/save-roam-sr-data`, {
      method: 'POST',

      body: JSON.stringify(payload),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error Bulk Saving', error);
  }
};

export const updateLineByLineProgress = async ({
  refUid,
  dataPageTitle,
  progress,
}: {
  refUid: string;
  dataPageTitle: string;
  progress: LineByLineProgressMap;
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getChildBlock(dataBlockUid, `((${refUid}))`);
  if (!cardDataBlockUid) return;

  const progressString = JSON.stringify(progress);
  await upsertCardMetaField({
    cardDataBlockUid,
    key: 'lineByLineProgress',
    value: progressString,
  });

  const earliestDueDate = Object.values(progress).reduce((earliest, child) => {
    const d = new Date(child.nextDueDate);
    return !earliest || d < earliest ? d : earliest;
  }, null as Date | null);

  if (earliestDueDate) {
    const dueDateString = `[[${stringUtils.dateToRoamDateString(earliestDueDate)}]]`;
    await upsertCardMetaField({
      cardDataBlockUid,
      key: 'nextDueDate',
      value: dueDateString,
    });
  }
};

export const updateLineByLineFlag = async ({
  refUid,
  dataPageTitle,
  enabled,
}: {
  refUid: string;
  dataPageTitle: string;
  enabled: boolean;
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  const flagValue = enabled ? 'Y' : 'N';

  // Card metadata now lives in a dedicated meta block so card-scoped state
  // is structurally separated from historical review sessions.
  await upsertCardMetaField({
    cardDataBlockUid,
    key: 'lineByLineReview',
    value: flagValue,
  });

  if (enabled && !getLatestSessionUid(cardDataBlockUid)) {
    await upsertCardMetaField({
      cardDataBlockUid,
      key: 'lineByLineProgress',
      value: JSON.stringify({}),
    });
  }
};

export const updateCardType = async ({
  refUid,
  dataPageTitle,
  cardType,
  lineByLineReview,
}: {
  refUid: string;
  dataPageTitle: string;
  cardType: CardType;
  lineByLineReview?: 'Y' | 'N';
}) => {
  await getOrCreatePage(dataPageTitle);
  const dataBlockUid = await getOrCreateBlockOnPage(dataPageTitle, 'data', -1, {
    open: false,
    heading: 3,
  });

  const cardDataBlockUid = await getOrCreateChildBlock(dataBlockUid, `((${refUid}))`, 0, {
    open: false,
  });

  await upsertCardMetaField({ cardDataBlockUid, key: 'cardType', value: cardType });

  if (lineByLineReview !== undefined) {
    await upsertCardMetaField({
      cardDataBlockUid,
      key: 'lineByLineReview',
      value: lineByLineReview,
    });
  }
};
