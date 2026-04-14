import { savePracticeData } from '~/queries';
import * as dateUtils from '~/utils/date';
import { ReviewModes, isFixedMode, Session } from '~/models/session';

export const supermemo = (item: { interval: number; repetition: number; efactor: number }, grade: number) => {
  let nextInterval;
  let nextRepetition;
  let nextEfactor;

  if (grade === 0) {
    nextInterval = 0;
    nextRepetition = 0;
  } else if (grade < 3) {
    nextInterval = 1;
    nextRepetition = 0;
  } else {
    if (item.repetition === 0) {
      nextInterval = 1;
      nextRepetition = 1;
    } else if (item.repetition === 1) {
      nextInterval = 6;
      nextRepetition = 2;
    } else {
      nextInterval = Math.round(item.interval * item.efactor * (grade / 5));
      nextRepetition = item.repetition + 1;
    }
  }

  nextEfactor = item.efactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  if (nextEfactor < 1.3) nextEfactor = 1.3;

  return { interval: nextInterval, repetition: nextRepetition, efactor: nextEfactor };
};

type PracticeDataResult = Session & { nextDueDateFromNow?: string };

export const generatePracticeData = ({ dateCreated, reviewMode, ...props }: Session): PracticeDataResult => {
  const { lineByLineReview, lineByLineProgress } = props;
  const shared = { reviewMode, lineByLineReview, lineByLineProgress };
  const today = new Date();

  if (reviewMode === ReviewModes.SpacedInterval || reviewMode === ReviewModes.SpacedIntervalLBL) {
    const { grade, interval, repetitions, eFactor } = props;
    const sm2Result = supermemo(
      { interval: interval || 0, repetition: repetitions || 0, efactor: eFactor || 2.5 },
      grade || 0
    );
    const nextDueDate = dateUtils.addDays(dateCreated, sm2Result.interval);

    return {
      ...shared,
      reviewMode,
      grade,
      repetitions: sm2Result.repetition,
      interval: sm2Result.interval,
      eFactor: sm2Result.efactor,
      dateCreated,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  }

  const { intervalMultiplier, progressiveRepetitions, repetitions, eFactor, interval: prevInterval } = props;
  let nextDueDate: Date | undefined;
  let calculatedIntervalMultiplier = intervalMultiplier;

  switch (reviewMode) {
    case ReviewModes.FixedProgressive: {
      const progReps = progressiveRepetitions || 0;
      if (progReps === 0) {
        nextDueDate = dateUtils.addDays(today, 2);
        calculatedIntervalMultiplier = 2;
      } else if (progReps === 1) {
        nextDueDate = dateUtils.addDays(today, 6);
        calculatedIntervalMultiplier = 6;
      } else {
        calculatedIntervalMultiplier = Math.round(6 * Math.pow(2, progReps - 2));
        nextDueDate = dateUtils.addDays(today, calculatedIntervalMultiplier);
      }
      break;
    }
    case ReviewModes.FixedDays:
      calculatedIntervalMultiplier = intervalMultiplier || 3;
      nextDueDate = dateUtils.addDays(today, calculatedIntervalMultiplier);
      break;
    case ReviewModes.FixedWeeks:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(today, calculatedIntervalMultiplier * 7);
      break;
    case ReviewModes.FixedMonths:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(today, calculatedIntervalMultiplier * 30);
      break;
    case ReviewModes.FixedYears:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(today, calculatedIntervalMultiplier * 365);
      break;
  }

  return {
    ...shared,
    reviewMode,
    intervalMultiplier: calculatedIntervalMultiplier,
    progressiveRepetitions: reviewMode === ReviewModes.FixedProgressive
      ? (progressiveRepetitions || 0) + 1
      : progressiveRepetitions,
    repetitions: (repetitions || 0) + 1,
    eFactor: eFactor || 2.5,
    interval: prevInterval || 0,
    nextDueDate,
    nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
  };
};

export type PracticeProps = Session & {
  refUid: string;
  dataPageTitle: string;
  isCramming?: boolean;
};

const practice = async (practiceProps: PracticeProps, isDryRun = false) => {
  const {
    refUid, dataPageTitle, dateCreated, isCramming,
    grade, interval, repetitions, eFactor,
    intervalMultiplier, progressiveRepetitions,
    reviewMode, lineByLineReview, lineByLineProgress,
  } = practiceProps;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nextDueDateFromNow, ...practiceResultData } = generatePracticeData({
    grade, interval, repetitions, eFactor, dateCreated, reviewMode,
    intervalMultiplier, progressiveRepetitions, lineByLineReview, lineByLineProgress,
  });

  if (!isDryRun && !isCramming) {
    await savePracticeData({ refUid, dataPageTitle, dateCreated, ...practiceResultData });
  }

  return practiceResultData;
};

export default practice;
