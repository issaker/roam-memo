import { savePracticeData } from '~/queries/save';
import * as dateUtils from '~/utils/date';
import {
  SchedulingAlgorithm,
  isSpacedAlgorithm,
  Session,
} from '~/models/session';

/**
 * SM2 算法实现。
 * 字段命名遵循 {owner}_{purpose} 规范：sm2_interval, sm2_repetitions, sm2_eFactor, sm2_grade。
 */
export const supermemo = (
  item: { sm2_interval: number; sm2_repetitions: number; sm2_eFactor: number },
  sm2_grade: number
) => {
  let nextInterval;
  let nextRepetition;
  let nextEfactor;

  if (sm2_grade === 0) {
    nextInterval = 0;
    nextRepetition = 0;
  } else if (sm2_grade < 3) {
    nextInterval = 1;
    nextRepetition = 0;
  } else {
    if (item.sm2_repetitions === 0) {
      nextInterval = 1;
      nextRepetition = 1;
    } else if (item.sm2_repetitions === 1) {
      nextInterval = 6;
      nextRepetition = 2;
    } else {
      nextInterval = Math.round(item.sm2_interval * item.sm2_eFactor * (sm2_grade / 5));
      nextRepetition = item.sm2_repetitions + 1;
    }
  }

  nextEfactor = item.sm2_eFactor + (0.1 - (5 - sm2_grade) * (0.08 + (5 - sm2_grade) * 0.02));
  if (nextEfactor < 1.3) nextEfactor = 1.3;
  nextEfactor = Math.round(nextEfactor * 10000) / 10000;

  return { sm2_interval: nextInterval, sm2_repetitions: nextRepetition, sm2_eFactor: nextEfactor };
};

/**
 * Progressive 算法间隔曲线：2 → 6 → 12 → 24 → 48 → 96 天
 */
export const progressiveInterval = (progressive_repetitions: number): number => {
  if (progressive_repetitions <= 0) return 2;
  if (progressive_repetitions === 1) return 6;
  return 6 * Math.pow(2, progressive_repetitions - 1);
};

type PracticeDataResult = Session & { nextDueDateFromNow?: string };

/**
 * 核心调度函数：根据算法和交互模式计算下一次复习数据。
 *
 * Mode Independence Principle（模式独立原则）：
 * 每个算法只操作自己的字段，其他算法的字段原样传递，确保切换算法不丢失数据。
 * - SM2 路径：计算 sm2_grade, sm2_interval, sm2_repetitions, sm2_eFactor
 * - Progressive 路径：计算 progressive_repetitions, progressive_interval
 * - Fixed 路径：计算 fixed_multiplier
 * - 所有路径：原样传递其他算法的字段（含 sm2_grade）+ lbl_progress + algorithm + interaction
 *
 * 注意：sm2_grade 在 Fixed/Progressive 路径中也必须原样传递，
 * 否则 savePracticeData 重写 session block 时会丢失该字段，
 * 导致 emoji 显示异常（变为 ⚪）。
 */
export const generatePracticeData = ({
  dateCreated,
  algorithm,
  interaction,
  ...props
}: Session): PracticeDataResult => {
  const referenceDate = dateCreated || new Date();

  const useSpacedPath = isSpacedAlgorithm(algorithm);

  if (useSpacedPath) {
    const {
      sm2_grade,
      sm2_interval,
      sm2_repetitions,
      sm2_eFactor,
      progressive_repetitions,
      progressive_interval,
      fixed_multiplier,
      lbl_progress,
    } = props;
    const sm2Result = supermemo(
      { sm2_interval: sm2_interval || 0, sm2_repetitions: sm2_repetitions || 0, sm2_eFactor: sm2_eFactor || 2.5 },
      sm2_grade || 0
    );
    const nextDueDate = dateUtils.addDays(referenceDate, sm2Result.sm2_interval);

    return {
      algorithm,
      interaction,
      sm2_grade,
      sm2_repetitions: sm2Result.sm2_repetitions,
      sm2_interval: sm2Result.sm2_interval,
      sm2_eFactor: sm2Result.sm2_eFactor,
      ...(progressive_repetitions !== undefined && { progressive_repetitions }),
      ...(progressive_interval !== undefined && { progressive_interval }),
      ...(fixed_multiplier !== undefined && { fixed_multiplier }),
      ...(lbl_progress !== undefined && { lbl_progress }),
      dateCreated: referenceDate,
      nextDueDate,
      nextDueDateFromNow: dateUtils.customFromNow(nextDueDate),
    };
  }

  const {
    fixed_multiplier,
    progressive_repetitions,
    sm2_repetitions,
    sm2_eFactor,
    sm2_interval,
    sm2_grade,
    lbl_progress,
  } = props;
  let nextDueDate: Date | undefined;
  let calculatedIntervalMultiplier = fixed_multiplier;

  switch (algorithm) {
    case SchedulingAlgorithm.PROGRESSIVE: {
      const currentProgReps = progressive_repetitions || 0;
      calculatedIntervalMultiplier = progressiveInterval(currentProgReps);
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier);
      break;
    }
    case SchedulingAlgorithm.FIXED_DAYS:
      calculatedIntervalMultiplier = fixed_multiplier || 3;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier);
      break;
    case SchedulingAlgorithm.FIXED_WEEKS:
      calculatedIntervalMultiplier = fixed_multiplier || 3;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 7);
      break;
    case SchedulingAlgorithm.FIXED_MONTHS:
      calculatedIntervalMultiplier = fixed_multiplier || 3;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 30);
      break;
    case SchedulingAlgorithm.FIXED_YEARS:
      calculatedIntervalMultiplier = fixed_multiplier || 3;
      nextDueDate = dateUtils.addDays(referenceDate, calculatedIntervalMultiplier * 365);
      break;
  }

  const isProgressive = algorithm === SchedulingAlgorithm.PROGRESSIVE;

  return {
    algorithm,
    interaction,
    ...(isProgressive
      ? { progressive_interval: calculatedIntervalMultiplier }
      : { fixed_multiplier: calculatedIntervalMultiplier }),
    progressive_repetitions: isProgressive
      ? (progressive_repetitions || 0) + 1
      : progressive_repetitions,
    ...(sm2_repetitions !== undefined && { sm2_repetitions }),
    ...(sm2_eFactor !== undefined && { sm2_eFactor }),
    ...(sm2_interval !== undefined && { sm2_interval }),
    ...(sm2_grade !== undefined && { sm2_grade }),
    ...(lbl_progress !== undefined && { lbl_progress }),
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
    sm2_grade,
    sm2_interval,
    sm2_repetitions,
    sm2_eFactor,
    fixed_multiplier,
    progressive_repetitions,
    algorithm,
    interaction,
  } = practiceProps;

  const { nextDueDateFromNow, ...practiceResultData } = generatePracticeData({
    sm2_grade,
    sm2_interval,
    sm2_repetitions,
    sm2_eFactor,
    dateCreated,
    fixed_multiplier,
    progressive_repetitions,
    algorithm,
    interaction,
  });

  if (!isDryRun && !isCramming) {
    await savePracticeData({ refUid, dataPageTitle, dateCreated, ...practiceResultData });
  }

  return practiceResultData;
};

export default practice;
