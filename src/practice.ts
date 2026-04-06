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
    const { intervalMultiplier, intervalMultiplierType, repetitions } = props;
    const today = new Date();
    let nextDueDate: Date | undefined = undefined;
    
    // Progressive mode: uses SM2 algorithm with grade=4 (Good)
    if (intervalMultiplierType === IntervalMultiplierType.Progressive) {
      // Count how many times this card has been reviewed in progressive mode
      const progressiveRepetition = repetitions || 0;
      
      if (progressiveRepetition === 0) {
        nextDueDate = dateUtils.addDays(today, 2); // First time: 2 days
      } else if (progressiveRepetition === 1) {
        nextDueDate = dateUtils.addDays(today, 6); // Second time: 6 days
      } else {
        // SM2 Good algorithm (grade=4, efactor=2.5)
        const currentInterval = intervalMultiplier || 6;
        const progressiveInterval = Math.round(currentInterval * 2.5 * 0.8);
        nextDueDate = dateUtils.addDays(today, progressiveInterval);
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
      intervalMultiplier,
      intervalMultiplierType,
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
