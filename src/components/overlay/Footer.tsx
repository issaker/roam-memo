import * as React from 'react';
import * as Blueprint from '@blueprintjs/core';
import type { IconName } from '@blueprintjs/core';
import * as BlueprintSelect from '@blueprintjs/select';
import styled from '@emotion/styled';
import * as asyncUtils from '~/utils/async';
import { generatePracticeData } from '~/practice';
import Tooltip from '~/components/Tooltip';
import ButtonTags from '~/components/ButtonTags';
import { CardType, IntervalMultiplierType, ReviewModes } from '~/models/session';
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
  const { reviewMode, intervalMultiplier, intervalMultiplierType } = React.useContext(MainContext);

  const [isIntervalEditorOpen, setIsIntervalEditorOpen] = React.useState(false);

  const toggleIntervalEditorOpen = () => setIsIntervalEditorOpen((prev) => !prev);
  // So we can flash the activated button when using keyboard shortcuts before transitioning
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
            if (reviewMode === ReviewModes.FixedInterval) {
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
        disabled: reviewMode === ReviewModes.FixedInterval,
      },
      {
        combo: 'H',
        global: true,
        label: 'Grade 2',
        onKeyDown: () => gradeFn(2),
        disabled: reviewMode === ReviewModes.FixedInterval,
      },
      {
        combo: 'G',
        global: true,
        label: 'Grade 4',
        onKeyDown: () => gradeFn(4),
        disabled: reviewMode !== ReviewModes.DefaultSpacedInterval,
      },
      {
        combo: 'E',
        global: true,
        label: 'Edit Interval',
        onKeyDown: toggleIntervalEditorOpen,
        disabled: reviewMode !== ReviewModes.FixedInterval,
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

    const iterateCount = reviewMode === ReviewModes.FixedInterval ? 1 : grades.length;
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
        intervalMultiplierType,
        progressiveRepetitions,
      });
      estimates[grade] = practiceResultData;
    }
    return estimates;
  }, [currentCardData, intervalMultiplier, intervalMultiplierType, reviewMode]);

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
  // @ts-ignore
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
  const { reviewMode, onSelectCardType, cardMeta, intervalMultiplierType } = React.useContext(MainContext);

  const isFixedIntervalMode = reviewMode === ReviewModes.FixedInterval;
  return (
    <div className="flex items-center flex-wrap justify-evenly gap-3 w-full">
      <button
        type="button"
        aria-label="上一页"
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
        aria-label="下一页"
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
      {isFixedIntervalMode ? (
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
      {/* @ts-ignore */}
      <CardTypeSelector
        cardMeta={cardMeta}
        intervalMultiplierType={intervalMultiplierType}
        onSelectCardType={onSelectCardType}
      />
    </div>
  );
};

const FixedIntervalEditor = () => {
  const {
    intervalMultiplier,
    intervalMultiplierType,
    setIntervalMultiplier,
    setIntervalMultiplierType,
  } = React.useContext(MainContext);
  const handleInputValueChange = (numericValue) => {
    if (isNaN(numericValue)) return;
    setIntervalMultiplier(numericValue);
  };

  const intervalMultiplierTypes = [
    { value: IntervalMultiplierType.Progressive, label: 'Progressive' },
    { value: IntervalMultiplierType.Days, label: 'Days' },
    { value: IntervalMultiplierType.Weeks, label: 'Weeks' },
    { value: IntervalMultiplierType.Months, label: 'Months' },
    { value: IntervalMultiplierType.Years, label: 'Years' },
  ];

  const isProgressiveMode = intervalMultiplierType === IntervalMultiplierType.Progressive;

  return (
    <div className={`flex p-2 items-center ${isProgressiveMode ? 'w-auto' : 'w-80'} justify-evenly`}>
      {!isProgressiveMode && <div className="">Every</div>}
      {!isProgressiveMode && (
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
      )}
      <div className="bp3-html-select">
        <select
          value={intervalMultiplierType}
          onChange={(e) =>
            setIntervalMultiplierType(e.currentTarget.value as IntervalMultiplierType)
          }
        >
          {intervalMultiplierTypes.map((option) => (
            <option
              key={option.value}
              value={option.value}
              selected={option.value === intervalMultiplierType}
            >
              {option.label}
            </option>
          ))}
        </select>
        <span className="bp3-icon bp3-icon-double-caret-vertical"></span>
      </div>
    </div>
  );
};

const IntervalString = ({ intervalMultiplier, intervalMultiplierType, nextDueDateFromNow }) => {
  // Progressive mode: show when the next review is due
  if (intervalMultiplierType === IntervalMultiplierType.Progressive) {
    const displayText = nextDueDateFromNow || 'Progressive';
    return (
      <>
        Review <span className="font-medium mr-3">{displayText}</span>
      </>
    );
  }

  let singularString = '';
  if (intervalMultiplier === 1) {
    switch (intervalMultiplierType) {
      case IntervalMultiplierType.Weeks:
        singularString += 'Weekly';
        break;
      case IntervalMultiplierType.Months:
        singularString += 'Monthly';
        break;
      case IntervalMultiplierType.Years:
        singularString += 'Yearly';
        break;
      default:
        singularString += 'Daily';
        break;
    }
  }

  return (
    <>
      Review{' '}
      <span className="font-medium mr-3">
        {singularString ? (
          singularString
        ) : (
          <>
            Every {intervalMultiplier} {intervalMultiplierType}
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
  const { intervalMultiplier, intervalMultiplierType } = React.useContext(MainContext);
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
              intervalMultiplier={intervalMultiplier}
              intervalMultiplierType={intervalMultiplierType}
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

  /* 内部组件不定义背景色，继承 Dialog 容器的背景 */
  background-color: transparent;
`;

const FooterActionsWrapper = styled.div`
  &.bp3-dialog-footer-actions .bp3-button {
    margin-left: 0;
  }
`;

const ControlButtonWrapper = styled(Blueprint.Button)<{ intent?: string }>`
  && {
    background: ${colors.overlayLight} !important;
    background-color: ${colors.overlayLight} !important;
    border: none !important;
    box-shadow: inset 0 0 0 1px ${colors.borderSubtle} !important;
  }

  color: ${(props) => getIntentColor(props.intent)};

  & .bp3-button-text {
    color: ${(props) => getIntentColor(props.intent)};
  }

  &&:hover {
    background: ${colors.overlayLightHover} !important;
    background-color: ${colors.overlayLightHover} !important;
    box-shadow: inset 0 0 0 1px rgba(128, 128, 128, 0.3) !important;
  }
`;

const ControlButton = ({ tooltipText, wrapperClassName = '', ...props }) => {
  return (
    // @ts-ignore
    <Tooltip content={tooltipText} placement="top" wrapperClassName={wrapperClassName}>
      <ControlButtonWrapper {...props} />
    </Tooltip>
  );
};

interface CardTypeOption {
  cardType: CardType;
  intervalMultiplierType?: IntervalMultiplierType;
  label: string;
  icon: IconName;
  group: string;
}

const CARD_TYPE_OPTIONS: CardTypeOption[] = [
  { cardType: CardType.SpacedInterval, label: 'Spaced Interval', icon: 'history', group: 'Spaced' },
  { cardType: CardType.SpacedIntervalLineByLine, label: 'LBL Spaced', icon: 'list', group: 'Spaced' },
  { cardType: CardType.FixedInterval, intervalMultiplierType: IntervalMultiplierType.Progressive, label: 'Progressive', icon: 'trending-up', group: 'Fixed' },
  { cardType: CardType.FixedInterval, intervalMultiplierType: IntervalMultiplierType.Days, label: 'Days', icon: 'calendar', group: 'Fixed' },
  { cardType: CardType.FixedInterval, intervalMultiplierType: IntervalMultiplierType.Weeks, label: 'Weeks', icon: 'calendar', group: 'Fixed' },
  { cardType: CardType.FixedInterval, intervalMultiplierType: IntervalMultiplierType.Months, label: 'Months', icon: 'calendar', group: 'Fixed' },
  { cardType: CardType.FixedInterval, intervalMultiplierType: IntervalMultiplierType.Years, label: 'Years', icon: 'calendar', group: 'Fixed' },
];

const getActiveOption = (cardMeta: import('~/models/session').CardMeta | undefined, intervalMultiplierType: IntervalMultiplierType): CardTypeOption => {
  const ct = cardMeta?.cardType;
  if (ct === CardType.SpacedIntervalLineByLine) {
    return CARD_TYPE_OPTIONS[1];
  }
  if (ct === CardType.FixedInterval || ct === undefined) {
    const imt = intervalMultiplierType || IntervalMultiplierType.Progressive;
    return CARD_TYPE_OPTIONS.find(o => o.cardType === CardType.FixedInterval && o.intervalMultiplierType === imt) || CARD_TYPE_OPTIONS[2];
  }
  return CARD_TYPE_OPTIONS[0];
};

const CardTypeSelectorItemWrapper = styled.div<{ active: boolean }>`
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

const CardTypeSelector = ({
  cardMeta,
  intervalMultiplierType,
  onSelectCardType,
}: {
  cardMeta: import('~/models/session').CardMeta | undefined;
  intervalMultiplierType: IntervalMultiplierType;
  onSelectCardType: (cardType: CardType, intervalMultiplierType?: IntervalMultiplierType) => void;
}) => {
  const activeOption = getActiveOption(cardMeta, intervalMultiplierType);

  return (
    // @ts-ignore
    <BlueprintSelect.Select
      items={CARD_TYPE_OPTIONS}
      activeItem={activeOption}
      filterable={false}
      itemRenderer={(option: CardTypeOption, { handleClick, modifiers }) => {
        const isActive = option.cardType === activeOption.cardType
          && option.intervalMultiplierType === activeOption.intervalMultiplierType;
        return (
          <CardTypeSelectorItemWrapper
            active={modifiers.active}
            key={`${option.cardType}-${option.intervalMultiplierType || 'none'}`}
            onClick={handleClick}
            data-testid={`card-type-option-${option.label.toLowerCase().replace(/\s+/g, '-')}`}
          >
            <Blueprint.Icon icon={option.icon} iconSize={14} style={{ opacity: isActive ? 1 : 0.6 }} />
            <span style={{ fontWeight: isActive ? 600 : 400 }}>{option.label}</span>
            {isActive && <Blueprint.Icon icon="tick" iconSize={12} style={{ marginLeft: 'auto', color: '#0d8050' }} />}
          </CardTypeSelectorItemWrapper>
        );
      }}
      onItemSelect={(option: CardTypeOption) => {
        onSelectCardType(option.cardType, option.intervalMultiplierType);
      }}
      popoverProps={{ minimal: true }}
      itemPredicate={(_, _option: CardTypeOption) => true}
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
    </BlueprintSelect.Select>
  );
};

export default Footer;
