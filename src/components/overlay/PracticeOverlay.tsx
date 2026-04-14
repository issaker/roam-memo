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
import { CompleteRecords, IntervalMultiplierType, ReviewModes, LineByLineProgressMap } from '~/models/session';
import useCurrentCardData, { resolveModeSpecificData } from '~/hooks/useCurrentCardData';
import { generateNewSession, updateLineByLineProgress, updateLineByLineFlag } from '~/queries';
import { supermemo } from '~/practice';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';
import { colors } from '~/theme';

interface MainContextProps {
  reviewMode: ReviewModes | undefined;
  setReviewModeOverride: React.Dispatch<React.SetStateAction<ReviewModes | undefined>>;
  intervalMultiplier: number;
  setIntervalMultiplier: (multiplier: number) => void;
  intervalMultiplierType: IntervalMultiplierType;
  setIntervalMultiplierType: (type: IntervalMultiplierType) => void;
  onPracticeClick: (props: handlePracticeProps) => void;
  today: Today;
  selectedTag: string;
  currentIndex: number;
  renderMode: RenderMode;
  setRenderMode: (tag: string, mode: RenderMode) => void;
  isLineByLine: boolean;
  lineByLineCurrentIndex: number;
  lineByLineTotal: number;
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
  dataPageTitle: string;
  showModeBorders: boolean;
}

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
  dataPageTitle,
  showModeBorders,
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag];
  
  const newCardsUids = todaySelectedTag?.newUids || [];
  const dueCardsUids = todaySelectedTag?.dueUids || [];
  const initialCardUids = [...dueCardsUids, ...newCardsUids];
  const renderMode = todaySelectedTag?.renderMode;

  const [cardQueue, setCardQueue] = React.useState<string[]>(initialCardUids);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const isFirst = currentIndex === 0;
  const completedTodayCount = todaySelectedTag?.completed;

  const currentCardRefUid = cardQueue[currentIndex] as string | undefined;
  const sessions = React.useMemo(() => {
    const sessions = currentCardRefUid ? practiceData[currentCardRefUid] : [];
    if (!sessions) return [];
    return sessions;
  }, [currentCardRefUid, practiceData]);
  const { currentCardData, reviewMode, setReviewModeOverride, latestSession } = useCurrentCardData({
    currentCardRefUid,
    sessions,
    dataPageTitle,
  });

  const totalCardsCount = (todaySelectedTag?.new || 0) + (todaySelectedTag?.due || 0);
  const hasCards = totalCardsCount > 0;

  const newFixedSessionDefaults = React.useMemo(
    () => generateNewSession({ reviewMode: ReviewModes.FixedInterval }),
    []
  );

  const [intervalMultiplier, setIntervalMultiplier] = React.useState<number>(
    currentCardData?.intervalMultiplier || (newFixedSessionDefaults.intervalMultiplier as number)
  );
  const [intervalMultiplierType, setIntervalMultiplierType] =
    React.useState<IntervalMultiplierType>(
      currentCardData?.intervalMultiplierType ||
        (newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType)
    );

  // Resolve mode-specific data fields via historical lookback so that
  // switching intervalMultiplierType (e.g. Days → Progressive) recovers
  // the correct progressiveRepetitions from earlier sessions instead of
  // treating undefined as 0 and producing wrong intervals.
  const resolvedCardData = React.useMemo(() => {
    if (!currentCardData) return currentCardData;
    return resolveModeSpecificData(currentCardData, sessions, intervalMultiplierType);
  }, [currentCardData, sessions, intervalMultiplierType]);

  const isDone = todaySelectedTag?.status === CompletionStatus.Finished || !currentCardData;

  // Track previous card UID so the interval state is only initialised
  // when the card changes — not on every polling update that touches
  // currentCardData.  This prevents the 200 ms poll from overwriting a
  // user's manual intervalMultiplierType selection.
  const prevCardRefUidRef = React.useRef<string | undefined>();

  // Reset interval state when navigating to a different card.
  // Uses latestSession (derived immediately from sessions via useMemo) instead
  // of currentCardData, because currentCardData is updated asynchronously by
  // useCurrentCardData's Effect 1 and is stale during the first render after
  // a card change. Using stale currentCardData would copy the PREVIOUS card's
  // intervalMultiplierType into the new card, and the cardChanged guard would
  // prevent correction on the subsequent render.
  React.useEffect(() => {
    const cardChanged = prevCardRefUidRef.current !== currentCardRefUid;
    prevCardRefUidRef.current = currentCardRefUid;

    if (!latestSession) return;

    if (!cardChanged) return;

    if (latestSession.reviewMode === ReviewModes.FixedInterval) {
      setIntervalMultiplier(latestSession.intervalMultiplier as number);
      setIntervalMultiplierType(latestSession.intervalMultiplierType as IntervalMultiplierType);
    } else {
      setIntervalMultiplier(newFixedSessionDefaults.intervalMultiplier as number);
      setIntervalMultiplierType(
        newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType
      );
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
  const [isRendered, setIsRendered] = React.useState(false);

  const shouldShowAnswerFirst =
    renderMode === RenderMode.AnswerFirst && hasBlockChildrenUids && !showAnswers;

  const [lineByLineLocalOverride, setLineByLineLocalOverride] = React.useState<string | undefined>(
    undefined
  );

  React.useEffect(() => {
    setLineByLineLocalOverride(undefined);
  }, [currentCardRefUid]);

  const lineByLineChecked =
    lineByLineLocalOverride !== undefined
      ? lineByLineLocalOverride === 'Y'
      : currentCardData?.lineByLineReview === 'Y';

  // LBL remains a card-level flag, but the actual line-by-line interaction
  // only runs in Spaced mode. Fixed mode stays a fully expanded reading card.
  const isLineByLine =
    lineByLineChecked &&
    reviewMode === ReviewModes.DefaultSpacedInterval &&
    hasBlockChildrenUids;

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
    if (!isLineByLine || !childUidsList.length) {
      setLineByLineRevealedCount(0);
      setLineByLineCurrentChildIndex(0);
      return;
    }
    const now = new Date();
    let firstDueIndex = childUidsList.length;
    for (let i = 0; i < childUidsList.length; i++) {
      const uid = childUidsList[i];
      const childData = lineByLineProgress[uid];
      if (!childData) { firstDueIndex = i; break; }
      if (new Date(childData.nextDueDate) <= now) { firstDueIndex = i; break; }
    }
    setLineByLineRevealedCount(firstDueIndex);
    setLineByLineCurrentChildIndex(firstDueIndex);
  }, [isLineByLine, currentCardRefUid, childUidsList, lineByLineProgress]);

  const lineByLineIsCardComplete = isLineByLine && lineByLineCurrentChildIndex >= childUidsList.length;

  const onLineByLineGrade = React.useCallback(
    async (grade: number) => {
      if (!currentCardRefUid || lineByLineCurrentChildIndex >= childUidsList.length) return;

      const childUid = childUidsList[lineByLineCurrentChildIndex];
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

      const nextIndex = lineByLineCurrentChildIndex + 1;
      const isCardFinished = nextIndex >= childUidsList.length;

      if (isCardFinished) {
        // Line-by-line review is still a normal card in the session queue.
        // After the final due child is graded, advance to the next card instead
        // of leaving the user on a terminal "done" footer for the same card.
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
    ]
  );

  const onLineByLineShowAnswer = React.useCallback(() => {
    setLineByLineRevealedCount((prev) => prev + 1);
    setShowAnswers(true);
  }, []);

  const onToggleLineByLine = React.useCallback(
    async (enabled: boolean) => {
      if (!currentCardRefUid) return;
      setLineByLineLocalOverride(enabled ? 'Y' : 'N');
      await updateLineByLineFlag({
        refUid: currentCardRefUid,
        dataPageTitle,
        enabled,
      });
    },
    [currentCardRefUid, dataPageTitle]
  );

  // Local settings state for roam/js mode
  const [localSettings, setLocalSettings] = React.useState({
    tagsListString: 'memo',
    dataPageTitle: 'roam/memo',
    dailyLimit: 0,
    rtlEnabled: false,
    shuffleCards: false,
    forgotReinsertOffset: 3,
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
        if (window.roamMemo && window.roamMemo.extensionAPI && window.roamMemo.extensionAPI.settings) {
          Object.entries(savedSettings).forEach(([key, value]) => {
            window.roamMemo.extensionAPI.settings.set(key, value);
          });
        }
      }
    };
    loadSettings();
  }, []);

  // Reset showAnswers state
  React.useEffect(() => {
    if (isLineByLine || reviewMode === ReviewModes.FixedInterval) {
      // Fixed Interval is a reading mode, so cards should open expanded by default.
      setShowAnswers(true);
    } else if (hasBlockChildren || hasCloze) {
      setShowAnswers(false);
    } else {
      setShowAnswers(true);
    }
  }, [hasBlockChildren, hasCloze, isLineByLine, reviewMode, currentCardRefUid]);

  // Reset render flag when card changes
  React.useEffect(() => {
    setIsRendered(false);
  }, [currentCardRefUid]);

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

  // When sessions are updated, reset current index
  React.useEffect(() => {
    setCurrentIndex(0);
  }, [practiceData]);

  // When selected tag changes, reset cardQueue and currentIndex
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

      if (isLineByLine && !lineByLineIsCardComplete) {
        onLineByLineGrade(gradeData.grade);
        return;
      }

      const practiceProps = {
        ...resolvedCardData,
        ...gradeData,
        intervalMultiplier,
        intervalMultiplierType,
      };

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

      setCurrentIndex(currentIndex + 1);
    },
    [
      handlePracticeClick,
      isDone,
      currentIndex,
      resolvedCardData,
      intervalMultiplier,
      intervalMultiplierType,
      currentCardRefUid,
      forgotReinsertOffset,
      isLineByLine,
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

  const [showBreadcrumbs, setShowBreadcrumbs] = React.useState(false);
  const [liveShowModeBorders, setLiveShowModeBorders] = React.useState(showModeBorders);

  React.useEffect(() => {
    setShowBreadcrumbs(localSettings.showBreadcrumbs);
  }, [localSettings.showBreadcrumbs]);

  React.useEffect(() => {
    setLiveShowModeBorders(localSettings.showModeBorders);
  }, [localSettings.showModeBorders]);

  React.useEffect(() => {
    setLiveShowModeBorders(showModeBorders);
  }, [showModeBorders]);

  const toggleBreadcrumbs = React.useCallback(async () => {
    const newState = !showBreadcrumbs;
    setShowBreadcrumbs(newState);
    const updatedSettings = { ...localSettings, showBreadcrumbs: newState };
    setLocalSettings(updatedSettings);
    await saveSettingsToPage(updatedSettings.dataPageTitle, updatedSettings);
    if (window.roamMemo?.extensionAPI?.settings) {
      window.roamMemo.extensionAPI.settings.set('showBreadcrumbs', newState);
    }
  }, [showBreadcrumbs, localSettings]);

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
          if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
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

  if (!todaySelectedTag) {
    return null;
  }

  return (
    <MainContext.Provider
      value={{
        reviewMode,
        setReviewModeOverride,
        intervalMultiplier,
        setIntervalMultiplier,
        intervalMultiplierType,
        setIntervalMultiplierType,
        onPracticeClick,
        today,
        selectedTag,
        currentIndex,
        renderMode,
        setRenderMode,
        isLineByLine,
        lineByLineCurrentIndex: isLineByLine ? lineByLineCurrentChildIndex + 1 : 0,
        lineByLineTotal: isLineByLine ? childUidsList.length : 0,
      }}
    >
      <style>{mobileOverlayStyles(isEditing)}</style>
      {/* @ts-ignore */}
      <Dialog
        $isEditing={isEditing}
        $reviewMode={reviewMode}
        $showModeBorders={liveShowModeBorders}
        isOpen={isOpen}
        onClose={onCloseCallback}
        className="pb-0"
        canEscapeKeyClose={false}
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
          isLineByLine={isLineByLine}
          hasBlockChildren={hasBlockChildren}
          lineByLineChecked={lineByLineChecked}
          onToggleLineByLine={onToggleLineByLine}
          lineByLineCurrentIndex={isLineByLine ? lineByLineCurrentChildIndex + 1 : 0}
          lineByLineTotal={childUidsList.length}
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
          dir={rtlEnabled ? 'rtl' : undefined}
        >
          {currentCardRefUid ? (
            <>
              {isLineByLine && !lineByLineIsCardComplete ? (
                <>
                  <CardBlock
                    refUid={currentCardRefUid}
                    showAnswers={true}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={showBreadcrumbs}
                    onRenderComplete={() => setIsRendered(true)}
                    hideChildren={true}
                  />
                  <LineByLineSeparator>
                    Line {lineByLineCurrentChildIndex + 1} / {childUidsList.length}
                  </LineByLineSeparator>
                  {childUidsList.slice(0, lineByLineRevealedCount).map((uid, index) => {
                    const isCurrentLine = index === lineByLineCurrentChildIndex;
                    const childProgress = lineByLineProgress[uid];
                    const isMastered = childProgress && new Date(childProgress.nextDueDate) > new Date();
                    return (
                      <LineByLineItem key={uid} $isCurrent={isCurrentLine} $isMastered={isMastered}>
                        <CardBlock
                          refUid={uid}
                          showAnswers={true}
                          setHasCloze={setHasCloze}
                          breadcrumbs={[]}
                          showBreadcrumbs={false}
                          onRenderComplete={() => setIsRendered(true)}
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
                    onRenderComplete={() => setIsRendered(true)}
                  />
                ))
              ) : (
                <CardBlock
                  refUid={currentCardRefUid}
                  showAnswers={showAnswers}
                  setHasCloze={setHasCloze}
                  breadcrumbs={blockInfo.breadcrumbs}
                  showBreadcrumbs={showBreadcrumbs}
                  onRenderComplete={() => setIsRendered(true)}
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
          setShowAnswers={isLineByLine && !lineByLineIsCardComplete ? onLineByLineShowAnswer : setShowAnswers}
          showAnswers={isLineByLine ? (lineByLineRevealedCount > lineByLineCurrentChildIndex) : showAnswers}
          isDone={isDone || lineByLineIsCardComplete}
          hasCards={hasCards}
          onCloseCallback={onCloseCallback}
          currentCardData={resolvedCardData}
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
        <div className="bp3-dialog-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Tag Pages (Decks)</h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              Separate multiple decks with commas. Example: &quot;memo, sr, 🐘, french exam&quot;
            </p>
            <input
              type="text"
              className="bp3-input"
              value={localSettings.tagsListString}
              onChange={(e) => setLocalSettings({ ...localSettings, tagsListString: e.target.value })}
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
              onChange={(e) => setLocalSettings({ ...localSettings, dataPageTitle: e.target.value })}
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
              onChange={(e) => setLocalSettings({ ...localSettings, dailyLimit: Number(e.target.value) })}
              placeholder="0"
              style={{ width: '100%' }}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                className="bp3-checkbox"
                checked={localSettings.rtlEnabled}
                onChange={(e) => setLocalSettings({ ...localSettings, rtlEnabled: e.target.checked })}
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
                onChange={(e) => setLocalSettings({ ...localSettings, shuffleCards: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              <span>Shuffle Cards</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              OFF: Due cards sorted by urgency (most overdue → hardest → least mature). New cards in reverse creation order. ON: All cards randomly shuffled.
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Reinsert &quot;Forgot&quot; Cards After N Cards</h5>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '0 0 5px 0' }}>
              When you mark a card as &quot;Forgot&quot;, it will be reinserted into the current review session N cards later. Set to 0 to disable.
            </p>
            <input
              type="number"
              className="bp3-input"
              value={localSettings.forgotReinsertOffset}
              onChange={(e) => setLocalSettings({ ...localSettings, forgotReinsertOffset: Number(e.target.value) })}
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
                onChange={(e) => setLocalSettings({ ...localSettings, showBreadcrumbs: e.target.checked })}
                style={{ marginRight: '8px' }}
              />
              <span>Show Breadcrumbs</span>
            </label>
            <p style={{ fontSize: '12px', color: colors.textMuted, margin: '5px 0 0 0' }}>
              Show breadcrumb navigation above each card during review. You can also toggle this with the B key.
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
        </div>

        <div className="bp3-dialog-footer">
          <div className="bp3-dialog-footer-actions">
            <button
              className="bp3-button bp3-intent-primary"
              onClick={async () => {
                await saveSettingsToPage(localSettings.dataPageTitle, localSettings);
                if (window.roamMemo?.extensionAPI?.settings) {
                  Object.entries(localSettings).forEach(([key, value]) => {
                    window.roamMemo.extensionAPI.settings.set(key, value);
                  });
                }
                window.dispatchEvent(new Event('roamMemoSettingsChanged'));
                setShowSettings(false);
              }}
            >
              Apply & Close
            </button>
            <button
              className="bp3-button"
              onClick={() => {
                setShowSettings(false);
              }}
            >
              Cancel
            </button>
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

  /* Dynamic border color based on card review mode */
  border: 2px solid ${({ $reviewMode }) =>
    $reviewMode === ReviewModes.DefaultSpacedInterval
      ? colors.modeSpaced
      : $reviewMode === ReviewModes.FixedInterval
        ? colors.modeFixed
        : colors.borderSubtle};
  border-color: ${({ $showModeBorders, $reviewMode }) =>
    $showModeBorders === false
      ? colors.borderSubtle
      : $reviewMode === ReviewModes.DefaultSpacedInterval
        ? colors.modeSpaced
        : $reviewMode === ReviewModes.FixedInterval
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
  border-left: 3px solid ${(props) =>
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
    // @ts-ignore
    <BlueprintSelect.Select
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
    </BlueprintSelect.Select>
  );
};

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
  if (reviewMode === ReviewModes.DefaultSpacedInterval) {
    return (
      <Blueprint.Tag intent="success" minimal>
        Spaced
      </Blueprint.Tag>
    );
  }
  if (reviewMode === ReviewModes.FixedInterval) {
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
  hasBlockChildren,
  lineByLineChecked,
  onToggleLineByLine,
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

  const handleLineByLineToggle = () => {
    onToggleLineByLine(!lineByLineChecked);
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
        {!isDone && hasBlockChildren && (
          <Tooltip content="Line-by-Line Review" placement="left">
            <Blueprint.Checkbox
              checked={lineByLineChecked}
              onChange={handleLineByLineToggle}
              className="mr-1 mb-0"
              style={{ fontSize: '11px' }}
            >
              <span style={{ fontSize: '11px' }}>LBL</span>
            </Blueprint.Checkbox>
          </Tooltip>
        )}
        {isLineByLine && !isDone && (
          <Blueprint.Tag intent="none" minimal style={{ fontSize: '10px', marginRight: '4px' }}>
            L{lineByLineCurrentIndex}/{lineByLineTotal}
          </Blueprint.Tag>
        )}
        {!isDone && (
          <div onClick={toggleBreadcrumbs} className="px-1 cursor-pointer">
            {/* @ts-ignore */}
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
        <span data-testid="mode-badge">
          {!isDone && <ModeBadge reviewMode={reviewMode} />}
        </span>
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

export default PracticeOverlay;
