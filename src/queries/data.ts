/**
 * Practice Data Queries
 *
 * Core data layer that reads practice session data from the Roam data page.
 *
 * Unified Data Page Structure (no meta block):
 *   roam/memo (page)
 *   ├── data (heading block)
 *   │   ├── ((cardUid1))
 *   │   │   ├── [[Date]] 🟢            ← Latest session (all fields here)
 *   │   │   │   ├── algorithm:: SM2
 *   │   │   │   ├── interaction:: NORMAL
 *   │   │   │   ├── nextDueDate:: [[Date]]
 *   │   │   │   ├── lbl_progress:: {...}
 *   │   │   │   ├── sm2_grade:: 5
 *   │   │   │   ├── sm2_eFactor:: 2.5
 *   │   │   │   └── sm2_repetitions:: 3
 *   │   │   └── [[Date]] 🔴
 *   │   │       └── ...
 *   │   └── ((cardUid2))
 *   │       └── ...
 *   ├── cache (heading block)
 *   │   └── [[tagName]]
 *   │       ├── renderMode:: normal
 *   │       └── ...
 *   └── settings (heading block)
 *       ├── tagsListString:: memo
 *       └── ...
 *
 * Key Design Principle:
 *   All fields (algorithm, interaction, nextDueDate, lineByLineProgress, grade, etc.)
 *   are stored uniformly in session blocks. The latest session block is the
 *   single source of truth for the card's current state.
 */
import { getStringBetween, parseConfigString, parseRoamDateString } from '~/utils/string';
import * as stringUtils from '~/utils/string';
import {
  CompleteRecords,
  Records,
  RecordUid,
  resolveReviewConfig,
} from '~/models/session';
import { Today } from '~/models/practice';
import {
  addDueCards,
  addNewCards,
  calculateCombinedCounts,
  calculateCompletedTodayCounts,
  calculateTodayStatus,
  initializeToday,
} from '~/queries/today';
import { generateNewSession, getChildBlocksOnPage, getDailyNoteBlockUids } from './utils';
import { DAILYNOTE_DECK_KEY } from '~/constants';

export const getPracticeData = async ({
  tagsList,
  dataPageTitle,
  dailyLimit,
  isCramming,
  shuffleCards,
  cachedData,
}) => {
  const pluginPageData = (await getPluginPageData({
    dataPageTitle,
    limitToLatest: false,
  })) as CompleteRecords;

  const today = initializeToday({ tagsList, cachedData });
  const sessionData = {};
  const cardUids: Record<string, RecordUid[]> = {};

  for (const tag of tagsList) {
    const { sessionData: currentSessionData, cardUids: currentCardUids } = await getSessionData({
      pluginPageData,
      tag,
      dataPageTitle,
    });

    sessionData[tag] = currentSessionData;
    cardUids[tag] = currentCardUids;
  }

  calculateCompletedTodayCounts({ today, tagsList, sessionData });

  addNewCards({ today, tagsList, cardUids, pluginPageData, shuffleCards });
  addDueCards({ today, tagsList, sessionData, isCramming, shuffleCards });

  limitRemainingPracticeData({ today, dailyLimit, tagsList, isCramming });
  calculateCombinedCounts({ today, tagsList });

  calculateTodayStatus({ today, tagsList });

  return {
    practiceData: pluginPageData,
    todayStats: today,
  };
};

export const getDataPageQuery = (dataPageTitle) => `[
  :find ?page
  :where
    [?page :node/title "${dataPageTitle}"]
]`;

export const dataPageReferencesIdsQuery = `[
  :find ?refUid
  :in $ ?tag ?dataPage
  :where
    [?tagPage :node/title ?tag]
    [?tagRefs :block/refs ?tagPage]
    [?tagRefs :block/uid ?refUid]
    [?tagRefs :block/page ?homePage]
    [(!= ?homePage ?dataPage)]
  ]`;

const getPageReferenceIds = async (tag, dataPageTitle): Promise<string[]> => {
  const dataPageResult = window.roamAlphaAPI.q(getDataPageQuery(dataPageTitle));
  const dataPageUid = dataPageResult.length ? dataPageResult[0][0] : '';
  const results = window.roamAlphaAPI.q(dataPageReferencesIdsQuery, tag, dataPageUid);
  return results.map((arr) => arr[0]);
};

export const getSelectedTagPageBlocksIds = async (selectedTag): Promise<string[]> => {
  const queryResults = await getChildBlocksOnPage(selectedTag);
  if (!queryResults.length) return [];

  const children = queryResults[0][0].children;
  const filteredChildren = children.filter((child) => !!child.string);
  return filteredChildren.map((arr) => arr.uid);
};

const SESSION_SNAPSHOT_KEYS = [
  'algorithm',
  'interaction',
  'nextDueDate',
  'lbl_progress',
  'sm2_repetitions',
  'sm2_interval',
  'sm2_eFactor',
  'sm2_grade',
  'progressive_repetitions',
  'progressive_interval',
  'fixed_multiplier',
] as const;

/**
 * Rebuild a full latest-session snapshot from sparse historical session blocks.
 *
 * Older data may store only the fields touched by the active mode. We merge the
 * latest known value for every mode-specific state field forward so the newest
 * session once again becomes a complete card snapshot.
 */
const mergeSessionSnapshot = (
  previousSnapshot: Record<string, any> | undefined,
  rawSession: Record<string, any>
) => {
  const nextSnapshot: Record<string, any> = {
    ...(previousSnapshot || {}),
    dateCreated: rawSession.dateCreated,
  };

  for (const key of SESSION_SNAPSHOT_KEYS) {
    if (rawSession[key] !== undefined) {
      nextSnapshot[key] = rawSession[key];
    }
  }

  const config = resolveReviewConfig(
    nextSnapshot.algorithm,
    nextSnapshot.interaction
  );
  nextSnapshot.algorithm = config.algorithm;
  nextSnapshot.interaction = config.interaction;

  return nextSnapshot;
};

const parseFieldValuesFromChildren = (object, children) => {
  for (const field of children) {
    if (!field?.string) continue;
    const [key, value] = parseConfigString(field.string);

    if (key === 'nextDueDate') {
      object[key] = parseRoamDateString(getStringBetween(value, '[[', ']]'));
    } else if (key === 'lbl_progress') {
      object[key] = value;
    } else if (key === 'algorithm') {
      object[key] = value;
    } else if (key === 'interaction') {
      object[key] = value;
    } else if (value === 'true' || value === 'false') {
      object[key] = value === 'true';
    } else if (stringUtils.isNumeric(value)) {
      object[key] = Number(value);
    } else {
      object[key] = value;
    }
  }
};

const isSessionHeadingBlock = (child) => {
  if (!child?.string) return false;
  const headingDateString = getStringBetween(child.string, '[[', ']]');
  return !!parseRoamDateString(headingDateString);
};

const parseSessionHistory = (sessionChildren, uid) => {
  if (!sessionChildren.length) {
    return [{ ...generateNewSession(), refUid: uid }];
  }

  const sortedSessionChildren = [...sessionChildren].sort((a, b) => b.order - a.order);
  const normalizedSessions: Record<string, any>[] = [];
  let previousSnapshot: Record<string, any> | undefined = undefined;

  for (const child of sortedSessionChildren) {
    if (!child?.string) continue;

    const rawRecord = {
      refUid: uid,
      dateCreated: parseRoamDateString(getStringBetween(child.string, '[[', ']]')),
    };

    if (child.children) {
      parseFieldValuesFromChildren(rawRecord, child.children);
    }

    const normalizedRecord = mergeSessionSnapshot(previousSnapshot, rawRecord);
    normalizedSessions.push(normalizedRecord);
    previousSnapshot = normalizedRecord;
  }

  return normalizedSessions;
};

const mapPluginPageDataLatest = (queryResultsData): Records =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      if (!cur?.string) return acc;
      const uid = getStringBetween(cur.string, '((', '))');
      const sessionChildren = cur.children?.filter(isSessionHeadingBlock) || [];

      const normalizedSessions = parseSessionHistory(sessionChildren, uid);
      acc[uid] = normalizedSessions[normalizedSessions.length - 1];

      return acc;
    }, {}) || {};

const mapPluginPageData = (queryResultsData): CompleteRecords =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      if (!cur?.string) return acc;
      const uid = getStringBetween(cur.string, '((', '))');
      const sessionChildren = cur.children?.filter(isSessionHeadingBlock) || [];
      acc[uid] = parseSessionHistory(sessionChildren, uid);

      return acc;
    }, {}) || {};

export const getPluginPageBlockDataQuery = `[
  :find (pull ?pluginPageChildren [
    :block/string
    :block/children
    :block/order
    {:block/children ...}])
    :in $ ?pageTitle ?dataBlockName
    :where
    [?page :node/title ?pageTitle]
    [?page :block/children ?pluginPageChildren]
    [?pluginPageChildren :block/string ?dataBlockName]
  ]`;

const getPluginPageBlockData = async ({ dataPageTitle, blockName }) => {
  return await window.roamAlphaAPI.q(getPluginPageBlockDataQuery, dataPageTitle, blockName);
};

export const getPluginPageData = async ({ dataPageTitle, limitToLatest = true }) => {
  const queryResultsData = await getPluginPageBlockData({ dataPageTitle, blockName: 'data' });

  if (!queryResultsData.length) return {};

  return limitToLatest
    ? mapPluginPageDataLatest(queryResultsData)
    : mapPluginPageData(queryResultsData);
};

const mapPluginPageCachedData = (queryResultsData) => {
  const data = queryResultsData.map((arr) => arr[0])[0].children;
  if (!data?.length) return {};

  return (
    data.reduce((acc, cur) => {
      if (!cur?.string) return acc;
      const tag = getStringBetween(cur.string, '[[', ']]');
      acc[tag] =
        cur.children?.reduce((acc, cur) => {
          if (!cur.string) return acc;
          const [key, value] = cur.string.split('::').map((s: string) => s.trim());

          const date = parseRoamDateString(value);
          acc[key] = date ? date : value;

          return acc;
        }, {}) || {};
      return acc;
    }, {}) || {}
  );
};

export const getPluginPageCachedData = async ({ dataPageTitle }) => {
  const queryResultsData = await getPluginPageBlockData({ dataPageTitle, blockName: 'cache' });

  if (!queryResultsData.length) return {};

  return mapPluginPageCachedData(queryResultsData);
};

export const getSessionData = async ({
  pluginPageData,
  tag,
  dataPageTitle,
}: {
  pluginPageData: CompleteRecords;
  tag: string;
  dataPageTitle: string;
}) => {
  let allTagCardsUids: string[];

  if (tag === DAILYNOTE_DECK_KEY) {
    allTagCardsUids = await getDailyNoteBlockUids();
  } else {
    const tagReferencesIds = await getPageReferenceIds(tag, dataPageTitle);
    const tagPageBlocksIds = await getSelectedTagPageBlocksIds(tag);
    allTagCardsUids = tagReferencesIds.concat(tagPageBlocksIds);
  }

  const allTagCardsUidsSet = new Set(allTagCardsUids);

  const selectedTagCardsData = Object.keys(pluginPageData).reduce((acc, cur) => {
    if (allTagCardsUidsSet.has(cur)) {
      acc[cur] = pluginPageData[cur];
    }
    return acc;
  }, {});

  return {
    sessionData: selectedTagCardsData,
    cardUids: allTagCardsUids,
  };
};

/**
 * Daily limit enforcement: ensures ~25% new cards, rest due cards.
 * Round-robin across decks for fair distribution.
 * Skipped when cramming (no limit) or dailyLimit is 0.
 *
 * The remaining limit is `dailyLimit - totalCompleted`: completed cards
 * reduce the pool without needing to restore them into the UID lists.
 */
const limitRemainingPracticeData = ({
  today,
  dailyLimit,
  tagsList,
  isCramming,
}: {
  today: Today;
  dailyLimit: number;
  tagsList: string[];
  isCramming: boolean;
}) => {
  const totalCompleted = tagsList.reduce(
    (sum, tag) => sum + today.tags[tag].completed,
    0
  );
  const totalDueAvailable = tagsList.reduce(
    (sum, tag) => sum + today.tags[tag].dueUids.length,
    0
  );
  const totalNewAvailable = tagsList.reduce(
    (sum, tag) => sum + today.tags[tag].newUids.length,
    0
  );
  const totalRemaining = totalDueAvailable + totalNewAvailable;

  if (!dailyLimit || !totalRemaining || isCramming) {
    return;
  }

  const remainingLimit = Math.max(dailyLimit - totalCompleted, 0);

  if (remainingLimit === 0) {
    for (const tag of tagsList) {
      today.tags[tag] = {
        ...today.tags[tag],
        dueUids: [],
        newUids: [],
        due: 0,
        new: 0,
      };
    }
    return;
  }

  if (totalRemaining <= remainingLimit) {
    return;
  }

  const selectedCards = tagsList.reduce(
    (acc, currentTag) => ({
      ...acc,
      [currentTag]: {
        newUids: [],
        dueUids: [],
      },
    }),
    {}
  );

  const targetNewCardsRatio = 0.25;
  const targetNewCards =
    remainingLimit === 1 ? 0 : Math.max(1, Math.floor(remainingLimit * targetNewCardsRatio));
  const targetDueCards = remainingLimit - targetNewCards;

  let totalNewAdded = 0;
  let totalDueAdded = 0;

  roundRobinLoop: while (totalNewAdded + totalDueAdded < totalRemaining) {
    let addedInThisRound = false;
    for (const currentTag of tagsList) {
      if (totalNewAdded + totalDueAdded === remainingLimit) {
        break roundRobinLoop;
      }

      const currentCards = selectedCards[currentTag];
      const nextNewIndex = currentCards.newUids.length;
      const nextNewCard = today.tags[currentTag].newUids[nextNewIndex];
      const nextDueIndex = currentCards.dueUids.length;
      const nextDueCard = today.tags[currentTag].dueUids[nextDueIndex];

      const stillNeedNewCards = totalNewAdded < targetNewCards;
      const stillNeedDueCards = totalDueAdded < targetDueCards;
      const stillHaveDueCards = !!nextDueCard || totalDueAdded < totalDueAvailable;
      const stillHaveNewCards = !!nextNewCard || totalNewAdded < totalNewAvailable;

      if (nextNewCard && (stillNeedNewCards || !stillHaveDueCards)) {
        selectedCards[currentTag].newUids.push(today.tags[currentTag].newUids[nextNewIndex]);
        totalNewAdded++;
        addedInThisRound = true;
        continue;
      }

      if (nextDueCard && (stillNeedDueCards || !stillHaveNewCards)) {
        selectedCards[currentTag].dueUids.push(today.tags[currentTag].dueUids[nextDueIndex]);
        totalDueAdded++;
        addedInThisRound = true;
        continue;
      }
    }

    if (!addedInThisRound) {
      break;
    }
  }

  for (const tag of tagsList) {
    today.tags[tag] = {
      ...today.tags[tag],
      dueUids: selectedCards[tag].dueUids,
      newUids: selectedCards[tag].newUids,
      due: selectedCards[tag].dueUids.length,
      new: selectedCards[tag].newUids.length,
    };
  }
};
