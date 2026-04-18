/**
 * LBL (Line by Line) 逐行复习 Hook。
 *
 * LBL 的行为完全由算法决定：
 * - LBL + SM2: 每行子 block 用 SM2 打分（Forgot/Hard/Good/Perfect），Forgot 触发插队
 * - LBL + Progressive/Fixed: 每行子 block 只显示 Next 按钮，点击后插队 N 张再读下一行
 *
 * 算法独立原则：
 * - 每个算法只操作自己的字段，其他算法字段原样传递
 * - sessionOverrides 必须包含 algorithm 和 interaction，确保插队后卡片模式不丢失
 */
import * as React from 'react';
import { LineByLineProgressMap, SchedulingAlgorithm, InteractionStyle, isFixedAlgorithm } from '~/models/session';
import { updateLineByLineProgress } from '~/queries';
import { progressiveInterval, supermemo } from '~/practice';
import * as dateUtils from '~/utils/date';

/**
 * 判断 LBL + Fixed 算法下是否应插队。
 * 条件：lblNextReinsertOffset > 0 且当前子 block 不是最后一个（最后一个无需插队）。
 */
export const shouldReinsertLblCard = ({
  currentChildIndex,
  totalChildren,
  lblNextReinsertOffset,
}: {
  currentChildIndex: number;
  totalChildren: number;
  lblNextReinsertOffset: number;
}) => lblNextReinsertOffset > 0 && currentChildIndex < totalChildren - 1;

const parseLineByLineProgress = (progressStr?: string): LineByLineProgressMap => {
  if (!progressStr) return {};
  try {
    return JSON.parse(progressStr);
  } catch {
    return {};
  }
};

interface UseLineByLineReviewInput {
  currentCardRefUid: string | undefined;
  childUidsList: string[];
  isLBLReviewMode: boolean;
  isLBLReview: boolean;
  dataPageTitle: string;
  lblNextReinsertOffset: number;
  forgotReinsertOffset: number;
  currentIndex: number;
  currentCardData: any;
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
  setSessionOverrides: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
  setShowAnswers: React.Dispatch<React.SetStateAction<boolean>>;
  setCardQueue: React.Dispatch<React.SetStateAction<string[]>>;
  lineByLineProgressStr?: string;
}

interface UseLineByLineReviewOutput {
  lineByLineRevealedCount: number;
  lineByLineCurrentChildIndex: number;
  lineByLineIsCardComplete: boolean;
  lineByLineProgress: LineByLineProgressMap;
  onLineByLineGrade: (grade: number) => void;
  onLineByLineShowAnswer: () => void;
}

export default function useLineByLineReview({
  currentCardRefUid,
  childUidsList,
  isLBLReviewMode,
  isLBLReview,
  dataPageTitle,
  lblNextReinsertOffset,
  forgotReinsertOffset,
  currentIndex,
  currentCardData,
  algorithm,
  interaction,
  setSessionOverrides,
  setCurrentIndex,
  setShowAnswers,
  setCardQueue,
  lineByLineProgressStr,
}: UseLineByLineReviewInput): UseLineByLineReviewOutput {
  const isLblNext = isFixedAlgorithm(algorithm);
  const lineByLineProgress = React.useMemo(
    () => parseLineByLineProgress(lineByLineProgressStr),
    [lineByLineProgressStr]
  );

  const [lineByLineRevealedCount, setLineByLineRevealedCount] = React.useState(0);
  const [lineByLineCurrentChildIndex, setLineByLineCurrentChildIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isLBLReviewMode || !childUidsList.length) {
      setLineByLineRevealedCount(0);
      setLineByLineCurrentChildIndex(0);
      return;
    }

    const now = new Date();
    let firstDueIndex = childUidsList.length;
    for (let i = 0; i < childUidsList.length; i++) {
      const uid = childUidsList[i];
      const childData = lineByLineProgress[uid];
      if (!childData) {
        firstDueIndex = i;
        break;
      }
      if (new Date(childData.nextDueDate) <= now) {
        firstDueIndex = i;
        break;
      }
    }
    setLineByLineCurrentChildIndex(firstDueIndex);
    if (isLblNext) {
      setLineByLineRevealedCount(firstDueIndex + 1);
    } else {
      setLineByLineRevealedCount(firstDueIndex);
    }
  }, [isLBLReviewMode, isLblNext, currentCardRefUid, childUidsList, lineByLineProgress]);

  const lineByLineIsCardComplete =
    isLBLReviewMode && lineByLineCurrentChildIndex >= childUidsList.length;

  const onLineByLineGrade = React.useCallback(
    async (grade: number) => {
      if (!currentCardRefUid || lineByLineCurrentChildIndex >= childUidsList.length) return;

      const childUid = childUidsList[lineByLineCurrentChildIndex];

      if (isLblNext) {
        const existingData = lineByLineProgress[childUid];
        const progReps = existingData?.progressive_repetitions || 0;
        const nextInterval = progressiveInterval(progReps);

        const now = new Date();
        const childNextDueDate = dateUtils.addDays(now, nextInterval);

        const updatedProgress: LineByLineProgressMap = {
          ...lineByLineProgress,
          [childUid]: {
            nextDueDate: childNextDueDate.toISOString(),
            sm2_interval: existingData?.sm2_interval,
            sm2_repetitions: existingData?.sm2_repetitions,
            sm2_eFactor: existingData?.sm2_eFactor,
            progressive_repetitions: progReps + 1,
          },
        };

        const hasUnreadChildren = Object.keys(updatedProgress).length < childUidsList.length;

        await updateLineByLineProgress({
          refUid: currentCardRefUid,
          dataPageTitle,
          progress: updatedProgress,
          totalChildren: childUidsList.length,
        });

        setSessionOverrides((prev) => ({
          ...prev,
          [currentCardRefUid]: {
            ...currentCardData,
            algorithm,
            interaction,
            dateCreated: now,
            lbl_progress: JSON.stringify(updatedProgress),
            nextDueDate: hasUnreadChildren ? now : childNextDueDate,
          },
        }));

        if (
          shouldReinsertLblCard({
            currentChildIndex: lineByLineCurrentChildIndex,
            totalChildren: childUidsList.length,
            lblNextReinsertOffset,
          }) &&
          currentCardRefUid
        ) {
          const readInsertIndex = currentIndex + 1 + lblNextReinsertOffset;
          setCardQueue((prev) => {
            const newQueue = [...prev];
            const targetIndex = Math.min(readInsertIndex, newQueue.length);
            newQueue.splice(targetIndex, 0, currentCardRefUid);
            return newQueue;
          });
        }

        setCurrentIndex((prev) => prev + 1);
        setLineByLineCurrentChildIndex(lineByLineCurrentChildIndex + 1);
        setLineByLineRevealedCount(lineByLineCurrentChildIndex + 1);
        return;
      }

      const existingData = lineByLineProgress[childUid];

      const sm2Input = {
        sm2_interval: existingData?.sm2_interval || 0,
        sm2_repetitions: existingData?.sm2_repetitions || 0,
        sm2_eFactor: existingData?.sm2_eFactor || 2.5,
      };
      const sm2Result = supermemo(sm2Input, grade);

      const now = new Date();
      const childNextDueDate = dateUtils.addDays(now, sm2Result.sm2_interval);

      const updatedProgress: LineByLineProgressMap = {
        ...lineByLineProgress,
        [childUid]: {
          nextDueDate: childNextDueDate.toISOString(),
          sm2_interval: sm2Result.sm2_interval,
          sm2_repetitions: sm2Result.sm2_repetitions,
          sm2_eFactor: sm2Result.sm2_eFactor,
          progressive_repetitions: existingData?.progressive_repetitions,
        },
      };

      const hasUnreadChildren = Object.keys(updatedProgress).length < childUidsList.length;

      await updateLineByLineProgress({
        refUid: currentCardRefUid,
        dataPageTitle,
        progress: updatedProgress,
        totalChildren: childUidsList.length,
      });

      setSessionOverrides((prev) => ({
        ...prev,
        [currentCardRefUid]: {
          ...currentCardData,
          algorithm,
          interaction,
          dateCreated: now,
          lbl_progress: JSON.stringify(updatedProgress),
          nextDueDate: hasUnreadChildren ? now : childNextDueDate,
        },
      }));

      if (grade === 0 && forgotReinsertOffset > 0 && currentCardRefUid) {
        const forgotInsertIndex = currentIndex + 1 + forgotReinsertOffset;
        setCardQueue((prev) => {
          const newQueue = [...prev];
          const targetIndex = Math.min(forgotInsertIndex, newQueue.length);
          newQueue.splice(targetIndex, 0, currentCardRefUid);
          return newQueue;
        });
      }

      const nextIndex = lineByLineCurrentChildIndex + 1;
      const isCardFinished = nextIndex >= childUidsList.length;

      if (isCardFinished) {
        setCurrentIndex((prev) => prev + 1);
        setLineByLineCurrentChildIndex(nextIndex);
        setLineByLineRevealedCount(nextIndex);
        setShowAnswers(false);
        return;
      }

      setLineByLineCurrentChildIndex(nextIndex);
      setLineByLineRevealedCount(nextIndex);
      setShowAnswers(false);
    },
    [
      currentCardRefUid,
      lineByLineCurrentChildIndex,
      childUidsList,
      lineByLineProgress,
      dataPageTitle,
      setCurrentIndex,
      isLblNext,
      currentCardData,
      algorithm,
      interaction,
      lblNextReinsertOffset,
      forgotReinsertOffset,
      currentIndex,
      setSessionOverrides,
      setCardQueue,
      setShowAnswers,
    ]
  );

  const onLineByLineShowAnswer = React.useCallback(() => {
    setLineByLineRevealedCount((prev) => prev + 1);
    setShowAnswers(true);
  }, [setShowAnswers]);

  return {
    lineByLineRevealedCount,
    lineByLineCurrentChildIndex,
    lineByLineIsCardComplete,
    lineByLineProgress,
    onLineByLineGrade,
    onLineByLineShowAnswer,
  };
}
