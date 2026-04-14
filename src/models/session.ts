/**
 * Session Data Model
 *
 * Represents a single review session for a card.
 * Each card can have multiple sessions (review history).
 *
 * Card-level properties (stored in meta block, not per-session):
 *   - cardType: CardType (FIXED_INTERVAL, SPACED_INTERVAL, SPACED_INTERVAL_LBL)
 *   - lineByLineReview: 'Y' | 'N'
 *   - lineByLineProgress: JSON string
 *
 * Session-level properties (stored per review event):
 *   - SPACED_INTERVAL: grade, repetitions, interval, eFactor
 *   - FIXED_INTERVAL: intervalMultiplier, intervalMultiplierType, progressiveRepetitions
 */
export enum ReviewModes {
  FixedInterval = 'FIXED_INTERVAL',
  DefaultSpacedInterval = 'SPACED_INTERVAL',
}

export enum CardType {
  FixedInterval = 'FIXED_INTERVAL',
  SpacedInterval = 'SPACED_INTERVAL',
  SpacedIntervalLineByLine = 'SPACED_INTERVAL_LBL',
}

export const cardTypeToReviewMode = (cardType: CardType): ReviewModes => {
  if (cardType === CardType.FixedInterval) return ReviewModes.FixedInterval;
  return ReviewModes.DefaultSpacedInterval;
};

export const reviewModeToCardType = (
  reviewMode: ReviewModes,
  isLineByLine: boolean
): CardType => {
  if (reviewMode === ReviewModes.FixedInterval) return CardType.FixedInterval;
  return isLineByLine ? CardType.SpacedIntervalLineByLine : CardType.SpacedInterval;
};

interface SessionCommon {
  nextDueDate?: Date;
  dateCreated?: Date;
  isRoamSrOldPracticeRecord?: boolean;
}

export type Session = {
  reviewMode: ReviewModes;
  repetitions?: number;
  interval?: number;
  eFactor?: number;
  grade?: number;
  intervalMultiplier?: number;
  intervalMultiplierType?: IntervalMultiplierType;
  progressiveRepetitions?: number;
  lineByLineReview?: string;
  lineByLineProgress?: string;
} & SessionCommon;

export interface CardMeta {
  cardType?: CardType;
  lineByLineReview?: 'Y' | 'N';
  lineByLineProgress?: string;
  nextDueDate?: Date;
}

export interface NewSession extends Omit<Session, 'nextDueDate' | 'grade'> {
  isNew: boolean;
}

export type RecordUid = string;

export interface Records {
  [key: RecordUid]: Session | NewSession;
}

export interface NewRecords {
  [key: RecordUid]: NewSession;
}

export interface CompleteRecords {
  [key: RecordUid]: Session[];
}

export enum IntervalMultiplierType {
  Days = 'Days',
  Weeks = 'Weeks',
  Months = 'Months',
  Years = 'Years',
  Progressive = 'Progressive',
}

export interface LineByLineChildData {
  nextDueDate: string;
  interval: number;
  repetitions: number;
  eFactor: number;
}

export type LineByLineProgressMap = Record<string, LineByLineChildData>;
