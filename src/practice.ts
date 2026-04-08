/**
 * Spaced Repetition Algorithm
 *
 * Two review modes:
 *
 * 1. Spaced Interval (SM2-based):
 *    Grades: Forgot(0), Hard(2), Good(4), Perfect(5)
 *    Interval = previous_interval × eFactor × (grade/5)
 *    eFactor always updated; clamped to min 1.3
 *    Grade 0 → review again today (interval=0)
 *    Grades 1-2 → review tomorrow (interval=1)
 *
 * 2. Fixed Interval (Progressive Reading):
 *    Progressive: 2→6→12→24→48→96... days (automatic exponential growth)
 *    Days/Weeks/Months/Years: manual fixed intervals
 */
import { savePracticeData } from '~/queries';
import * as dateUtils from '~/utils/date';
import { IntervalMultiplierType, ReviewModes, Session } from '~/models/session';

export const supermemo = (item, grade) => {
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

  return {
    interval: nextInterval,
    repetition: nextRepetition,
    efactor: nextEfactor,
  };
};

type PracticeDataResult = Session & {
  nextDueDateFromNow?: string;
};

export const generatePracticeData = ({
  dateCreated,
  reviewMode,
  ...props
}: Session): PracticeDataResult => {
  const shared = { reviewMode };

  if (reviewMode === ReviewModes.FixedInterval) {
    const { intervalMultiplier, intervalMultiplierType, repetitions, progressiveRepetitions } = props;
    const today = new Date();
    let nextDueDate: Date | undefined = undefined;
    let calculatedIntervalMultiplier = intervalMultiplier;

    if (intervalMultiplierType === IntervalMultiplierType.Progressive) {
      const progReps = progressiveRepetitions || 0;

      if (progReps === 0) {
        nextDueDate = dateUtils.addDays(today, 2);
        calculatedIntervalMultiplier = 2;
      } else if (progReps === 1) {
        nextDueDate = dateUtils.addDays(today, 6);
        calculatedIntervalMultiplier = 6;
      } else {
        const expectedInterval = 6 * Math.pow(2, progReps - 2);
        const progressiveInterval = Math.round(expectedInterval * 2.0);
        nextDueDate = dateUtils.addDays(today, progressiveInterval);
        calculatedIntervalMultiplier = progressiveInterval;
      }
    } else if (intervalMultiplierType === IntervalMultiplierType.Days) {
      nextDueDate = dateUtils.addDays(today, intervalMultiplier || 3);
    } else if (intervalMultiplierType === IntervalMultiplierType.Weeks) {
      nextDueDate = dateUtils.addDays(today, (intervalMultiplier || 1) * 7);
    } else if (intervalMultiplierType === IntervalMultiplierType.Months) {
      nextDueDate = dateUtils.addDays(today, (intervalMultiplier || 1) * 30);
    } else if (intervalMultiplierType === IntervalMultiplierType.Years) {
      nextDueDate = dateUtils.addDays(today, (intervalMultiplier || 1) * 365);
    }

    return {
      ...shared,
      reviewMode: ReviewModes.FixedInterval,
      intervalMultiplier: calculatedIntervalMultiplier,
      intervalMultiplierType,
      progressiveRepetitions: intervalMultiplierType === IntervalMultiplierType.Progressive
        ? (progressiveRepetitions || 0) + 1
        : progressiveRepetitions,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  } else {
    const { grade, interval, repetitions, eFactor } = props;
    const supermemoInput = {
      interval,
      repetition: repetitions,
      efactor: eFactor,
    };

    const supermemoResults = supermemo(supermemoInput, grade);

    const nextDueDate = dateUtils.addDays(dateCreated, supermemoResults.interval);

    return {
      ...shared,
      reviewMode: ReviewModes.DefaultSpacedInterval,
      grade,
      repetitions: supermemoResults.repetition,
      interval: supermemoResults.interval,
      eFactor: supermemoResults.efactor,
      dateCreated,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  }
};

export type PracticeProps = Session & {
  refUid: string;
  dataPageTitle: string;
  isCramming?: boolean;
};

const practice = async (practiceProps: PracticeProps, isDryRun = false) => {
  const {
    refUid,
    dataPageTitle,
    dateCreated = undefined,
    isCramming,
    grade,
    interval,
    repetitions,
    eFactor,
    intervalMultiplier,
    intervalMultiplierType,
    reviewMode,
  } = practiceProps;

  // nextDueDateFromNow is display-only, not persisted
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { nextDueDateFromNow, ...practiceResultData } = generatePracticeData({
    grade,
    interval,
    repetitions,
    eFactor,
    dateCreated,
    reviewMode,
    intervalMultiplier,
    intervalMultiplierType,
  });

  if (!isDryRun && !isCramming) {
    await savePracticeData({
      refUid: refUid,
      dataPageTitle,
      dateCreated,
      ...practiceResultData,
    });
  }

  return practiceResultData;
};

export default practice;
