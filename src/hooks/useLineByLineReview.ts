import * as React from 'react';
import { LineByLineProgressMap, SchedulingAlgorithm } from '~/models/session';
import { updateLineByLineProgress } from '~/queries';
import { progressiveInterval, supermemo } from '~/practice';
import * as dateUtils from '~/utils/date';

export const shouldReinsertReadCard = ({
  currentChildIndex,
  totalChildren,
  readReinsertOffset,
}: {
  currentChildIndex: number;
  totalChildren: number;
  readReinsertOffset: number;
}) => readReinsertOffset > 0 && currentChildIndex < totalChildren - 1;

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
  isLineByLineUI: boolean;
  isIncrementalRead: boolean;
  isLBLReview: boolean;
  dataPageTitle: string;
  readReinsertOffset: number;
  forgotReinsertOffset: number;
  currentIndex: number;
  currentCardData: any;
  algorithm: SchedulingAlgorithm;
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
  isLineByLineUI,
  isIncrementalRead,
  isLBLReview,
  dataPageTitle,
  readReinsertOffset,
  forgotReinsertOffset,
  currentIndex,
  currentCardData,
  algorithm,
  setSessionOverrides,
  setCurrentIndex,
  setShowAnswers,
  setCardQueue,
  lineByLineProgressStr,
}: UseLineByLineReviewInput): UseLineByLineReviewOutput {
  const lineByLineProgress = React.useMemo(
    () => parseLineByLineProgress(lineByLineProgressStr),
    [lineByLineProgressStr]
  );

  const [lineByLineRevealedCount, setLineByLineRevealedCount] = React.useState(0);
  const [lineByLineCurrentChildIndex, setLineByLineCurrentChildIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isLineByLineUI || !childUidsList.length) {
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
    if (isIncrementalRead) {
      setLineByLineRevealedCount(firstDueIndex + 1);
    } else {
      setLineByLineRevealedCount(firstDueIndex);
    }
  }, [isLineByLineUI, isIncrementalRead, currentCardRefUid, childUidsList, lineByLineProgress]);

  const lineByLineIsCardComplete =
    isLineByLineUI && lineByLineCurrentChildIndex >= childUidsList.length;

  const onLineByLineGrade = React.useCallback(
    async (grade: number) => {
      if (!currentCardRefUid || lineByLineCurrentChildIndex >= childUidsList.length) return;

      const childUid = childUidsList[lineByLineCurrentChildIndex];

      if (isIncrementalRead) {
        const existingData = lineByLineProgress[childUid];
        const progReps = existingData?.progressiveRepetitions || 0;
        const nextInterval = progressiveInterval(progReps);

        const now = new Date();
        const childNextDueDate = dateUtils.addDays(now, nextInterval);

        const updatedProgress: LineByLineProgressMap = {
          ...lineByLineProgress,
          [childUid]: {
            nextDueDate: childNextDueDate.toISOString(),
            interval: nextInterval,
            repetitions: (existingData?.repetitions || 0) + 1,
            eFactor: existingData?.eFactor || 2.5,
            progressiveRepetitions: progReps + 1,
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
            dateCreated: now,
            lineByLineProgress: JSON.stringify(updatedProgress),
            nextDueDate: hasUnreadChildren ? now : childNextDueDate,
          },
        }));

        if (
          shouldReinsertReadCard({
            currentChildIndex: lineByLineCurrentChildIndex,
            totalChildren: childUidsList.length,
            readReinsertOffset,
          }) &&
          currentCardRefUid
        ) {
          const readInsertIndex = currentIndex + 1 + readReinsertOffset;
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
        interval: existingData?.interval || 0,
        repetition: existingData?.repetitions || 0,
        efactor: existingData?.eFactor || 2.5,
      };
      const sm2Result = supermemo(sm2Input, grade);

      const now = new Date();
      const childNextDueDate = dateUtils.addDays(now, sm2Result.interval);

      const updatedProgress: LineByLineProgressMap = {
        ...lineByLineProgress,
        [childUid]: {
          nextDueDate: childNextDueDate.toISOString(),
          interval: sm2Result.interval,
          repetitions: sm2Result.repetition,
          eFactor: sm2Result.efactor,
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
          dateCreated: now,
          lineByLineProgress: JSON.stringify(updatedProgress),
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
      isIncrementalRead,
      currentCardData,
      algorithm,
      readReinsertOffset,
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
