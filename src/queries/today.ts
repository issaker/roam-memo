/**
 * Today's Review Calculation
 *
 * Computes which cards are due, new, and completed for the current session.
 * Pipeline: initializeToday → calculateCompletedTodayCounts → addNewCards → addDueCards
 *           → calculateCombinedCounts → limitRemainingPracticeData → calculateTodayStatus
 */
import * as dateUtils from '~/utils/date';
import { Records, RecordUid, Session } from '~/models/session';
import { CompletionStatus, RenderMode, Today, TodayInitial } from '~/models/practice';
import { generateNewSession } from '~/queries/utils';

const fisherYatesShuffle = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

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

export const calculateCompletedTodayCounts = ({ today, tagsList, sessionData }) => {
  for (const tag of tagsList) {
    let count = 0;
    const completedUids: RecordUid[] = [];

    const currentTagSessionData = sessionData[tag];
    Object.keys(currentTagSessionData).forEach((cardUid) => {
      const cardData = currentTagSessionData[cardUid];
      if (cardData?.isNew) return;
      const isCompletedToday =
        cardData && dateUtils.isSameDay(cardData.dateCreated, new Date());

      if (isCompletedToday) {
        if (cardData.interaction === 'LBL' && cardData.lbl_progress) {
          try {
            const progress = JSON.parse(cardData.lbl_progress);
            const hasDueChildren = Object.values(progress).some(
              (child: any) => child?.nextDueDate && new Date(child.nextDueDate) <= new Date()
            );
            if (hasDueChildren) return;
          } catch {
            // lbl_progress parse failed, fall through to count as completed
          }
        }

        count++;
        completedUids.push(cardUid);
      }
    });

    today.tags[tag] = {
      ...(today.tags[tag] || {}),
      completed: count,
      completedUids,
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
  pluginPageData: Records;
  shuffleCards: boolean;
}) => {
  for (const currentTag of tagsList) {
    const allSelectedTagCardsUids = cardUids[currentTag];
    let newCardsUids: RecordUid[] = [];

    allSelectedTagCardsUids.forEach((referenceId) => {
      const latestSession = pluginPageData[referenceId] as Session & { isNew?: boolean };
      if (
        !pluginPageData[referenceId] ||
        (latestSession?.isNew && !latestSession?.nextDueDate)
      ) {
        newCardsUids.push(referenceId);
        if (!pluginPageData[referenceId]) {
          pluginPageData[referenceId] = generateNewSession();
        }
      }
    });

    if (shuffleCards) {
      newCardsUids = fisherYatesShuffle(newCardsUids);
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

export const getDueCardUids = (currentTagSessionData: Records, isCramming) => {
  const results: RecordUid[] = [];
  if (!Object.keys(currentTagSessionData).length) return results;

  const now = new Date();
  Object.keys(currentTagSessionData).forEach((cardUid) => {
    const latestSession = currentTagSessionData[cardUid] as Session & { isNew?: boolean };
    if (!latestSession || latestSession?.isNew) return;

    const nextDueDate = latestSession.nextDueDate;

    if (isCramming || (nextDueDate && nextDueDate <= now)) {
      results.push(cardUid);
    }
  });

  results.sort((a, b) => {
    const aLatestSession = currentTagSessionData[a] as Session;
    const bLatestSession = currentTagSessionData[b] as Session;

    const aDueDate = aLatestSession?.nextDueDate || new Date(0);
    const bDueDate = bLatestSession?.nextDueDate || new Date(0);
    if (aDueDate.getTime() !== bDueDate.getTime()) {
      return aDueDate.getTime() - bDueDate.getTime();
    }

    // Secondary/tertiary sort uses SM2 fields (sm2_eFactor, sm2_repetitions).
    // For Fixed algorithm cards, these default to 2.5 and 0 respectively,
    // which is intentional: Fixed cards get moderate priority in the queue —
    // higher than low-urgency SM2 cards (high eFactor) but not the highest.
    const aEfactor = aLatestSession?.sm2_eFactor ?? 2.5;
    const bEfactor = bLatestSession?.sm2_eFactor ?? 2.5;
    if (aEfactor !== bEfactor) {
      return aEfactor - bEfactor;
    }

    const aReps = aLatestSession?.sm2_repetitions ?? 0;
    const bReps = bLatestSession?.sm2_repetitions ?? 0;
    return aReps - bReps;
  });

  return results;
};

export const addDueCards = ({ today, tagsList, sessionData, isCramming, shuffleCards }) => {
  for (const currentTag of tagsList) {
    const currentTagSessionData = sessionData[currentTag];
    let dueCardsUids = getDueCardUids(currentTagSessionData, isCramming);

    if (shuffleCards) {
      dueCardsUids = fisherYatesShuffle(dueCardsUids);
    }

    today.tags[currentTag] = {
      ...today.tags[currentTag],
      dueUids: dueCardsUids,
      due: dueCardsUids.length,
    };
  }
};
