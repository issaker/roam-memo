import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import type { IconName, Intent } from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import * as asyncUtils from '~/utils/async';
import { generatePracticeData } from '~/practice';
import Tooltip from '~/components/Tooltip';
import ButtonTags from '~/components/ButtonTags';
import { ReviewModes, isFixedMode, isProgressiveLBLMode } from '~/models/session';
import { MainContext } from '~/components/overlay/PracticeOverlay';
import { getIntentColor, colors } from '~/theme';

interface IntervalEstimate {
  reviewMode: string;
  grade: number;
  repetitions: number;
  interval: number;
  eFactor: number;
  dateCreated: string;
  nextDueDate: string;
  nextDueDateFromNow: string;
}

type IntervalEstimates =
  | undefined
  | {
      [key: number]: IntervalEstimate;
    };
const Footer = ({
  setShowAnswers,
  showAnswers,
  refUid,
  onPracticeClick,
  onSkipClick,
  onPrevClick,
  isDone,
  hasCards,
  onCloseCallback,
  currentCardData,
  onStartCrammingClick,
}) => {
  const { reviewMode, intervalMultiplier } = React.useContext(MainContext);

  const [isIntervalEditorOpen, setIsIntervalEditorOpen] = React.useState(false);

  const toggleIntervalEditorOpen = () => setIsIntervalEditorOpen((prev) => !prev);
  const [activeButtonKey, setActiveButtonKey] = React.useState(null);
  const activateButtonFn = async (key, callbackFn) => {
    setActiveButtonKey(key);
    await asyncUtils.sleep(150);
    callbackFn();
    setActiveButtonKey(null);
  };

  const showAnswerFn = React.useMemo(() => {
    return () => {
      setShowAnswers(true);
    };
  }, [setShowAnswers]);
  const gradeFn = React.useMemo(
    () => (grade) => {
      let key;
      switch (grade) {
        case 0:
          key = 'forgot-button';
          break;
        case 2:
          key = 'hard-button';
          break;
        case 4:
          key = 'good-button';
          break;
        case 5:
          key = 'perfect-button';
          break;

        default:
          break;
      }
      activateButtonFn(key, () => onPracticeClick({ grade, refUid: refUid }));
    },
    [onPracticeClick, refUid]
  );

  const intervalPractice = React.useMemo(
    () => () => {
      activateButtonFn('next-button', () => onPracticeClick({ refUid: refUid }));
    },
    [onPracticeClick, refUid]
  );
  const skipFn = React.useMemo(
    () => () => {
      const key = 'skip-button';
      activateButtonFn(key, () => onSkipClick());
    },
    [onSkipClick]
  );

  const hotkeys = React.useMemo(
    () => [
      {
        combo: 'space',
        global: true,
        label: 'Primary Action Trigger',
        onKeyDown: () => {
          if (!showAnswers) {
            activateButtonFn('space-button', showAnswerFn);
          } else {
            if (isFixedMode(reviewMode)) {
              intervalPractice();
            } else {
              gradeFn(5);
            }
          }
        },
      },
      {
        combo: 'S',
        global: true,
        label: 'Skip',
        onKeyDown: skipFn,
      },
      {
        combo: 'right',
        global: true,
        label: 'Skip',
        onKeyDown: skipFn,
      },
      {
        combo: 'left',
        global: true,
        label: 'Previous',
        onKeyDown: onPrevClick,
      },
      {
        combo: 'F',
        global: true,
        label: 'Grade 0',
        onKeyDown: () => gradeFn(0),
        disabled: isFixedMode(reviewMode),
      },
      {
        combo: 'H',
        global: true,
        label: 'Grade 2',
        onKeyDown: () => gradeFn(2),
        disabled: isFixedMode(reviewMode),
      },
      {
        combo: 'G',
        global: true,
        label: 'Grade 4',
        onKeyDown: () => gradeFn(4),
        disabled: !isFixedMode(reviewMode),
      },
      {
        combo: 'E',
        global: true,
        label: 'Edit Interval',
        onKeyDown: toggleIntervalEditorOpen,
        disabled: !isFixedMode(reviewMode),
      },
    ],
    [skipFn, onPrevClick, reviewMode, showAnswers, showAnswerFn, intervalPractice, gradeFn]
  );
  const { handleKeyDown, handleKeyUp } = Blueprint.useHotkeys(hotkeys);

  const intervalEstimates: IntervalEstimates = React.useMemo(() => {
    if (!currentCardData) return;

    if (!reviewMode) {
      console.error('Review mode not set');
      return;
    }
    const grades = [0, 1, 2, 3, 4, 5];
    const { interval, repetitions, eFactor, progressiveRepetitions } = currentCardData;
    const estimates = {};

    const iterateCount = isFixedMode(reviewMode) ? 1 : grades.length;
    for (let i = 0; i < iterateCount; i++) {
      const grade = grades[i];
      const practiceResultData = generatePracticeData({
        grade,
        interval,
        repetitions,
        eFactor,
        dateCreated: new Date(),
        reviewMode,
        intervalMultiplier,
        progressiveRepetitions,
      });
      estimates[grade] = practiceResultData;
    }
    return estimates;
  }, [currentCardData, intervalMultiplier, reviewMode]);

  return (
    <FooterWrapper
      className="bp3-multistep-dialog-footer flex items-center justify-center rounded-b-md p-0"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <FooterActionsWrapper
        className="bp3-dialog-footer-actions flex-wrap gap-4 justify-center w-full mx-5  my-3"
        data-testid="footer-actions-wrapper"
      >
        {isDone || !hasCards ? (
          <FinishedControls
            onStartCrammingClick={onStartCrammingClick}
            onCloseCallback={onCloseCallback}
          />
        ) : !showAnswers ? (
          <AnswerHiddenControls
            activateButtonFn={activateButtonFn}
            showAnswerFn={showAnswerFn}
            activeButtonKey={activeButtonKey}
          />
        ) : (
          <GradingControlsWrapper
            activeButtonKey={activeButtonKey}
            skipFn={skipFn}
            gradeFn={gradeFn}
            intervalEstimates={intervalEstimates}
            intervalPractice={intervalPractice}
            isIntervalEditorOpen={isIntervalEditorOpen}
            toggleIntervalEditorOpen={toggleIntervalEditorOpen}
            onPrevClick={onPrevClick}
          />
        )}
      </FooterActionsWrapper>
    </FooterWrapper>
  );
};

const AnswerHiddenControls = ({ activateButtonFn, showAnswerFn, activeButtonKey }) => (
  <ControlButton
    className="text-base font-medium py-1"
    intent="none"
    onClick={() => {
      activateButtonFn('space-button', showAnswerFn);
    }}
    active={activeButtonKey === 'space-button'}
    outlined
  >
    Show Answer{' '}
    <span className="ml-2">
      <ButtonTags>SPACE</ButtonTags>
    </span>
  </ControlButton>
);

const FinishedControls = ({ onStartCrammingClick, onCloseCallback }) => {
  return (
    <>
      <Tooltip content="Review all cards without waiting for scheduling" placement="top">
        <Blueprint.Button
          className="text-base font-medium py-1"
          intent="none"
          onClick={onStartCrammingClick}
          outlined
        >
          Continue Cramming
        </Blueprint.Button>
      </Tooltip>
      <Blueprint.Button
        className="text-base font-medium py-1"
        intent="primary"
        onClick={onCloseCallback}
        outlined
      >
        Close
      </Blueprint.Button>
    </>
  );
};

const GradingControlsWrapper = ({
  activeButtonKey,
  skipFn,
  gradeFn,
  intervalEstimates,
  intervalPractice,
  isIntervalEditorOpen,
  toggleIntervalEditorOpen,
  onPrevClick,
}) => {
  const { reviewMode, onSelectReviewMode, cardMeta } = React.useContext(MainContext);

  const isFixedModeActive = isFixedMode(reviewMode);
  const isProgressiveLBLActive = isProgressiveLBLMode(reviewMode);
  return (
    <div className="flex items-center flex-wrap justify-evenly gap-3 w-full">
      <button
        type="button"
        aria-label="Previous"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPrevClick();
        }}
        className="bp3-button bp3-minimal"
        style={{
          minWidth: '44px',
          minHeight: '44px',
          padding: '0 10px',
          fontSize: '18px',
          lineHeight: 1,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        ◀
      </button>
      <button
        type="button"
        aria-label="Next"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          skipFn();
        }}
        className="bp3-button bp3-minimal"
        style={{
          minWidth: '44px',
          minHeight: '44px',
          padding: '0 10px',
          fontSize: '18px',
          lineHeight: 1,
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        ▶
      </button>
      {isProgressiveLBLActive ? (
        <ReadingModeControls
          activeButtonKey={activeButtonKey}
          intervalPractice={intervalPractice}
          intervalEstimates={intervalEstimates}
        />
      ) : isFixedModeActive ? (
        <FixedIntervalModeControls
          activeButtonKey={activeButtonKey}
          intervalPractice={intervalPractice}
          isIntervalEditorOpen={isIntervalEditorOpen}
          toggleIntervalEditorOpen={toggleIntervalEditorOpen}
          intervalEstimates={intervalEstimates}
        />
      ) : (
        <SpacedIntervalModeControls
          activeButtonKey={activeButtonKey}
          gradeFn={gradeFn}
          intervalEstimates={intervalEstimates}
        />
      )}
      <ReviewModeSelector
        cardMeta={cardMeta}
        onSelectReviewMode={onSelectReviewMode}
      />
    </div>
  );
};

/**
 * ReadingModeControls
 *
 * Simplified grading UI for Incremental Read mode (FIXED_PROGRESSIVE_LBL).
 * Displays a "Read" indicator with the next interval and a "Next" button
 * that advances to the next card. No grading buttons — the per-child
 * Progressive interval is calculated automatically in onLineByLineGrade.
 */
const ReadingModeControls = ({
  activeButtonKey,
  intervalPractice,
  intervalEstimates,
}: {
  activeButtonKey: string;
  intervalPractice: () => void;
  intervalEstimates: IntervalEstimates;
}): JSX.Element => {
  const { reviewMode } = React.useContext(MainContext);
  if (!intervalEstimates) {
    console.error('Interval estimates not set');
    return <></>;
  }

  return (
    <>
      <ControlButton
        icon="book"
        className="text-base font-normal py-1"
        intent="default"
        tooltipText={`Next section in ${intervalEstimates[0]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'change-interval-button'}
        outlined
      >
        <span className="ml-2">
          Read <span className="font-medium mr-3">{intervalEstimates[0]?.nextDueDateFromNow || 'Progressive'}</span>
        </span>
      </ControlButton>
      <ControlButton
        icon="tick"
        className="text-base font-medium py-1"
        intent="success"
        onClick={() => intervalPractice()}
        tooltipText={`Next card — resume reading in ${intervalEstimates[0]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'next-button'}
        outlined
      >
        Next{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </>
  );
};

const FixedIntervalEditor = () => {
  const {
    intervalMultiplier,
    setIntervalMultiplier,
  } = React.useContext(MainContext);
  const handleInputValueChange = (numericValue) => {
    if (isNaN(numericValue)) return;
    setIntervalMultiplier(numericValue);
  };

  return (
    <div className="flex p-2 items-center w-80 justify-evenly">
      <div className="">Every</div>
      <div className="w-24">
        <Blueprint.NumericInput
          min={1}
          max={365}
          stepSize={1}
          majorStepSize={30}
          minorStepSize={1}
          value={intervalMultiplier}
          onValueChange={handleInputValueChange}
          fill
        />
      </div>
    </div>
  );
};

const IntervalString = ({ reviewMode, intervalMultiplier, nextDueDateFromNow }) => {
  if (reviewMode === ReviewModes.FixedProgressive) {
    const displayText = nextDueDateFromNow || 'Progressive';
    return (
      <>
        Review <span className="font-medium mr-3">{displayText}</span>
      </>
    );
  }

  let singularString = '';
  if (intervalMultiplier === 1) {
    switch (reviewMode) {
      case ReviewModes.FixedWeeks:
        singularString += 'Weekly';
        break;
      case ReviewModes.FixedMonths:
        singularString += 'Monthly';
        break;
      case ReviewModes.FixedYears:
        singularString += 'Yearly';
        break;
      default:
        singularString += 'Daily';
        break;
    }
  }

  const unitLabel = (() => {
    switch (reviewMode) {
      case ReviewModes.FixedWeeks: return 'Weeks';
      case ReviewModes.FixedMonths: return 'Months';
      case ReviewModes.FixedYears: return 'Years';
      default: return 'Days';
    }
  })();

  return (
    <>
      Review{' '}
      <span className="font-medium mr-3">
        {singularString ? (
          singularString
        ) : (
          <>
            Every {intervalMultiplier} {unitLabel}
          </>
        )}
      </span>
    </>
  );
};

const FixedIntervalModeControls = ({
  activeButtonKey,
  intervalPractice,
  isIntervalEditorOpen,
  toggleIntervalEditorOpen,
  intervalEstimates,
}: {
  activeButtonKey: string;
  intervalPractice: () => void;
  isIntervalEditorOpen: boolean;
  toggleIntervalEditorOpen: () => void;
  intervalEstimates: IntervalEstimates;
}): JSX.Element => {
  const { intervalMultiplier, reviewMode } = React.useContext(MainContext);
  const onInteractionhandler = (nextState) => {
    if (!nextState && isIntervalEditorOpen) toggleIntervalEditorOpen();
  };
  if (!intervalEstimates) {
    console.error('Interval estimates not set');
    return <></>;
  }

  return (
    <>
      <Blueprint.Popover isOpen={isIntervalEditorOpen} onInteraction={onInteractionhandler}>
        <ControlButton
          icon="time"
          className="text-base font-normal py-1"
          intent="default"
          onClick={toggleIntervalEditorOpen}
          tooltipText={`Change Interval`}
          active={activeButtonKey === 'change-interval-button'}
          outlined
        >
          <span className="ml-2">
            <IntervalString
              reviewMode={reviewMode}
              intervalMultiplier={intervalMultiplier}
              nextDueDateFromNow={intervalEstimates[0]?.nextDueDateFromNow}
            />
            <ButtonTags>E</ButtonTags>
          </span>
        </ControlButton>
        <FixedIntervalEditor />
      </Blueprint.Popover>
      <ControlButton
        icon="tick"
        className="text-base font-medium py-1"
        intent="success"
        onClick={() => intervalPractice()}
        tooltipText={`Review ${intervalEstimates[0].nextDueDateFromNow}`}
        active={activeButtonKey === 'next-button'}
        outlined
      >
        Next{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </>
  );
};

const SpacedIntervalModeControls = ({
  activeButtonKey,
  gradeFn,
  intervalEstimates,
}: {
  activeButtonKey: string;
  gradeFn: (grade: number) => void;
  intervalEstimates: IntervalEstimates;
}): JSX.Element => {
  if (!intervalEstimates) {
    console.error('Interval estimates not set');
    return <></>;
  }

  return (
    <>
      <ControlButton
        key="forget-button"
        className="text-base font-medium py-1"
        intent="danger"
        tooltipText={`Review ${intervalEstimates[0]?.nextDueDateFromNow}`}
        onClick={() => gradeFn(0)}
        active={activeButtonKey === 'forgot-button'}
      >
        Forgot{' '}
        <span className="ml-2">
          <ButtonTags>F</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="warning"
        onClick={() => gradeFn(2)}
        tooltipText={`Review ${intervalEstimates[2]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'hard-button'}
      >
        Hard{' '}
        <span className="ml-2">
          <ButtonTags>H</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="primary"
        onClick={() => gradeFn(4)}
        tooltipText={`Review ${intervalEstimates[4]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'good-button'}
      >
        Good{' '}
        <span className="ml-2">
          <ButtonTags>G</ButtonTags>
        </span>
      </ControlButton>
      <ControlButton
        className="text-base font-medium py-1"
        intent="success"
        onClick={() => gradeFn(5)}
        tooltipText={`Review ${intervalEstimates[5]?.nextDueDateFromNow}`}
        active={activeButtonKey === 'perfect-button'}
      >
        Perfect{' '}
        <span className="ml-2">
          <ButtonTags>SPACE</ButtonTags>
        </span>
      </ControlButton>
    </>
  );
};

const FooterWrapper = styled.div`
  min-height: 50px;
  border-top: 1px solid ${colors.borderSubtle};

  & .bp3-button-text {
    display: flex;
    justify-content: center;
    align-items: center;
  }

  background-color: transparent;
`;

const FooterActionsWrapper = styled.div`
  &.bp3-dialog-footer-actions .bp3-button {
    margin-left: 0;
  }
`;

const ControlButtonWrapper = styled(Blueprint.Button, {
  shouldForwardProp: (prop) => prop !== '$intentTone',
})<{ $intentTone?: string }>`
  && {
    background: ${colors.overlayLight} !important;
    background-color: ${colors.overlayLight} !important;
    border: none !important;
    box-shadow: inset 0 0 0 1px ${colors.borderSubtle} !important;
  }

  color: ${(props) => getIntentColor(props.$intentTone)};

  & .bp3-button-text {
    color: ${(props) => getIntentColor(props.$intentTone)};
  }

  &&:hover {
    background: ${colors.overlayLightHover} !important;
    background-color: ${colors.overlayLightHover} !important;
    box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.3) !important;
  }
`;

type ControlButtonIntent = Intent | 'default' | 'none';

interface ControlButtonProps extends Omit<Blueprint.IButtonProps, 'intent'> {
  tooltipText?: string;
  wrapperClassName?: string;
  intent?: ControlButtonIntent;
  children?: React.ReactNode;
}

const ControlButton = ({ tooltipText, wrapperClassName = '', intent, ...props }: ControlButtonProps) => {
  const buttonIntent = intent === 'default' || intent === 'none' ? undefined : intent;

  return (
    <Tooltip content={tooltipText || ''} placement="top" wrapperClassName={wrapperClassName}>
      <ControlButtonWrapper {...props} intent={buttonIntent} $intentTone={intent} />
    </Tooltip>
  );
};

interface ReviewModeOption {
  reviewMode: ReviewModes;
  label: string;
  icon: IconName;
  group: string;
}

const REVIEW_MODE_OPTIONS: ReviewModeOption[] = [
  { reviewMode: ReviewModes.SpacedInterval, label: 'Spaced Interval', icon: 'history', group: 'Spaced' },
  { reviewMode: ReviewModes.SpacedIntervalLBL, label: 'LBL Spaced', icon: 'list', group: 'Spaced' },
  { reviewMode: ReviewModes.FixedProgressive, label: 'Progressive', icon: 'trending-up', group: 'Fixed' },
  { reviewMode: ReviewModes.FixedProgressiveLBL, label: 'Incremental Read', icon: 'book', group: 'Reading' },
  { reviewMode: ReviewModes.FixedDays, label: 'Days', icon: 'calendar', group: 'Fixed' },
  { reviewMode: ReviewModes.FixedWeeks, label: 'Weeks', icon: 'calendar', group: 'Fixed' },
  { reviewMode: ReviewModes.FixedMonths, label: 'Months', icon: 'calendar', group: 'Fixed' },
  { reviewMode: ReviewModes.FixedYears, label: 'Years', icon: 'calendar', group: 'Fixed' },
];
const ReviewModeSelect = BlueprintSelect.Select.ofType<ReviewModeOption>();

const getActiveOption = (cardMeta: import('~/models/session').CardMeta | undefined): ReviewModeOption => {
  const rm = cardMeta?.reviewMode;
  if (rm) {
    return REVIEW_MODE_OPTIONS.find(o => o.reviewMode === rm) || REVIEW_MODE_OPTIONS[2];
  }
  return REVIEW_MODE_OPTIONS[2];
};

const ReviewModeSelectorItemWrapper = styled.div<{ active: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  position: relative;
  user-select: none;
  cursor: pointer;
  border-radius: 2px;
  font-size: 13px;

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

const ReviewModeSelector = ({
  cardMeta,
  onSelectReviewMode,
}: {
  cardMeta: import('~/models/session').CardMeta | undefined;
  onSelectReviewMode: (reviewMode: ReviewModes) => void;
}) => {
  const activeOption = getActiveOption(cardMeta);

  return (
    <ReviewModeSelect
      items={REVIEW_MODE_OPTIONS}
      activeItem={activeOption}
      filterable={false}
      itemRenderer={(option: ReviewModeOption, { handleClick, modifiers }) => {
        const isActive = option.reviewMode === activeOption.reviewMode;
        return (
          <ReviewModeSelectorItemWrapper
            active={modifiers.active}
            key={option.reviewMode}
            onClick={handleClick}
            data-testid={`card-type-option-${option.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Blueprint.Icon icon={option.icon} iconSize={14} style={{ opacity: isActive ? 1 : 0.6 }} />
            <span style={{ fontWeight: isActive ? 600 : 400 }}>{option.label}</span>
            {isActive && <Blueprint.Icon icon="tick" iconSize={12} style={{ marginLeft: 'auto', color: '#0d8050' }} />}
          </ReviewModeSelectorItemWrapper>
        );
      }}
      onItemSelect={(option: ReviewModeOption) => {
        onSelectReviewMode(option.reviewMode);
      }}
      popoverProps={{ minimal: true }}
      itemPredicate={(_, _option: ReviewModeOption) => true}
    >
      <Blueprint.Button
        icon={activeOption.icon}
        rightIcon="caret-down"
        minimal
        data-testid="review-mode-button"
        style={{ fontSize: '12px' }}
      >
        {activeOption.label}
      </Blueprint.Button>
    </ReviewModeSelect>
  );
};

export default Footer;
