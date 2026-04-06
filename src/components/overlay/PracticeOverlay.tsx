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
import { CompleteRecords, IntervalMultiplierType, ReviewModes } from '~/models/session';
import useCurrentCardData from '~/hooks/useCurrentCardData';
import { generateNewSession } from '~/queries';
import { CompletionStatus, Today, RenderMode } from '~/models/practice';
import { handlePracticeProps } from '~/app';
import { useSafeContext } from '~/hooks/useSafeContext';

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
}: Props) => {
  const todaySelectedTag = today.tags[selectedTag];
  
  // Handle case where tag data hasn't loaded yet (e.g., when settings just changed)
  // Return null to prevent crash - component will re-render when data is available
  if (!todaySelectedTag) {
    return null;
  }
  
  const newCardsUids = todaySelectedTag.newUids;
  const dueCardsUids = todaySelectedTag.dueUids;
  const initialCardUids = [...dueCardsUids, ...newCardsUids];
  const renderMode = todaySelectedTag.renderMode;

  const [cardQueue, setCardQueue] = React.useState<string[]>(initialCardUids);
  const [currentIndex, setCurrentIndex] = React.useState(0);

  const isFirst = currentIndex === 0;
  const completedTodayCount = todaySelectedTag.completed;

  const currentCardRefUid = cardQueue[currentIndex] as string | undefined;
  const sessions = React.useMemo(() => {
    const sessions = currentCardRefUid ? practiceData[currentCardRefUid] : [];
    if (!sessions) return [];
    return sessions;
  }, [currentCardRefUid, practiceData]);
  const { currentCardData, reviewMode, setReviewModeOverride } = useCurrentCardData({
    currentCardRefUid,
    sessions,
  });

  const totalCardsCount = todaySelectedTag.new + todaySelectedTag.due;
  const hasCards = totalCardsCount > 0;
  const isDone = todaySelectedTag.status === CompletionStatus.Finished || !currentCardData;

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

  // When card changes, update multiplier state
  React.useEffect(() => {
    if (!currentCardData) return;

    if (currentCardData?.reviewMode === ReviewModes.FixedInterval) {
      // If card has multiplier, use that
      setIntervalMultiplier(currentCardData.intervalMultiplier as number);
      setIntervalMultiplierType(currentCardData.intervalMultiplierType as IntervalMultiplierType);
    } else {
      // Otherwise, just reset to default
      setIntervalMultiplier(newFixedSessionDefaults.intervalMultiplier as number);
      setIntervalMultiplierType(
        newFixedSessionDefaults.intervalMultiplierType as IntervalMultiplierType
      );
    }
  }, [currentCardData, newFixedSessionDefaults]);

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

  // Local settings state for roam/js mode
  const [localSettings, setLocalSettings] = React.useState({
    tagsListString: 'memo',
    dataPageTitle: 'roam/memo',
    dailyLimit: 0,
    rtlEnabled: false,
    shuffleCards: false,
    forgotReinsertOffset: 3,
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
    if (hasBlockChildren || hasCloze) {
      setShowAnswers(false);
    } else {
      setShowAnswers(true);
    }
  }, [hasBlockChildren, hasCloze, currentIndex, tagsList, selectedTag]);

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

  const onPracticeClick = React.useCallback(
    (gradeData) => {
      if (isDone) return;
      const practiceProps = {
        ...currentCardData,
        ...gradeData,
        intervalMultiplier,
        intervalMultiplierType,
      };

      handlePracticeClick(practiceProps);
      setShowAnswers(false);

      const isForgot = gradeData.grade === 0;
      const insertIndex = currentIndex + 1 + forgotReinsertOffset;

      if (isForgot && forgotReinsertOffset > 0) {
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
      currentCardData,
      intervalMultiplier,
      intervalMultiplierType,
      currentCardRefUid,
      forgotReinsertOffset,
    ]
  );

  const onSkipClick = React.useCallback(() => {
    if (isDone) return;

    setShowAnswers(false);
    setCurrentIndex(currentIndex + 1);
  }, [currentIndex, isDone]);

  const onPrevClick = React.useCallback(() => {
    if (isFirst) return;

    setShowAnswers(false);
    setCurrentIndex(currentIndex - 1);
  }, [currentIndex, isFirst]);

  const onStartCrammingClick = () => {
    setIsCramming(true);
    setCurrentIndex(0);
  };

  const lottieAnimationOption = {
    loop: true,
    autoplay: true,
    animationData: doneAnimationData,
    rendererSettings: {
      preserveAspectRatio: 'xMidYMid slice',
    },
  };
  const lottieStyle = {
    height: 200,
    width: 'auto',
  };

  const [showBreadcrumbs, setShowBreadcrumbs] = React.useState(() => {
    // Load from localStorage, default to false
    const saved = localStorage.getItem('roamMemo_showBreadcrumbs');
    return saved === 'true';
  });

  // Wrapper function to persist breadcrumbs state
  const toggleBreadcrumbs = () => {
    const newState = !showBreadcrumbs;
    setShowBreadcrumbs(newState);
    localStorage.setItem('roamMemo_showBreadcrumbs', String(newState));
  };

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
      }}
    >
      <style>{mobileOverlayStyles(isEditing)}</style>
      {/* @ts-ignore */}
      <Dialog
        $isEditing={isEditing}
        isOpen={isOpen}
        onClose={onCloseCallback}
        className="pb-0 bg-white"
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
          setShowBreadcrumbs={setShowBreadcrumbs}
          isCramming={isCramming}
          onSettingsClick={() => setShowSettings(true)}
        />

        <DialogBody
          className="bp3-dialog-body overflow-y-scroll m-0 pt-6 pb-8 px-4"
          dir={rtlEnabled ? 'rtl' : undefined}
        >
          {currentCardRefUid ? (
            <>
              {shouldShowAnswerFirst ? (
                blockInfo.childrenUids?.map((uid) => (
                  <CardBlock
                    key={uid}
                    refUid={uid}
                    showAnswers={showAnswers}
                    setHasCloze={setHasCloze}
                    breadcrumbs={blockInfo.breadcrumbs}
                    showBreadcrumbs={false}
                  />
                ))
              ) : (
                <CardBlock
                  refUid={currentCardRefUid}
                  showAnswers={showAnswers}
                  setHasCloze={setHasCloze}
                  breadcrumbs={blockInfo.breadcrumbs}
                  showBreadcrumbs={showBreadcrumbs}
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
          setShowAnswers={setShowAnswers}
          showAnswers={showAnswers}
          isDone={isDone}
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
        <div className="bp3-dialog-body" style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Tag Pages (Decks)</h5>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 5px 0' }}>
              Separate multiple decks with commas. Example: "memo, sr, 🐘, french exam"
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
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 5px 0' }}>
              Name of page where we'll store all your data
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
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 5px 0' }}>
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
            <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
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
            <p style={{ fontSize: '12px', color: '#888', margin: '5px 0 0 0' }}>
              Randomly shuffle the order of new and due cards during review.
            </p>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <h5 style={{ margin: '0 0 10px 0' }}>Reinsert "Forgot" Cards After N Cards</h5>
            <p style={{ fontSize: '12px', color: '#888', margin: '0 0 5px 0' }}>
              When you mark a card as "Forgot", it will be reinserted into the current review session N cards later. Set to 0 to disable.
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
        </div>

        <div className="bp3-dialog-footer">
          <div className="bp3-dialog-footer-actions">
            <button
              className="bp3-button bp3-intent-primary"
              onClick={async () => {
                await saveSettingsToPage(localSettings.dataPageTitle, localSettings);
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

const Dialog = styled(Blueprint.Dialog)<{ $isEditing?: boolean }>`
  display: grid;
  grid-template-rows: 50px 1fr auto;
  max-height: 80vh;
  width: 90vw;

  ${mediaQueries.lg} {
    width: 80vw;
  }

  ${mediaQueries.xl} {
    width: 70vw;
  }

  /* Full-screen on mobile */
  @media (max-width: 768px) {
    max-height: ${({ $isEditing }) => ($isEditing ? 'calc(100vh - 35px)' : '100vh')};
    width: 100vw;
    height: ${({ $isEditing }) => ($isEditing ? 'calc(100vh - 35px)' : '100vh')};
    margin: 0;
    border-radius: 0;
  }
`;

const mobileOverlayStyles = (isEditing: boolean) => `
  @media (max-width: 768px) {
    .bp3-overlay.bp3-overlay-open {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: ${isEditing ? 'calc(100vh - 35px)' : '100vh'} !important;
      margin: 0 !important;
      padding: 0 !important;
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

const HeaderWrapper = styled.div`
  justify-content: space-between;
  color: #5c7080;
  background-color: #f6f9fd;
  box-shadow: 0 1px 0 rgb(16 22 26 / 10%);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-wrap: normal;
  line-height: inherit;
  margin: 0;
  min-height: 50px;

  /* Shortcut way to tag selector color */
  & .bp3-button {
    color: #5c7080;
  }
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
  background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'transparent')};
  user-select: none;

  &:hover {
    cursor: pointer;
    background-color: ${({ active }) => (active ? 'rgba(0, 0, 0, 0.05)' : 'rgba(0, 0, 0, 0.03)')};
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
  setShowBreadcrumbs,
  isCramming,
  onSettingsClick,
}) => {
  const { selectedTag, today, currentIndex } = useSafeContext(MainContext);
  const todaySelectedTag = today.tags[selectedTag];
  const completedTodayCount = todaySelectedTag.completed;
  const remainingTodayCount = todaySelectedTag.due + todaySelectedTag.new;

  const currentIndexDelta = isCramming ? 0 : completedTodayCount;
  const currentDisplayCount = currentIndexDelta + currentIndex + 1;

  // Wrapper function to persist breadcrumbs state
  const toggleBreadcrumbs = () => {
    const newState = !showBreadcrumbs;
    setShowBreadcrumbs(newState);
    localStorage.setItem('roamMemo_showBreadcrumbs', String(newState));
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
