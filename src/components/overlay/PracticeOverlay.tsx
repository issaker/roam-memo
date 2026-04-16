/**
 * PracticeOverlay Component
 *
 * Main review interface — displays cards one at a time and handles grading.
 *
 * Architecture:
 * - Receives practice data, settings, and callbacks as props from App
 * - Uses useCurrentCardData for real-time card data with polling
 * - MainContext provides shared state (reviewMode, intervalMultiplier, etc.) to child components
 * - Footer handles grading buttons and keyboard shortcuts
 * - CardBlock renders the actual Roam block content
 *
 * Settings flow:
 * - showBreadcrumbs, showModeBorders come from useSettings via App props (single source of truth)
 * - localSettings is used ONLY for the settings dialog form state (roam/js mode)
 * - Dialog saves sync to both page and extensionAPI, then dispatches roamMemoSettingsChanged event
 */
import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import useBlockInfo from '~/hooks/useBlockInfo';
import * as asyncUtils from '~/utils/async';
import * as dateUtils from '~/utils/date';
import * as stringUtils from '~/utils/string';
import Lottie from 'react-lottie';
import doneAnimationData from '~/lotties/done.json';
import Tooltip from '~/components/Tooltip';
import mediaQueries from '~/utils/mediaQueries';
import { saveSettingsToPage, loadSettingsFromPage } from '~/queries/settings';

import CardBlock from '~/components/overlay/CardBlock';
import Footer from '~/components/overlay/Footer';
import ButtonTags from '~/components/ButtonTags';
import {
  CompleteRecords,
  ReviewModes,
  Session,
  isFixedMode,
  isSM2LBLMode,
  isProgressiveLBLMode,
  DEFAULT_REVIEW_MODE,
  LineByLineProgressMap,
} from '~/models/session';
import useCurrentCardData from '~/hooks/useCurrentCardData';
import { generateNewSession, updateLineByLineProgress, updateCardType } from '~/queries';
import MigrateLegacyDataPanel from '~/components/MigrateLegacyDataPanel';
import { generatePracticeData, progressiveInterval, supermemo } from '~/practice';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';
import { colors } from '~/theme';

interface MainContextProps {
  reviewMode: ReviewModes | undefined;
  onSelectReviewMode: (reviewMode: ReviewModes) => void;
  intervalMultiplier: number;
  setIntervalMultiplier: (multiplier: number) => void;
  onPracticeClick: (props: handlePracticeProps) => void;
  today: Today;
  selectedTag: string;
  currentIndex: number;
  renderMode: RenderMode;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  isLineByLine: boolean;
  lineByLineCurrentIndex: number;
  lineByLineTotal: number;
  cardMeta: import('~/models/session').CardMeta | undefined;
}

export const MainContext = React.createContext<MainContextProps>({} as MainContextProps);

interface Props {
  isOpen: boolean;
  tagsList: string[];
  selectedTag: string;
  onCloseCallback: () => void;
  practiceData: CompleteRecords;
  today: Today;
  handlePracticeClick: (props: handlePracticeProps) => void;
  handleMemoTagChange: (tag: string) => void;
  handleReviewMoreClick: () => void;
  isCramming: boolean;
  setIsCramming: (isCramming: boolean) => void;
  rtlEnabled: boolean;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  forgotReinsertOffset: number;
  readReinsertOffset: number;
  fetchPracticeData: () => void;
  dataPageTitle: string;
  historyCleanupKeepCount: number;
  showBreadcrumbs: boolean;
  showModeBorders: boolean;
}

/**
 * Incremental Read should only jump back into the current queue when there is
 * still another child line to continue reading later in the same session.
 */
export const shouldReinsertReadCard = ({
  currentChildIndex,
  totalChildren,
  readReinsertOffset,
}: {
  currentChildIndex: number;
  totalChildren: number;
  readReinsertOffset: number;
}) => readReinsertOffset > 0 && currentChildIndex < totalChildren - 1;

const PracticeOverlay = ({
  isOpen,
  tagsList,
  selectedTag,
  onCloseCallback,
  practiceData,
  today,
  handlePracticeClick,
  handleMemoTagChange,
  handleReviewMoreClick,
  isCramming,
  setIsCramming,
  rtlEnabled,
  setRenderMode,
  forgotReinsertOffset,
  readReinsertOffset,
  fetchPracticeData,
  dataPageTitle,
  historyCleanupKeepCount,
  showBreadcrumbs,
  showModeBorders,
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag];

  const newCardsUids = todaySelectedTag?.newUids || [];
  const dueCardsUids = todaySelectedTag?.dueUids || [];
  const initialCardUids = [...dueCardsUids, ...newCardsUids];
  const renderMode = todaySelectedTag?.renderMode;

  const [cardQueue, setCardQueue] = React.useState<string[]>(initialCardUids);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [sessionOverrides, setSessionOverrides] = React.useState<Record<string, Session>>({});

  const isFirst = currentIndex === 0;
  const completedTodayCount = todaySelectedTag?.completed;

  const currentCardRefUid = cardQueue[currentIndex] as string | undefined;
  const sessions = React.useMemo(() => {
    const currentSessions = currentCardRefUid ? practiceData[currentCardRefUid] : [];
    if (!currentSessions?.length) {
      return currentCardRefUid && sessionOverrides[currentCardRefUid]
        ? [sessionOverrides[currentCardRefUid]]
        : [];
    }

    const sessionOverride = currentCardRefUid ? sessionOverrides[currentCardRefUid] : undefined;
    if (!sessionOverride) return currentSessions;

    // Keep reinserted cards aligned with the latest in-session snapshot.
    return [...currentSessions.slice(0, -1), sessionOverride];
  }, [currentCardRefUid, practiceData, sessionOverrides]);
  const { currentCardData, cardMeta, reviewMode, latestSession, applyOptimisticCardMeta } =
    useCurrentCardData({
      currentCardRefUid,
      sessions,
      dataPageTitle,
    });

  const totalCardsCount = (todaySelectedTag?.new || 0) + (todaySelectedTag?.due || 0);
  const hasCards = totalCardsCount > 0;

  const newFixedSessionDefaults = React.useMemo(
    () => generateNewSession({ reviewMode: DEFAULT_REVIEW_MODE }),
    []
  );

  const [intervalMultiplier, setIntervalMultiplier] = React.useState<number>(
    currentCardData?.intervalMultiplier || (newFixedSessionDefaults.intervalMultiplier as number)
  );

  const isDone = todaySelectedTag?.status === CompletionStatus.Finished || !currentCardData;

  // Track previous card UID so the interval state is only initialised
  // when the card changes — not on every polling update that touches
  // currentCardData.  This prevents the 1s poll from overwriting a
  // user's manual intervalMultiplier selection.
  const prevCardRefUidRef = React.useRef<string | undefined>();

  // Reset interval state when navigating to a different card.
  // Uses latestSession (derived immediately from sessions via useMemo) instead
  // of currentCardData, because currentCardData is updated asynchronously by
  // useCurrentCardData's Effect 1 and is stale during the first render after
  // a card change. Using stale currentCardData would copy the PREVIOUS card's
  // intervalMultiplier into the new card, and the cardChanged guard would
  // prevent correction on the subsequent render.
  React.useEffect(() => {
    const cardChanged = prevCardRefUidRef.current !== currentCardRefUid;
    prevCardRefUidRef.current = currentCardRefUid;

    if (!latestSession) return;

    if (!cardChanged) return;

    if (isFixedMode(latestSession.reviewMode)) {
      setIntervalMultiplier(latestSession.intervalMultiplier as number);
    } else {
      setIntervalMultiplier(newFixedSessionDefaults.intervalMultiplier as number);
    }
  }, [latestSession, currentCardRefUid, newFixedSessionDefaults]);

  const hasNextDueDate = currentCardData && 'nextDueDate' in currentCardData;
  const isNew = currentCardData && 'isNew' in currentCardData && currentCardData.isNew;
  const nextDueDate = hasNextDueDate ? currentCardData.nextDueDate : undefined;

  const isDueToday = dateUtils.daysBetween(nextDueDate, new Date()) === 0;
  const status = isNew ? 'new' : isDueToday ? 'dueToday' : hasNextDueDate ? 'pastDue' : null;

  const { blockInfo } = useBlockInfo({ refUid: currentCardRefUid });
  const hasBlockChildren = !!blockInfo.children && !!blockInfo.children.length;
  const hasBlockChildrenUids = !!blockInfo.childrenUids && !!blockInfo.childrenUids.length;

  const [showAnswers, setShowAnswers] = React.useState(false);
  const [hasCloze, setHasCloze] = React.useState(true);
  const [showSettings, setShowSettings] = React.useState(false);

  const shouldShowAnswerFirst =
    renderMode === RenderMode.AnswerFirst && hasBlockChildrenUids && !showAnswers;

  const isSM2LBL = isSM2LBLMode(reviewMode) && hasBlockChildrenUids;

  const isProgressiveLBL = isProgressiveLBLMode(reviewMode) && hasBlockChildrenUids;

  const isLineByLineUI = isSM2LBL || isProgressiveLBL;

  const parseLineByLineProgress = (progressStr?: string): LineByLineProgressMap => {
    if (!progressStr) return {};
    try {
      return JSON.parse(progressStr);
    } catch {
      return {};
    }
  };

  const lineByLineProgress = React.useMemo(
    () => parseLineByLineProgress(currentCardData?.lineByLineProgress),
    [currentCardData?.lineByLineProgress]
  );

  const childUidsList = React.useMemo(() => blockInfo.childrenUids || [], [blockInfo.childrenUids]);

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
    if (isProgressiveLBL) {
      setLineByLineRevealedCount(firstDueIndex + 1);
    } else {
      setLineByLineRevealedCount(firstDueIndex);
    }
  }, [isLineByLineUI, isProgressiveLBL, currentCardRefUid, childUidsList, lineByLineProgress]);

  const lineByLineIsCardComplete =
    isLineByLineUI && lineByLineCurrentChildIndex >= childUidsList.length;

  const onLineByLineGrade = React.useCallback(
    async (grade: number) => {
      if (!currentCardRefUid || lineByLineCurrentChildIndex >= childUidsList.length) return;

      const childUid = childUidsList[lineByLineCurrentChildIndex];

      if (isProgressiveLBL) {
        const existingData = lineByLineProgress[childUid];
        const progReps = existingData?.progressiveRepetitions || 0;
        const nextInterval = progressiveInterval(progReps);

        const now = new Date();
        const nextDueDate = dateUtils.addDays(now, nextInterval);

        const updatedProgress: LineByLineProgressMap = {
          ...lineByLineProgress,
          [childUid]: {
            nextDueDate: nextDueDate.toISOString(),
            interval: nextInterval,
            repetitions: (existingData?.repetitions || 0) + 1,
            eFactor: existingData?.eFactor || 2.5,
            progressiveRepetitions: progReps + 1,
          },
        };

        await updateLineByLineProgress({
          refUid: currentCardRefUid,
          dataPageTitle,
          progress: updatedProgress,
        });

        setSessionOverrides((prev) => ({
          ...prev,
          [currentCardRefUid]: {
            ...currentCardData,
            reviewMode,
            dateCreated: now,
            lineByLineProgress: JSON.stringify(updatedProgress),
            nextDueDate,
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
        setShowAnswers(true);
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
      const nextDueDate = dateUtils.addDays(now, sm2Result.interval);

      const updatedProgress: LineByLineProgressMap = {
        ...lineByLineProgress,
        [childUid]: {
          nextDueDate: nextDueDate.toISOString(),
          interval: sm2Result.interval,
          repetitions: sm2Result.repetition,
          eFactor: sm2Result.efactor,
        },
      };

      await updateLineByLineProgress({
        refUid: currentCardRefUid,
        dataPageTitle,
        progress: updatedProgress,
      });

      setSessionOverrides((prev) => ({
        ...prev,
        [currentCardRefUid]: {
          ...currentCardData,
          reviewMode,
          dateCreated: now,
          lineByLineProgress: JSON.stringify(updatedProgress),
          nextDueDate,
        },
      }));

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
      isProgressiveLBL,
      currentCardData,
      reviewMode,
      readReinsertOffset,
      currentIndex,
    ]
  );

  const onLineByLineShowAnswer = React.useCallback(() => {
    setLineByLineRevealedCount((prev) => prev + 1);
    setShowAnswers(true);
  }, []);

  const [localSettings, setLocalSettings] = React.useState({
    tagsListString: 'memo',
    dataPageTitle: 'roam/memo',
    dailyLimit: 0,
    historyCleanupKeepCount,
    rtlEnabled: false,
    shuffleCards: false,
    forgotReinsertOffset: 3,
    readReinsertOffset: 3,
    showBreadcrumbs: false,
    showModeBorders: true,
  });

  // Load settings from page on mount and sync with extensionAPI
  React.useEffect(() => {
    const loadSettings = async () => {
      const savedSettings = await loadSettingsFromPage('roam/memo');
      if (savedSettings) {
        setLocalSettings(savedSettings);

        // Sync with extensionAPI so useSettings hook can pick them up
        const canWriteExtensionSettings =
          typeof window.roamMemo?.extensionAPI?.settings?.set === 'function';
        if (
          window.roamMemo &&
          window.roamMemo.extensionAPI &&
          window.roamMemo.extensionAPI.settings &&
          canWriteExtensionSettings
        ) {
          Object.entries(savedSettings).forEach(([key, value]) => {
            window.roamMemo.extensionAPI.settings.set(key, value);
          });
        }
      }
    };
    loadSettings();
  }, []);

  React.useEffect(() => {
    setLocalSettings((prev) => ({ ...prev, historyCleanupKeepCount }));
  }, [historyCleanupKeepCount]);

  // Auto-save settings: debounce 300ms after any localSettings change
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const isInitialLoadRef = React.useRef(true);

  React.useEffect(() => {
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(async () => {
      await saveSettingsToPage(localSettings.dataPageTitle, localSettings);
      if (typeof window.roamMemo?.extensionAPI?.settings?.set === 'function') {
        Object.entries(localSettings).forEach(([key, value]) => {
          window.roamMemo.extensionAPI.settings.set(key, value);
        });
      }
      window.dispatchEvent(new Event('roamMemoSettingsChanged'));
    }, 300);

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [localSettings]);

  // Reset showAnswers state
  React.useEffect(() => {
    if (isProgressiveLBL) {
      setShowAnswers(true);
    } else if (isSM2LBL) {
      setShowAnswers(false);
    } else if (isFixedMode(reviewMode)) {
      setShowAnswers(true);
    } else if (hasBlockChildren || hasCloze) {
      setShowAnswers(false);
    } else {
      setShowAnswers(true);
    }
  }, [hasBlockChildren, hasCloze, isSM2LBL, isProgressiveLBL, reviewMode, currentCardRefUid]);

  const onTagChange = async (tag) => {
    setCurrentIndex(0);
    handleMemoTagChange(tag);
    setIsCramming(false);

    // To prevent 'space' key event from triggering dropdown
    await asyncUtils.sleep(200);

    if (document.activeElement instanceof HTMLElement) {
      document?.activeElement.blur();
    }
  };

  React.useEffect(() => {
    setCardQueue(initialCardUids);
    setCurrentIndex(0);
  }, [selectedTag]);

  // When today data loads and initialCardUids becomes available, sync cardQueue
  const initialCardUidsLengthRef = React.useRef(initialCardUids.length);
  React.useEffect(() => {
    const wasEmpty = initialCardUidsLengthRef.current === 0;
    const nowHasCards = initialCardUids.length > 0;
    initialCardUidsLengthRef.current = initialCardUids.length;

    if (wasEmpty && nowHasCards) {
      setCardQueue(initialCardUids);
      setCurrentIndex(0);
    }
  }, [todaySelectedTag]);

  const onPracticeClick = React.useCallback(
    (gradeData) => {
      if (isDone) return;

      if (isLineByLineUI && !lineByLineIsCardComplete) {
        onLineByLineGrade(gradeData.grade);
        return;
      }

      // Always persist the UI-resolved review mode.
      // currentCardData can lag behind optimistic mode switching.
      const resolvedReviewMode = reviewMode || currentCardData?.reviewMode || DEFAULT_REVIEW_MODE;
      const practiceProps = {
        ...currentCardData,
        ...gradeData,
        intervalMultiplier,
        reviewMode: resolvedReviewMode,
      };

      if (!isCramming && currentCardRefUid) {
        const now = new Date();
        const optimisticSession = generatePracticeData({
          ...practiceProps,
          dateCreated: now,
        });

        setSessionOverrides((prev) => ({
          ...prev,
          [currentCardRefUid]: {
            ...currentCardData,
            ...optimisticSession,
            dateCreated: now,
          },
        }));
      }

      handlePracticeClick(practiceProps);
      setShowAnswers(false);

      const isForgot = gradeData.grade === 0;
      const insertIndex = currentIndex + 1 + forgotReinsertOffset;

      if (isForgot && forgotReinsertOffset > 0 && currentCardRefUid) {
        setCardQueue((prev) => {
          const newQueue = [...prev];
          const targetIndex = Math.min(insertIndex, newQueue.length);
          newQueue.splice(targetIndex, 0, currentCardRefUid);
          return newQueue;
        });
      }

      setCurrentIndex((prev) => prev + 1);
    },
    [
      handlePracticeClick,
      isDone,
      currentCardData,
      reviewMode,
      intervalMultiplier,
      currentCardRefUid,
      forgotReinsertOffset,
      isCramming,
      isLineByLineUI,
      lineByLineIsCardComplete,
      onLineByLineGrade,
    ]
  );

  const onSkipClick = React.useCallback(() => {
    if (isDone) return;
    setCurrentIndex((prev) => prev + 1);
  }, [isDone]);

  const onPrevClick = React.useCallback(() => {
    if (isFirst) return;
    setCurrentIndex((prev) => prev - 1);
  }, [isFirst]);

  const onStartCrammingClick = () => {
    setIsCramming(true);
    setCurrentIndex(0);
  };

  const lottieAnimationOption = {
    loop: true,
    autoplay: true,
    animationData: doneAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid meet',
    },
  };
  const lottieStyle = {
    height: 150,
    width: 'auto',
    maxHeight: '40vh',
  };

  const toggleBreadcrumbs = React.useCallback(async () => {
    const newState = !showBreadcrumbs;
    if (window.roamMemo?.extensionAPI?.settings) {
      window.roamMemo.extensionAPI.settings.set('showBreadcrumbs', newState);
      window.dispatchEvent(new Event('roamMemoSettingsChanged'));
    }
    await saveSettingsToPage(dataPageTitle, { ...localSettings, showBreadcrumbs: newState });
  }, [showBreadcrumbs, dataPageTitle, localSettings]);

  const hotkeys = React.useMemo(
    () => [
      {
        combo: 'B',
        global: true,
        label: 'Show BreadCrumbs',
        onKeyDown: toggleBreadcrumbs,
      },
    ],
    [showBreadcrumbs]
  );
  Blueprint.useHotkeys(hotkeys);

  // Detect editing state and adjust bottom spacing
  const [isEditing, setIsEditing] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      // Check if the focused element is an input/textarea
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setIsEditing(true);
      }
    };

    const handleFocusOut = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Small delay to check if another input gets focus
        setTimeout(() => {
          const activeElement = document.activeElement;
          if (
            !activeElement ||
            (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')
          ) {
            setIsEditing(false);
          }
        }, 100);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, [isOpen]);

  const onSelectReviewMode = React.useCallback(
    async (newReviewMode: ReviewModes) => {
      if (!currentCardRefUid) return;

      setSessionOverrides((prev) => ({
        ...prev,
        [currentCardRefUid]: {
          ...currentCardData,
          reviewMode: newReviewMode,
        },
      }));

      applyOptimisticCardMeta({
        ...cardMeta,
        reviewMode: newReviewMode,
      });

      await updateCardType({
        refUid: currentCardRefUid,
        dataPageTitle,
        reviewMode: newReviewMode,
      });

      fetchPracticeData();
    },
    [
      currentCardRefUid,
      dataPageTitle,
      cardMeta,
      currentCardData,
      applyOptimisticCardMeta,
      fetchPracticeData,
    ]
  );

  if (!todaySelectedTag) {
    return null;
  }

  return (
    <MainContext.Provider
      value={{
        reviewMode,
        onSelectReviewMode,
        intervalMultiplier,
        setIntervalMultiplier,
        onPracticeClick,
        today,
        selectedTag,
        currentIndex,
        renderMode,
        setRenderMode,
        isLineByLine: isLineByLineUI,
        lineByLineCurrentIndex: isLineByLineUI ? lineByLineCurrentChildIndex + 1 : 0,
        lineByLineTotal: isLineByLineUI ? childUidsList.length : 0,
        cardMeta,
      }}
    >
      <style>{mobileOverlayStyles(isEditing)}</style>
      <Dialog
        $isEditing={isEditing}
        $reviewMode={reviewMode}
        $showModeBorders={showModeBorders}
        isOpen={isOpen}
        onClose={onCloseCallback}
        className="pb-0"
        canEscapeKeyClose={true}
      >
        <Header
          className="bp3-dialog-header outline-none focus:outline-none focus-visible:outline-none"
          tagsList={tagsList}
          onCloseCallback={onCloseCallback}
          onTagChange={onTagChange}
          status={status}
          isDone={isDone}
          nextDueDate={nextDueDate}
          showBreadcrumbs={showBreadcrumbs}
          onToggleBreadcrumbs={toggleBreadcrumbs}
          isCramming={isCramming}
          onSettingsClick={() => setShowSettings(true)}
          reviewMode={reviewMode}
          isLineByLine={isLineByLineUI}
          lineByLineCurrentIndex={isLineByLineUI ? lineByLineCurrentChildIndex + 1 : 0}
          lineByLineTotal={childUidsList.length}
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
          dir={rtlEnabled ? 'rtl' : undefined}
        >
          {currentCardRefUid ? (
            <>
              {isLineByLineUI && !lineByLineIsCardComplete ? (
                <>
                  <CardBlock
                    refUid={currentCardRefUid}
                    showAnswers={true}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={showBreadcrumbs}
                    onRenderComplete={() => {}}
                    hideChildren={true}
                  />
                  <LineByLineSeparator>
                    Line {lineByLineCurrentChildIndex + 1} / {childUidsList.length}
                  </LineByLineSeparator>
                  {childUidsList.slice(0, lineByLineRevealedCount).map((uid, index) => {
                    const isCurrentLine = index === lineByLineCurrentChildIndex;
                    const childProgress = lineByLineProgress[uid];
                    const isMastered =
                      childProgress && new Date(childProgress.nextDueDate) > new Date();
                    return (
                      <LineByLineItem key={uid} $isCurrent={isCurrentLine} $isMastered={isMastered}>
                        <CardBlock
                          refUid={uid}
                          showAnswers={true}
                          setHasCloze={setHasCloze}
                          breadcrumbs={[]}
                          showBreadcrumbs={false}
                          onRenderComplete={() => {}}
                        />
                      </LineByLineItem>
                    );
                  })}
                </>
              ) : shouldShowAnswerFirst ? (
                blockInfo.childrenUids?.map((uid) => (
                  <CardBlock
                    key={uid}
                    refUid={uid}
                    showAnswers={showAnswers}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={false}
                    onRenderComplete={() => {}}
                  />
                ))
              ) : (
                <CardBlock
                  refUid={currentCardRefUid}
                  showAnswers={showAnswers}
                  setHasCloze={setHasCloze}
                  breadcrumbs={blockInfo.breadcrumbs}
                  showBreadcrumbs={showBreadcrumbs}
                  onRenderComplete={() => {}}
                />
              )}
            </>
          ) : (
            <div data-testid="practice-overlay-done-state" className="flex items-center flex-col">
              <Lottie options={lottieAnimationOption} style={lottieStyle} />
              {/* @TODOZ: Add support for review more*/}
              {/* eslint-disable-next-line no-constant-condition */}
              {false ? (
                <div>
                  Reviewed {todaySelectedTag.completed}{' '}
                  {stringUtils.pluralize(completedTodayCount, 'card', 'cards')} today.{' '}
                  <a onClick={handleReviewMoreClick}>Review more</a>
                </div>
              ) : (
                <div>
                  You&apos;re all caught up! 🌟{' '}
                  {todaySelectedTag.completed > 0
                    ? `Reviewed ${todaySelectedTag.completed} ${stringUtils.pluralize(
                        todaySelectedTag.completed,
                        'card',
                        'cards'
                      )} today.`
                    : ''}
                </div>
              )}
            </div>
          )}
        </DialogBody>
        <Footer
          refUid={currentCardRefUid}
          onPracticeClick={onPracticeClick}
          onSkipClick={onSkipClick}
          onPrevClick={onPrevClick}
          setShowAnswers={
            isLineByLineUI && !lineByLineIsCardComplete ? onLineByLineShowAnswer : setShowAnswers
          }
          showAnswers={
            isLineByLineUI ? lineByLineRevealedCount > lineByLineCurrentChildIndex : showAnswers
          }
          isDone={isDone || lineByLineIsCardComplete}
          hasCards={hasCards}
          onCloseCallback={onCloseCallback}
          currentCardData={currentCardData}
          onStartCrammingClick={onStartCrammingClick}
        />
      </Dialog>

      {/* Settings Dialog for roam/js mode */}
      <Blueprint.Dialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        title="Memo Settings"
        style={{ maxWidth: '500px' }}
      >
        <div
          className="bp3-dialog-body"
          style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}
        >
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Tag Pages (Decks)</h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              Separate multiple decks with commas. Example: &quot;memo, sr, 🐘, french exam&quot;
            </p>
            <input
              type="text"
              className="bp3-input"
              value={localSettings.tagsListString}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, tagsListString: e.target.value })
              }
              placeholder="memo"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Data Page Title</h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              Name of page where we&apos;ll store all your data
            </p>
            <input
              type="text"
              className="bp3-input"
              value={localSettings.dataPageTitle}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, dataPageTitle: e.target.value })
              }
              placeholder="roam/memo"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Daily Review Limit</h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              Number of cards to review each day. 0 means no limit.
            </p>
            <input
              type="number"
              className="bp3-input"
              value={localSettings.dailyLimit}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, dailyLimit: Number(e.target.value) })
              }
              placeholder="0"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>
              Reinsert &quot;Forgot&quot; Cards After N Cards
            </h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              When you mark a card as &quot;Forgot&quot;, it will be reinserted into the current
              review session N cards later. Set to 0 to disable.
            </p>
            <input
              type="number"
              className="bp3-input"
              value={localSettings.forgotReinsertOffset}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, forgotReinsertOffset: Number(e.target.value) })
              }
              placeholder="3"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>
              Reinsert &quot;Incremental Read&quot; Cards After N Cards
            </h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              When you click &quot;Next&quot; on an Incremental Read card, it will be reinserted
              into the current review session N cards later. Set to 0 to disable.
            </p>
            <input
              type="number"
              className="bp3-input"
              value={localSettings.readReinsertOffset}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, readReinsertOffset: Number(e.target.value) })
              }
              placeholder="3"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="bp3-checkbox"
                checked={localSettings.showBreadcrumbs}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, showBreadcrumbs: e.target.checked })
                }
                style={{ marginRight: '8px' }}
              />
              <span>Show Breadcrumbs</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              Show breadcrumb navigation above each card during review. You can also toggle this
              with the B key.
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="bp3-checkbox"
                checked={localSettings.showModeBorders}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, showModeBorders: e.target.checked })
                }
                style={{ marginRight: '8px' }}
              />
              <span>Show Review Mode Borders</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              Show the green/orange dialog border that marks the current card&apos;s review mode.
            </p>
          </div>

          <div style={{ marginBottom: '20px', borderTop: '1px solid #394b59', paddingTop: '15px' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Data Migration</span>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 10px 0' }}>
              Migrate card data to the current architecture: rename cardType→reviewMode in meta, add
              missing reviewMode, and remove redundant reviewMode from session records. Safe to run
              multiple times.
            </p>
            <MigrateLegacyDataPanel dataPageTitle={dataPageTitle} />
          </div>

          <HistoryCleanupSection
            dataPageTitle={dataPageTitle}
            keepCount={localSettings.historyCleanupKeepCount}
            onKeepCountChange={(nextKeepCount) =>
              setLocalSettings((prev) => ({ ...prev, historyCleanupKeepCount: nextKeepCount }))
            }
          />

          <div style={{ marginBottom: '20px', borderTop: '1px solid #394b59', paddingTop: '15px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="bp3-checkbox"
                checked={localSettings.rtlEnabled}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, rtlEnabled: e.target.checked })
                }
                style={{ marginRight: '8px' }}
              />
              <span>Right-to-Left (RTL) Enabled</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              Enable RTL for languages like Arabic, Hebrew, etc.
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="bp3-checkbox"
                checked={localSettings.shuffleCards}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, shuffleCards: e.target.checked })
                }
                style={{ marginRight: '8px' }}
              />
              <span>Shuffle Cards</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              OFF: Due cards sorted by urgency (most overdue → hardest → least mature). New cards in
              reverse creation order. ON: All cards randomly shuffled.
            </p>
          </div>
        </div>
      </Blueprint.Dialog>
    </MainContext.Provider>
  );
};

const Dialog = styled(Blueprint.Dialog)<{
  $isEditing?: boolean;
  $reviewMode?: ReviewModes;
  $showModeBorders?: boolean;
}>`
  display: grid;
  grid-template-rows: 50px 1fr auto;
  max-height: 80vh;
  width: 90vw;
  /* Background and text color inherit from Roam body automatically */

  /* Dynamic border color: Spaced=green, Fixed/Read=orange */
  border: 2px solid
    ${({ $reviewMode }) =>
      $reviewMode === ReviewModes.SpacedInterval || $reviewMode === ReviewModes.SpacedIntervalLBL
        ? colors.modeSpaced
        : isFixedMode($reviewMode) || isProgressiveLBLMode($reviewMode)
        ? colors.modeFixed
        : colors.borderSubtle};
  border-color: ${({ $showModeBorders, $reviewMode }) =>
    $showModeBorders === false
      ? colors.borderSubtle
      : $reviewMode === ReviewModes.SpacedInterval || $reviewMode === ReviewModes.SpacedIntervalLBL
      ? colors.modeSpaced
      : isFixedMode($reviewMode) || isProgressiveLBLMode($reviewMode)
      ? colors.modeFixed
      : colors.borderSubtle};

  ${mediaQueries.lg} {
    width: 80vw;
  }

  ${mediaQueries.xl} {
    width: 70vw;
  }

  /* Full-screen on mobile */
  @media (max-width: 768px) {
    max-height: 100dvh;
    width: 100vw;
    height: 100dvh;
    margin: 0;
    border-radius: 0;
    /* 使用 safe-area-inset-bottom 自动适配浏览器底部工具栏 */
    padding-bottom: env(safe-area-inset-bottom, 0px);
  }
`;

const mobileOverlayStyles = (_isEditing: boolean) => `
  @media (max-width: 768px) {
    /* Mobile: Make backdrop transparent and clickable-through */
    .bp3-overlay.bp3-overlay-open > .bp3-overlay-backdrop {
      opacity: 0 !important;
      background: transparent !important;
      pointer-events: none !important;
    }

    /* Overlay itself doesn't block clicks */
    .bp3-overlay.bp3-overlay-open {
      pointer-events: none !important;
    }

    /* Dialog content remains interactive */
    .bp3-overlay.bp3-overlay-open .bp3-dialog-container,
    .bp3-overlay.bp3-overlay-open .bp3-dialog,
    .bp3-overlay.bp3-overlay-open [role="dialog"],
    .bp3-overlay.bp3-overlay-open .bp3-dialog * {
      pointer-events: auto !important;
    }

    /* Internal menus remain clickable */
    .bp3-overlay.bp3-overlay-open .bp3-popover,
    .bp3-overlay.bp3-overlay-open .bp3-popover * {
      pointer-events: auto !important;
    }

    /* Full-screen positioning - must override Blueprint defaults */
    .bp3-overlay.bp3-overlay-open {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100dvh !important;
      margin: 0 !important;
      padding: 0 !important;
      padding-bottom: env(safe-area-inset-bottom, 0px) !important;
    }
    .bp3-overlay .bp3-dialog-container {
      position: static !important;
      width: 100% !important;
      height: 100% !important;
      display: flex !important;
      align-items: stretch !important;
      justify-content: stretch !important;
      margin: 0 !important;
    }
  }
`;

const DialogBody = styled.div`
  overflow-x: hidden; // because of tweaks we do in ContentWrapper container overflows
  min-height: 200px;
`;

const LineByLineSeparator = styled.div`
  font-size: 11px;
  opacity: 0.5;
  text-align: center;
  padding: 4px 0;
  border-top: 1px dashed ${colors.borderSubtle};
  margin-top: 8px;
`;

const LineByLineItem = styled.div<{ $isCurrent: boolean; $isMastered: boolean }>`
  border-left: 3px solid
    ${(props) =>
      props.$isCurrent
        ? colors.lineByLineCurrentBorder
        : props.$isMastered
        ? colors.lineByLineMasteredBorder
        : colors.borderSubtle};
  padding-left: 8px;
  margin-left: 4px;
  margin-top: 4px;
  opacity: ${(props) => (props.$isMastered && !props.$isCurrent ? 0.6 : 1)};
`;

const HeaderWrapper = styled.div`
  justify-content: space-between;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-wrap: normal;
  line-height: inherit;
  margin: 0;
  min-height: 50px;
  border-bottom: 1px solid ${colors.borderSubtle};
`;

const TagSelector = ({ tagsList, selectedTag, onTagChange }) => {
  return (
    <TagSelect
      items={tagsList}
      activeItem={selectedTag}
      filterable={false}
      itemRenderer={(tag, { handleClick, modifiers }) => {
        return (
          <TagSelectorItem
            text={tag}
            tagsList={tagsList}
            active={modifiers.active}
            key={tag}
            onClick={handleClick}
          />
        );
      }}
      onItemSelect={(tag) => {
        onTagChange(tag);
      }}
      popoverProps={{ minimal: true }}
    >
      <Blueprint.Button
        text={selectedTag}
        rightIcon="caret-down"
        minimal
        data-testid="tag-selector-cta"
      />
    </TagSelect>
  );
};
const TagSelect = BlueprintSelect.Select.ofType<string>();

const TagSelectorItemWrapper = styled.div<{ active: boolean }>`
  display: flex;
  justify-content: space-between;
  padding: 4px 6px;
  position: relative;
  user-select: none;
  cursor: pointer;
  border-radius: 2px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: currentColor;
    opacity: ${({ active }) => (active ? 0.08 : 0)};
    border-radius: 2px;
    pointer-events: none;
  }

  &:hover::before {
    opacity: ${({ active }) => (active ? 0.12 : 0.06)};
  }
`;

const Tag = styled(Blueprint.Tag)`
  &.bp3-tag {
    font-size: 11px;
    padding: 1px 3px;
    min-height: auto;
    min-width: auto;
  }
`;

const TagSelectorItem = ({ text, onClick, active, tagsList }) => {
  const { today, setRenderMode } = React.useContext(MainContext);
  const dueCount = today.tags[text].due;
  const newCount = today.tags[text].new;
  const tagRenderMode = today.tags[text].renderMode || RenderMode.Normal;
  const [showTagSettings, setShowTagSettings] = React.useState(false);

  const index = tagsList.indexOf(text);
  const placement = index === tagsList.length - 1 ? 'bottom' : 'top';

  const toggleTagSettings = () => {
    setShowTagSettings(!showTagSettings);
  };

  const toggleRenderMode = () => {
    const newRenderMode =
      tagRenderMode === RenderMode.Normal ? RenderMode.AnswerFirst : RenderMode.Normal;

    setRenderMode(text, newRenderMode);
  };

  const tagSettingsMenu = (
    <div onClick={(e) => e.stopPropagation()}>
      <Blueprint.Menu className="bg-transparent min-w-full text-sm">
        <Blueprint.MenuItem
          text={
            <div className="flex items-center justify-between">
              <span className="text-xs">Swap Q/A</span>
              <Blueprint.Switch
                alignIndicator={Blueprint.Alignment.RIGHT}
                checked={tagRenderMode === RenderMode.AnswerFirst}
                onChange={toggleRenderMode}
                className="mb-0"
              />
            </div>
          }
          className="hover:bg-transparent hover:no-underline"
        />
        <Blueprint.MenuDivider />
      </Blueprint.Menu>
    </div>
  );

  return (
    <TagSelectorItemWrapper
      onClick={onClick}
      active={active}
      key={text}
      tabIndex={-1}
      data-testid="tag-selector-item"
      className="flex-col"
    >
      <div className="flex">
        <div className="flex items-center">{text}</div>
        <div className="ml-2">
          {dueCount > 0 && (
            <Tooltip content="Due" placement={placement}>
              <Tag
                active
                minimal
                intent="primary"
                className="text-center"
                data-testid="tag-selector-due"
              >
                {dueCount}
              </Tag>
            </Tooltip>
          )}
          {newCount > 0 && (
            <Tooltip content="New" placement={placement}>
              <Tag
                active
                minimal
                intent="success"
                className="text-center ml-2"
                data-testid="tag-selector-new"
              >
                {newCount}
              </Tag>
            </Tooltip>
          )}
        </div>
        <div onClick={(e) => e.stopPropagation()} className="">
          <Blueprint.Button
            icon={<Blueprint.Icon icon={showTagSettings ? 'chevron-up' : 'cog'} size={11} />}
            className="ml-1 bp3-small"
            data-testid="tag-settings-button"
            minimal
            onClick={toggleTagSettings}
          />
        </div>
      </div>
      <Blueprint.Collapse isOpen={showTagSettings}>{tagSettingsMenu}</Blueprint.Collapse>
    </TagSelectorItemWrapper>
  );
};

const StatusBadge = ({ status, nextDueDate, isCramming }) => {
  if (isCramming) {
    return (
      <Tooltip content="Reviews don't affect scheduling" placement="left">
        <Blueprint.Tag intent="none">Cramming</Blueprint.Tag>
      </Tooltip>
    );
  }
  switch (status) {
    case 'new':
      return (
        <Blueprint.Tag intent="success" minimal>
          New
        </Blueprint.Tag>
      );

    case 'dueToday':
      return (
        <Blueprint.Tag intent="primary" minimal>
          Due Today
        </Blueprint.Tag>
      );

    case 'pastDue': {
      const timeAgo = dateUtils.customFromNow(nextDueDate);
      return (
        <Blueprint.Tag intent="warning" title={`Due ${timeAgo}`} minimal>
          Past Due
        </Blueprint.Tag>
      );
    }
    default:
      return null;
  }
};

const ModeBadge = ({ reviewMode }) => {
  if (!reviewMode) return null;
  if (reviewMode === ReviewModes.SpacedInterval || reviewMode === ReviewModes.SpacedIntervalLBL) {
    return (
      <Blueprint.Tag intent="success" minimal>
        Spaced
      </Blueprint.Tag>
    );
  }
  if (isProgressiveLBLMode(reviewMode)) {
    return (
      <Blueprint.Tag intent="warning" minimal>
        Read
      </Blueprint.Tag>
    );
  }
  if (isFixedMode(reviewMode)) {
    return (
      <Blueprint.Tag intent="warning" minimal>
        Fixed
      </Blueprint.Tag>
    );
  }
  return null;
};

const BoxIcon = styled(Blueprint.Icon)`
  margin-right: 5px !important;
`;

const BreadcrumbTooltipContent = ({ showBreadcrumbs }) => {
  return (
    <div className="flex align-center">
      {`${showBreadcrumbs ? 'Hide' : 'Show'} Breadcrumbs`}
      <span>
        <ButtonTags kind="light" className="mx-2">
          B
        </ButtonTags>
      </span>
    </div>
  );
};

const Header = ({
  tagsList,
  onCloseCallback,
  onTagChange,
  className,
  status,
  isDone,
  nextDueDate,
  showBreadcrumbs,
  onToggleBreadcrumbs,
  isCramming,
  onSettingsClick,
  reviewMode,
  isLineByLine,
  lineByLineCurrentIndex,
  lineByLineTotal,
}) => {
  const { selectedTag, today, currentIndex } = useSafeContext(MainContext);
  const todaySelectedTag = today.tags[selectedTag];
  const completedTodayCount = todaySelectedTag.completed;
  const remainingTodayCount = todaySelectedTag.due + todaySelectedTag.new;

  const currentIndexDelta = isCramming ? 0 : completedTodayCount;
  const currentDisplayCount = currentIndexDelta + currentIndex + 1;

  const toggleBreadcrumbs = () => {
    onToggleBreadcrumbs();
  };

  return (
    <HeaderWrapper className={className} tabIndex={0}>
      <div className="flex items-center">
        <BoxIcon icon="box" size={14} />
        <div tabIndex={-1}>
          <TagSelector tagsList={tagsList} selectedTag={selectedTag} onTagChange={onTagChange} />
        </div>
      </div>
      <div className="flex items-center justify-end">
        {isLineByLine && !isDone && (
          <Blueprint.Tag intent="none" minimal style={{ fontSize: '10px', marginRight: '4px' }}>
            L{lineByLineCurrentIndex}/{lineByLineTotal}
          </Blueprint.Tag>
        )}
        {!isDone && (
          <div onClick={toggleBreadcrumbs} className="px-1 cursor-pointer">
            <Tooltip
              content={<BreadcrumbTooltipContent showBreadcrumbs={showBreadcrumbs} />}
              placement="left"
            >
              <Blueprint.Icon
                icon={showBreadcrumbs ? 'eye-open' : 'eye-off'}
                className={showBreadcrumbs ? 'opacity-100' : 'opacity-60'}
              />
            </Tooltip>
          </div>
        )}
        {/* Settings button for roam/js mode */}
        <div onClick={onSettingsClick} className="px-1 cursor-pointer">
          <Tooltip content="Settings" placement="left">
            <Blueprint.Icon icon="cog" />
          </Tooltip>
        </div>
        <span data-testid="mode-badge">{!isDone && <ModeBadge reviewMode={reviewMode} />}</span>
        <span data-testid="status-badge">
          <StatusBadge
            status={status}
            nextDueDate={nextDueDate}
            isCramming={isCramming}
            data-testid="status-badge"
          />
        </span>
        <span className="text-sm mx-2 font-medium">
          <span data-testid="display-count-current">{isDone ? 0 : currentDisplayCount}</span>
          <span className="opacity-50 mx-1">/</span>
          <span className="opacity-50" data-testid="display-count-total">
            {isDone ? 0 : remainingTodayCount}
          </span>
        </span>
        <button
          aria-label="Close"
          className="bp3-dialog-close-button bp3-button bp3-minimal bp3-icon-cross"
          onClick={onCloseCallback}
        ></button>
      </div>
    </HeaderWrapper>
  );
};

const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 2000;
const CARD_DELAY_MS = 100;
const cleanupSleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const HistoryCleanupSection = ({
  dataPageTitle,
  keepCount,
  onKeepCountChange,
}: {
  dataPageTitle: string;
  keepCount: number;
  onKeepCountChange: (nextKeepCount: number) => void;
}) => {
  const [status, setStatus] = React.useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = React.useState({ total: 0, cleaned: 0, deleted: 0, phase: '' });
  const [errorDetail, setErrorDetail] = React.useState('');

  const runCleanup = async () => {
    if (keepCount < 0) return;
    setStatus('running');
    setProgress({ total: 0, cleaned: 0, deleted: 0, phase: 'Scanning...' });
    setErrorDetail('');

    try {
      const query = `[
        :find (pull ?pluginPageChildren [
          :block/string
          :block/children
          :block/order
          :block/uid
          {:block/children [:block/uid :block/string :block/order {:block/children ...}]}])
        :in $ ?pageTitle ?dataBlockName
        :where
        [?page :node/title ?pageTitle]
        [?page :block/children ?pluginPageChildren]
        [?pluginPageChildren :block/string ?dataBlockName]
      ]`;

      const queryResultsData = await window.roamAlphaAPI.q(query, dataPageTitle, 'data');
      const dataChildren = queryResultsData.map((arr) => arr[0])[0]?.children || [];

      const total = dataChildren.length;
      setProgress({ total, cleaned: 0, deleted: 0, phase: 'Scanning cards...' });

      let cleaned = 0;
      let totalDeleted = 0;
      let errors = 0;

      for (let i = 0; i < dataChildren.length; i++) {
        const cardBlock = dataChildren[i];
        if (!cardBlock?.children) continue;

        const dateBlocks = cardBlock.children.filter((child) => {
          if (!child?.string) return false;
          const dateStr = stringUtils.getStringBetween(child.string, '[[', ']]');
          return !!stringUtils.parseRoamDateString(dateStr);
        });

        if (dateBlocks.length <= keepCount) {
          cleaned++;
          setProgress({
            total,
            cleaned,
            deleted: totalDeleted,
            phase: `Scanning (${i + 1}/${total})`,
          });
          continue;
        }

        const sortedDateBlocks = [...dateBlocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const blocksToDelete = sortedDateBlocks.slice(keepCount);

        for (const block of blocksToDelete) {
          try {
            await window.roamAlphaAPI.deleteBlock({ block: { uid: block.uid } });
            totalDeleted++;
          } catch (err) {
            console.error(`[Memo] History cleanup error deleting block ${block.uid}:`, err);
            errors++;
          }
        }

        cleaned++;

        setProgress({
          total,
          cleaned,
          deleted: totalDeleted,
          phase: `Cleaning (${cleaned}/${total})`,
        });

        if ((i + 1) % BATCH_SIZE === 0) {
          await cleanupSleep(BATCH_DELAY_MS);
        } else {
          await cleanupSleep(CARD_DELAY_MS);
        }
      }

      setProgress({ total, cleaned, deleted: totalDeleted, phase: 'Done' });
      if (errors > 0) {
        setErrorDetail(`${errors} blocks had errors — check console for details.`);
      }
      setStatus('done');
    } catch (error) {
      console.error('[Memo] History cleanup error:', error);
      setStatus('error');
    }
  };

  return (
    <div style={{ marginBottom: '20px', borderTop: '1px solid #394b59', paddingTop: '15px' }}>
      <span style={{ fontSize: '14px', fontWeight: 600 }}>Clean Up History Data</span>
      <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 10px 0' }}>
        Keep only the N most recent date session blocks per card. Older blocks beyond the specified
        count will be deleted. This action cannot be undone. Cleanup remains manual by design to
        avoid automatic heavy writes during normal review sessions.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span style={{ fontSize: '12px' }}>Keep count:</span>
        <input
          type="number"
          className="bp3-input"
          value={keepCount}
          onChange={(e) => onKeepCountChange(Math.max(0, Number(e.target.value)))}
          min={0}
          style={{ width: '80px' }}
        />
      </div>
      {status === 'idle' && (
        <button
          className="bp3-button bp3-intent-warning"
          onClick={runCleanup}
          style={{ fontSize: '12px' }}
        >
          Start Cleanup
        </button>
      )}
      {status === 'running' && (
        <div style={{ fontSize: '12px', color: colors.textMuted }}>
          <div>{progress.phase}</div>
          <div>
            {progress.cleaned}/{progress.total} cards processed, {progress.deleted} blocks deleted
          </div>
        </div>
      )}
      {status === 'done' && (
        <div>
          <div style={{ fontSize: '12px', color: '#0d8050' }}>
            Cleanup complete! {progress.cleaned} cards processed, {progress.deleted} expired blocks
            deleted.
          </div>
          {errorDetail && (
            <div style={{ fontSize: '12px', color: '#d29922', marginTop: '4px' }}>
              {errorDetail}
            </div>
          )}
          <button
            className="bp3-button"
            onClick={() => {
              setStatus('idle');
              setProgress({ total: 0, cleaned: 0, deleted: 0, phase: '' });
            }}
            style={{ fontSize: '12px', marginTop: '8px' }}
          >
            Run Again
          </button>
        </div>
      )}
      {status === 'error' && (
        <div>
          <div style={{ fontSize: '12px', color: '#c23030' }}>
            Cleanup failed. Check the console for details.
          </div>
          <button
            className="bp3-button"
            onClick={() => {
              setStatus('idle');
              setProgress({ total: 0, cleaned: 0, deleted: 0, phase: '' });
            }}
            style={{ fontSize: '12px', marginTop: '8px' }}
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeOverlay;
