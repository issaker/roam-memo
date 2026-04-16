import { savePracticeData } from '~/queries';
import * as dateUtils from '~/utils/date';
import { ReviewModes, isFixedMode, Session } from '~/models/session';

/**
 * SM2 (SuperMemo 2) algorithm implementation.
 * Calculates next interval, repetition count, and easiness factor
 * based on the current state and the user's grade (0-5).
 */
export const supermemo = (
  item: { interval: number; repetition: number; efactor: number },
  grade: number
) => {
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

/**
 * Progressive interval curve — independent of SM2.
 *
 * A simple exponential growth schedule: 2 → 6 → 12 → 24 → 48 → 96 days...
 * The first two intervals are short on-ramps, then each subsequent interval
 * doubles from the 6-day base.
 *
 *   interval(progReps):
 *     0 → 2 days
 *     1 → 6 days
 *     n → 6 × 2^(n-1) days   (for n ≥ 2)
 *
 * This is a standalone function curve, not derived from SM2.
 */
export const progressiveInterval = (progressiveRepetitions: number): number => {
  if (progressiveRepetitions <= 0) return 2;
  if (progressiveRepetitions === 1) return 6;
  return 6 * Math.pow(2, progressiveRepetitions - 1);
};

type PracticeDataResult = Session & { nextDueDateFromNow?: string };

/**
 * Generate practice result data based on the review mode and current card state.
 *
 * Mode Independence Principle:
 *   Each mode only calculates/updates its OWN fields. All other fields are
 *   inherited unchanged from the previous session, ensuring that switching
 *   modes never loses data from any mode.
 *
 *   SM2 fields (calculated only by SM2 mode):
 *     grade, interval, repetitions, eFactor
 *   Progressive fields (calculated only by Progressive mode):
 *     progressiveRepetitions, intervalMultiplier
 *   Fixed interval fields (calculated by Days/Weeks/Months/Years):
 *     intervalMultiplier
 *
 *   nextDueDate is calculated by all modes and written to the session block.
 *   lineByLineProgress is managed by updateLineByLineProgress() and written
 *   to the latest session block.
 */
export const generatePracticeData = ({
  dateCreated,
  reviewMode,
  ...props
}: Session): PracticeDataResult => {
  const referenceDate = dateCreated || new Date();

  if (reviewMode === ReviewModes.SpacedInterval || reviewMode === ReviewModes.SpacedIntervalLBL) {
    const {
      grade,
      interval,
      repetitions,
      eFactor,
      progressiveRepetitions,
      intervalMultiplier,
      lineByLineProgress,
    } = props;
    const sm2Result = supermemo(
      { interval: interval || 0, repetition: repetitions || 0, efactor: eFactor || 2.5 },
      grade || 0
    );
    const nextDueDate = dateUtils.addDays(referenceDate, sm2Result.interval);

    return {
      reviewMode,
      grade,
      repetitions: sm2Result.repetition,
      interval: sm2Result.interval,
      eFactor: sm2Result.efactor,
      ...(progressiveRepetitions !== undefined && { progressiveRepetitions }),
      ...(intervalMultiplier !== undefined && { intervalMultiplier }),
      ...(lineByLineProgress !== undefined && { lineByLineProgress }),
      dateCreated: referenceDate,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  }

  const {
    intervalMultiplier,
    progressiveRepetitions,
    repetitions,
    eFactor,
    interval,
    lineByLineProgress,
  } = props;
  let nextDueDate: Date | undefined;
  let calculatedIntervalMultiplier = intervalMultiplier;

  switch (reviewMode) {
    case ReviewModes.FixedProgressive:
    case ReviewModes.FixedProgressiveLBL: {
      const currentProgReps = progressiveRepetitions || 0;
      calculatedIntervalMultiplier = progressiveInterval(currentProgReps);
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier);
      break;
    }
    case ReviewModes.FixedDays:
      calculatedIntervalMultiplier = intervalMultiplier || 3;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier);
      break;
    case ReviewModes.FixedWeeks:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 7);
      break;
    case ReviewModes.FixedMonths:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 30);
      break;
    case ReviewModes.FixedYears:
      calculatedIntervalMultiplier = intervalMultiplier || 1;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 365);
      break;
  }

  return {
    reviewMode,
    intervalMultiplier: calculatedIntervalMultiplier,
    progressiveRepetitions:
      reviewMode === ReviewModes.FixedProgressive || reviewMode === ReviewModes.FixedProgressiveLBL
        ? (progressiveRepetitions || 0) + 1
        : progressiveRepetitions,
    ...(repetitions !== undefined && { repetitions }),
    ...(eFactor !== undefined && { eFactor }),
    ...(interval !== undefined && { interval }),
    ...(lineByLineProgress !== undefined && { lineByLineProgress }),
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
    refUid,
    dataPageTitle,
    dateCreated,
    isCramming,
    grade,
    interval,
    repetitions,
    eFactor,
    intervalMultiplier,
    progressiveRepetitions,
    reviewMode,
  } = practiceProps;

  const { nextDueDateFromNow, ...practiceResultData } = generatePracticeData({
    grade,
    interval,
    repetitions,
    eFactor,
    dateCreated,
    reviewMode,
    intervalMultiplier,
    progressiveRepetitions,
  });

  if (!isDryRun && !isCramming) {
    await savePracticeData({ refUid, dataPageTitle, dateCreated, ...practiceResultData });
  }

  return practiceResultData;
};

export default practice;
