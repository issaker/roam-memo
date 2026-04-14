import * as stringUtils from '~/utils/string';
import * as dateUtils from '~/utils/date';
import { CompleteRecords, LineByLineProgressMap } from '~/models/session';
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
    case 0:
      return '🔴';
    default:
      return '🟢';
  }
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
    const existingEntryUid = getChildBlock(dataBlockUid, `((${refUid}))`);
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

  const sessionHeadingQuery = `
    [:find ?childUid ?childOrder
     :where
     [?parent :block/uid "${cardDataBlockUid}"]
     [?child :block/parents ?parent]
     [?child :block/uid ?childUid]
     [?child :block/order ?childOrder]
    ]
  `;
  let sessionHeadings = window.roamAlphaAPI.q(sessionHeadingQuery);

  if (!sessionHeadings || !sessionHeadings.length) {
    const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(new Date());
    await createChildBlock(
      cardDataBlockUid,
      `[[${dateCreatedRoamDateString}]] ⚪`,
      0,
      { open: false }
    );
    sessionHeadings = window.roamAlphaAPI.q(sessionHeadingQuery);
    if (!sessionHeadings || !sessionHeadings.length) return;
  }

  sessionHeadings.sort((a, b) => a[1] - b[1]);
  const latestSessionUid = sessionHeadings[0][0];

  const progressString = JSON.stringify(progress);
  const existingProgressBlockUid = await getChildBlock(latestSessionUid, 'lineByLineProgress::', {
    exactMatch: false,
  });

  if (existingProgressBlockUid) {
    await window.roamAlphaAPI.updateBlock({
      block: { uid: existingProgressBlockUid, string: `lineByLineProgress:: ${progressString}` },
    });
  } else {
    await createChildBlock(latestSessionUid, `lineByLineProgress:: ${progressString}`, -1);
  }

  const earliestDueDate = Object.values(progress).reduce((earliest, child) => {
    const d = new Date(child.nextDueDate);
    return !earliest || d < earliest ? d : earliest;
  }, null as Date | null);

  if (earliestDueDate) {
    const dueDateString = `[[${stringUtils.dateToRoamDateString(earliestDueDate)}]]`;
    const existingDueDateBlockUid = await getChildBlock(latestSessionUid, 'nextDueDate::', {
      exactMatch: false,
    });
    if (existingDueDateBlockUid) {
      await window.roamAlphaAPI.updateBlock({
        block: { uid: existingDueDateBlockUid, string: `nextDueDate:: ${dueDateString}` },
      });
    }
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

  const sessionHeadingQuery = `
    [:find ?childUid ?childOrder
     :where
     [?parent :block/uid "${cardDataBlockUid}"]
     [?child :block/parents ?parent]
     [?child :block/uid ?childUid]
     [?child :block/order ?childOrder]
    ]
  `;
  let sessionHeadings = window.roamAlphaAPI.q(sessionHeadingQuery);

  if (!sessionHeadings || !sessionHeadings.length) {
    const dateCreatedRoamDateString = stringUtils.dateToRoamDateString(new Date());
    await createChildBlock(
      cardDataBlockUid,
      `[[${dateCreatedRoamDateString}]] ⚪`,
      0,
      { open: false }
    );
    sessionHeadings = window.roamAlphaAPI.q(sessionHeadingQuery);
    if (!sessionHeadings || !sessionHeadings.length) return;
  }

  sessionHeadings.sort((a, b) => a[1] - b[1]);
  const latestSessionUid = sessionHeadings[0][0];

  const flagValue = enabled ? 'Y' : 'N';
  const existingFlagBlockUid = await getChildBlock(latestSessionUid, 'lineByLineReview::', {
    exactMatch: false,
  });

  if (existingFlagBlockUid) {
    await window.roamAlphaAPI.updateBlock({
      block: { uid: existingFlagBlockUid, string: `lineByLineReview:: ${flagValue}` },
    });
  } else {
    await createChildBlock(latestSessionUid, `lineByLineReview:: ${flagValue}`, -1);
  }
};
