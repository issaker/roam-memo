/**
 * Today's Review Calculation
 *
 * Computes which cards are due, new, and completed for the current session.
 * Pipeline: initializeToday → calculateCompletedTodayCounts → addNewCards → addDueCards
 *           → calculateCombinedCounts → limitRemainingPracticeData → calculateTodayStatus
 */
import * as dateUtils from '~/utils/date';
import { CompleteRecords, RecordUid, Session } from '~/models/session';
import { CompletionStatus, RenderMode, Today, TodayInitial } from '~/models/practice';
import { generateNewSession } from '~/queries/utils';

export const initializeToday = ({ tagsList, cachedData }) => {
  const today: Today = JSON.parse(JSON.stringify(TodayInitial));

  for (const tag of tagsList) {
    const cachedTagData = cachedData?.[tag];

    today.tags[tag] = {
      status: CompletionStatus.Unstarted,
      completed: 0,
      due: 0,
      new: 0,
      newUids: [],
      dueUids: [],
      completedUids: [],
      completedDue: 0,
      completedNew: 0,
      completedDueUids: [],
      completedNewUids: [],
      renderMode: cachedTagData?.renderMode || RenderMode.Normal,
    };
  }

  return today;
};

export const calculateTodayStatus = ({ today, tagsList }) => {
  for (const tag of tagsList) {
    const completed = today.tags[tag].completed;
    const remaining = today.tags[tag].new + today.tags[tag].due;

    if (remaining === 0) {
      today.tags[tag].status = CompletionStatus.Finished;
    } else if (completed > 0) {
      today.tags[tag].status = CompletionStatus.Partial;
    } else {
      today.tags[tag].status = CompletionStatus.Unstarted;
    }
  }

  const completed = today.combinedToday.completed;
  const remaining = today.combinedToday.new + today.combinedToday.due;

  if (remaining === 0) {
    today.combinedToday.status = CompletionStatus.Finished;
  } else if (completed > 0) {
    today.combinedToday.status = CompletionStatus.Partial;
  } else {
    today.combinedToday.status = CompletionStatus.Unstarted;
  }
};

export const calculateCompletedTodayCounts = async ({ today, tagsList, sessionData }) => {
  for (const tag of tagsList) {
    let count = 0;
    const completedUids: RecordUid[] = [];
    const completedDueUids: RecordUid[] = [];
    const completedNewUids: RecordUid[] = [];

    const currentTagSessionData = sessionData[tag];
    Object.keys(currentTagSessionData).forEach((cardUid) => {
      const cardData = currentTagSessionData[cardUid];
      const latestSession = cardData[cardData.length - 1];
      const isCompletedToday =
        latestSession && dateUtils.isSameDay(latestSession.dateCreated, new Date());

      if (isCompletedToday) {
        const isFirstSession = cardData.length === 1;
        const wasDueToday = !isFirstSession;
        const wasNew = isFirstSession;

        count++;
        completedUids.push(cardUid);
        if (wasDueToday) completedDueUids.push(cardUid);
        if (wasNew) completedNewUids.push(cardUid);
      }
    });

    today.tags[tag] = {
      ...(today.tags[tag] || {}),
      completed: count,
      completedUids,
      completedDueUids,
      completedNewUids,
      completedDue: completedDueUids.length,
      completedNew: completedNewUids.length,
    };
  }

  return today;
};

export const calculateCombinedCounts = ({ today, tagsList }) => {
  today.combinedToday = {
    status: CompletionStatus.Unstarted,
    due: 0,
    new: 0,
    dueUids: [],
    newUids: [],
    completed: 0,
    completedUids: [],
    completedDue: 0,
    completedDueUids: [],
    completedNew: 0,
    completedNewUids: [],
  };

  for (const tag of tagsList) {
    today.combinedToday.due += today.tags[tag].due;
    today.combinedToday.new += today.tags[tag].new;
    today.combinedToday.dueUids = today.combinedToday.dueUids.concat(today.tags[tag].dueUids);
    today.combinedToday.newUids = today.combinedToday.newUids.concat(today.tags[tag].newUids);
    today.combinedToday.completed += today.tags[tag].completed;
    today.combinedToday.completedUids = today.combinedToday.completedUids.concat(
      today.tags[tag].completedUids
    );
    today.combinedToday.completedDue += today.tags[tag].completedDue;
    today.combinedToday.completedDueUids = today.combinedToday.completedDueUids.concat(
      today.tags[tag].completedDueUids
    );
    today.combinedToday.completedNew += today.tags[tag].completedNew;
    today.combinedToday.completedNewUids = today.combinedToday.completedNewUids.concat(
      today.tags[tag].completedNewUids
    );
  }
};

export const addNewCards = ({
  today,
  tagsList,
  cardUids,
  pluginPageData,
  shuffleCards,
}: {
  today: Today;
  tagsList: string[];
  cardUids: Record<string, RecordUid[]>;
  pluginPageData: CompleteRecords;
  shuffleCards: boolean;
}) => {
  for (const currentTag of tagsList) {
    const allSelectedTagCardsUids = cardUids[currentTag];
    const newCardsUids: RecordUid[] = [];

    allSelectedTagCardsUids.forEach((referenceId) => {
      if (!pluginPageData[referenceId] || !pluginPageData[referenceId].length) {
        newCardsUids.push(referenceId);
        pluginPageData[referenceId] = [generateNewSession()];
      }
    });

    if (shuffleCards) {
      newCardsUids.sort(() => Math.random() - 0.5);
    } else {
      newCardsUids.reverse();
    }

    today.tags[currentTag] = {
      ...today.tags[currentTag],
      newUids: newCardsUids,
      new: newCardsUids.length,
    };
  }
};

export const getDueCardUids = (currentTagSessionData: CompleteRecords, isCramming) => {
  const results: RecordUid[] = [];
  if (!Object.keys(currentTagSessionData).length) return results;

  const now = new Date();
  Object.keys(currentTagSessionData).forEach((cardUid) => {
    const cardData = currentTagSessionData[cardUid] as Session[];

    const latestSession = cardData[cardData.length - 1];
    if (!latestSession) return;

    const nextDueDate = latestSession.nextDueDate;

    if (isCramming || (nextDueDate && nextDueDate <= now)) {
      results.push(cardUid);
    }
  });

  // Urgency-based three-level sort for due cards:
  //   1. nextDueDate (ascending) — more overdue cards first
  //   2. eFactor (ascending) — harder-to-remember cards first (lower eFactor = faster forgetting)
  //   3. repetitions (ascending) — less mature memories first (fewer reps = less stable)
  results.sort((a, b) => {
    const aCards = currentTagSessionData[a] as Session[];
    const aLatestSession = aCards[aCards.length - 1];
    const bCards = currentTagSessionData[b] as Session[];
    const bLatestSession = bCards[bCards.length - 1];

    // Level 1: Overdue days — earlier dueDate = more overdue = higher urgency
    const aDueDate = aLatestSession?.nextDueDate || new Date(0);
    const bDueDate = bLatestSession?.nextDueDate || new Date(0);
    if (aDueDate.getTime() !== bDueDate.getTime()) {
      return aDueDate.getTime() - bDueDate.getTime();
    }

    // Level 2: Material difficulty — lower eFactor = faster forgetting = higher urgency
    const aEfactor = aLatestSession?.eFactor ?? 2.5;
    const bEfactor = bLatestSession?.eFactor ?? 2.5;
    if (aEfactor !== bEfactor) {
      return aEfactor - bEfactor;
    }

    // Level 3: Memory maturity — fewer repetitions = less stable = higher urgency
    const aReps = aLatestSession?.repetitions ?? 0;
    const bReps = bLatestSession?.repetitions ?? 0;
    return aReps - bReps;
  });

  return results;
};

export const addDueCards = ({ today, tagsList, sessionData, isCramming, shuffleCards }) => {
  for (const currentTag of tagsList) {
    const currentTagSessionData = sessionData[currentTag];
    const dueCardsUids = getDueCardUids(currentTagSessionData, isCramming);

    if (shuffleCards) {
      dueCardsUids.sort(() => Math.random() - 0.5);
    }

    today.tags[currentTag] = {
      ...today.tags[currentTag],
      dueUids: dueCardsUids,
      due: dueCardsUids.length,
    };
  }
};

/**
 * Restores completed card UIDs back into the new/due lists.
 * Needed so that the daily limit algorithm can compute the original
 * distribution before any cards were completed.
 */
export const restoreCompletedUids = ({ today, tagsList }) => {
  for (const currentTag of tagsList) {
    today.tags[currentTag].newUids.push(...today.tags[currentTag].completedNewUids);
    today.tags[currentTag].dueUids.push(...today.tags[currentTag].completedDueUids);
    today.tags[currentTag].new = today.tags[currentTag].newUids.length;
    today.tags[currentTag].due = today.tags[currentTag].dueUids.length;
  }
};
