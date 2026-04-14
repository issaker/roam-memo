/**
 * Practice Data Queries
 *
 * Core data layer that reads/writes practice session data from the Roam data page.
 *
 * Data Page Structure:
 *   roam/memo (page)
 *   ├── data (heading block)
 *   │   ├── ((cardUid1))
 *   │   │   ├── meta                    ← Card-level persistent data (SINGLE SOURCE OF TRUTH)
 *   │   │   │   ├── reviewMode:: SPACED_INTERVAL
 *   │   │   │   ├── lineByLineReview:: Y
 *   │   │   │   ├── lineByLineProgress:: {...}
 *   │   │   │   └── nextDueDate:: [[Date]]
 *   │   │   ├── [[Date]] 🟢            ← Session record (emoji = grade)
 *   │   │   │   ├── nextDueDate:: [[Date]]
 *   │   │   │   ├── grade:: 5
 *   │   │   │   ├── eFactor:: 2.5
 *   │   │   │   └── repetitions:: 3
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
 *   reviewMode lives ONLY in the meta block. Session records contain
 *   algorithm-specific parameters (grade, interval, eFactor, etc.) but
 *   NOT reviewMode. When reading data, reviewMode is merged from meta
 *   into the Session object for convenience, but meta is the authority.
 */
import { getStringBetween, parseConfigString, parseRoamDateString } from '~/utils/string';
import * as stringUtils from '~/utils/string';
import { CompleteRecords, Records, RecordUid, ReviewModes, resolveReviewMode } from '~/models/session';
import { Today } from '~/models/practice';
import {
  addDueCards,
  addNewCards,
  calculateCombinedCounts,
  calculateCompletedTodayCounts,
  calculateTodayStatus,
  initializeToday,
  restoreCompletedUids,
} from '~/queries/today';
import { generateNewSession, getChildBlocksOnPage } from './utils';

import { CARD_META_BLOCK_NAME } from '~/constants';

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

  calculateCombinedCounts({ today, tagsList });
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

const SPACED_MODE_KEYS = ['grade', 'repetitions', 'interval', 'eFactor'] as const;
const FIXED_MODE_KEYS = [
  'intervalMultiplier',
  'intervalMultiplierType',
  'progressiveRepetitions',
] as const;

/**
 * Infer reviewMode from session field patterns (for legacy data without meta blocks).
 * If reviewMode is explicitly set, resolve it. Otherwise, guess from field presence:
 * - SM2 fields (grade, repetitions, interval, eFactor) → SpacedInterval
 * - Fixed fields (intervalMultiplier, progressiveRepetitions) → FixedProgressive
 */
export const inferReviewModeFromFields = (fields: Partial<{ reviewMode: string; intervalMultiplierType: string } & Record<string, any>>) => {
  if (fields.reviewMode) {
    return resolveReviewMode(fields.reviewMode, fields.intervalMultiplierType);
  }

  if (SPACED_MODE_KEYS.some((key) => fields[key] !== undefined)) {
    return ReviewModes.SpacedInterval;
  }

  if (FIXED_MODE_KEYS.some((key) => fields[key] !== undefined)) {
    return ReviewModes.FixedProgressive;
  }

  return ReviewModes.FixedProgressive;
};

const parseFieldValuesFromChildren = (
  object,
  children,
) => {
  for (const field of children) {
    if (!field?.string) continue;
    const [key, value] = parseConfigString(field.string);

    if (key === 'nextDueDate') {
      object[key] = parseRoamDateString(getStringBetween(value, '[[', ']]'));
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

const isCardMetaBlock = (child) => child?.string === CARD_META_BLOCK_NAME;

/**
 * Read card-scoped fields from the meta block.
 * After migration, all cards should have a meta block with reviewMode.
 * Cards without a meta block will return empty fields.
 */
const getCardScopedFields = (children: any[] = []) => {
  const cardScopedFields: Record<string, any> = {};
  const cardMetaBlock = children.find(isCardMetaBlock) as { children?: any[] } | undefined;

  if (!cardMetaBlock?.children) return cardScopedFields;

  const metaChildren = cardMetaBlock.children.filter(c => c?.string);
  if (metaChildren.length) {
    parseFieldValuesFromChildren(cardScopedFields, metaChildren);
  }

  return cardScopedFields;
};

const mapPluginPageDataLatest = (queryResultsData): Records =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      if (!cur?.string) return acc;
      const uid = getStringBetween(cur.string, '((', '))');
      const sessionChildren = cur.children?.filter(isSessionHeadingBlock) || [];
      const cardScopedFields = getCardScopedFields(cur.children);

      if (!sessionChildren.length) {
        acc[uid] = {
          ...generateNewSession(),
          ...cardScopedFields,
        };
        return acc;
      }

      const latestChild = sessionChildren.reduce((min, cur) =>
        cur && cur.order < min.order ? cur : min
      );
      acc[uid] = {};
      acc[uid].dateCreated = latestChild?.string
        ? parseRoamDateString(getStringBetween(latestChild.string, '[[', ']]'))
        : undefined;

      if (!latestChild?.children) return acc;
      parseFieldValuesFromChildren(acc[uid], latestChild.children);
      Object.assign(acc[uid], cardScopedFields);

      return acc;
    }, {}) || {};

const mapPluginPageData = (queryResultsData): CompleteRecords =>
  queryResultsData
    .map((arr) => arr[0])[0]
    .children?.reduce((acc, cur) => {
      if (!cur?.string) return acc;
      const uid = getStringBetween(cur.string, '((', '))');
      const sessionChildren = cur.children?.filter(isSessionHeadingBlock) || [];
      const cardScopedFields = getCardScopedFields(cur.children);
      acc[uid] = [];

      if (!sessionChildren.length) {
        acc[uid].push({
          ...generateNewSession(),
          ...cardScopedFields,
        });
        return acc;
      }

      // Sort sessions by block order descending (highest order = oldest first,
      // order 0 = newest last) so that sessions[sessions.length - 1] is the
      // latest session — consistent with mapPluginPageDataLatest and downstream
      // consumers (useCurrentCardData, today.ts, etc.).
      const sortedSessionChildren = [...sessionChildren].sort(
        (a, b) => b.order - a.order
      );

      for (const child of sortedSessionChildren) {
        if (!child?.string) continue;
        const record = {
          refUid: uid,
          dateCreated: parseRoamDateString(getStringBetween(child.string, '[[', ']]')),
        };

        if (!child.children) {
          Object.assign(record, cardScopedFields);
          acc[uid].push(record);
          continue;
        }

        parseFieldValuesFromChildren(record, child.children);
        Object.assign(record, cardScopedFields);

        acc[uid].push(record);
      }

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
  const tagReferencesIds = await getPageReferenceIds(tag, dataPageTitle);
  const tagPageBlocksIds = await getSelectedTagPageBlocksIds(tag);
  const allTagCardsUids = tagReferencesIds.concat(tagPageBlocksIds);

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
  const totalCards = today.combinedToday.due + today.combinedToday.new;

  if (!dailyLimit || !totalCards || isCramming) {
    return;
  }

  restoreCompletedUids({ today, tagsList });

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
  const targetTotalCards = dailyLimit;
  const targetNewCards =
    targetTotalCards === 1 ? 0 : Math.max(1, Math.floor(targetTotalCards * targetNewCardsRatio));
  const targetDueCards = targetTotalCards - targetNewCards;

  let totalNewAdded = 0;
  let totalDueAdded = 0;
  let totalAdded = totalNewAdded + totalDueAdded;

  roundRobinLoop: while (totalAdded < totalCards) {
    for (const currentTag of tagsList) {
      totalAdded = totalNewAdded + totalDueAdded;

      if (totalAdded === targetTotalCards) {
        break roundRobinLoop;
      }

      const currentCards = selectedCards[currentTag];
      const nextNewIndex = currentCards.newUids.length;
      const nextNewCard = today.tags[currentTag].newUids[nextNewIndex];
      const nextDueIndex = currentCards.dueUids.length;
      const nextDueCard = today.tags[currentTag].dueUids[nextDueIndex];

      const stillNeedNewCards = totalNewAdded < targetNewCards;
      const stillNeedDueCards = totalDueAdded < targetDueCards;
      const stillHaveDueCards = !!nextDueCard || totalDueAdded < today.combinedToday.due;
      const stillHaveNewCards = !!nextNewCard || totalNewAdded < today.combinedToday.new;

      if (nextNewCard && (stillNeedNewCards || !stillHaveDueCards)) {
        selectedCards[currentTag].newUids.push(today.tags[currentTag].newUids[nextNewIndex]);
        totalNewAdded++;
        continue;
      }

      if (nextDueCard && (stillNeedDueCards || !stillHaveNewCards)) {
        selectedCards[currentTag].dueUids.push(today.tags[currentTag].dueUids[nextDueIndex]);
        totalDueAdded++;
        continue;
      }
    }
  }

  for (const tag of tagsList) {
    const tagStats = today.tags[tag];
    const completedDueUids = tagStats.completedDueUids;
    const completedNewUids = tagStats.completedNewUids;
    const remainingTargetDue = Math.max(
      selectedCards[tag].dueUids.length - completedDueUids.length,
      0
    );
    const remainingTargetNew = Math.max(
      selectedCards[tag].newUids.length - completedNewUids.length,
      0
    );

    selectedCards[tag].dueUids = selectedCards[tag].dueUids.slice(0, remainingTargetDue);
    selectedCards[tag].newUids = selectedCards[tag].newUids.slice(0, remainingTargetNew);
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
