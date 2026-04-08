import { savePracticeData } from '~/queries';
import * as dateUtils from '~/utils/date';
import { IntervalMultiplierType, ReviewModes, Session } from '~/models/session';

export const supermemo = (item, grade) => {
  let nextInterval;
  let nextRepetition;
  let nextEfactor;

  if (grade === 0) {
    // If we completely forgot we should review again ASAP.
    nextInterval = 0;
    nextRepetition = 0;
  } else if (grade < 3) {
    nextInterval = 1;
    nextRepetition = 0;
  } else {
    // grade >= 3
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
  const shared = {
    reviewMode,
  };

  if (reviewMode === ReviewModes.FixedInterval) {
    const { intervalMultiplier, intervalMultiplierType, repetitions, progressiveRepetitions } = props;
    const today = new Date();
    let nextDueDate: Date | undefined = undefined;
    // calculatedIntervalMultiplier: For Progressive mode, this stores the ACTUAL next review interval
    // (same as what UI displays via nextDueDateFromNow). Used for data persistence and reference.
    let calculatedIntervalMultiplier = intervalMultiplier; // Default to input value
    
    // Progressive mode: uses SM2 algorithm with grade=4 (Good)
    if (intervalMultiplierType === IntervalMultiplierType.Progressive) {
      // Use separate counter for Progressive mode to avoid interference
      const progReps = progressiveRepetitions || 0;
      
      if (progReps === 0) {
        nextDueDate = dateUtils.addDays(today, 2); // First time: 2 days
        calculatedIntervalMultiplier = 2; // Actual next review interval
      } else if (progReps === 1) {
        nextDueDate = dateUtils.addDays(today, 6); // Second time: 6 days
        calculatedIntervalMultiplier = 6; // Actual next review interval
      } else {
        // Calculate expected interval based solely on progressiveRepetitions
        // Standard sequence: 2, 6, 12, 24, 48, 96...
        // Formula for progReps >= 2: expectedInterval = 6 × 2^(progReps - 2)
        // This ensures Progressive mode is independent of manual interval settings
        const expectedInterval = 6 * Math.pow(2, progReps - 2);
        
        // Apply 2x growth factor for next review interval
        const progressiveInterval = Math.round(expectedInterval * 2.0);
        nextDueDate = dateUtils.addDays(today, progressiveInterval);
        
        // Save the actual next review interval (matches UI display)
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

    // call supermemo API
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
    dateCreated = null,
    isCramming,
    grade,
    interval,
    repetitions,
    eFactor,
    intervalMultiplier,
    intervalMultiplierType,
    reviewMode,
  } = practiceProps;

  // Just destructuring nextDueDateFromNow here because I don't want to store it
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
