/**
 * Session Data Model
 *
 * Represents a single review session for a card.
 * Each card can have multiple sessions (review history).
 *
 * Two review modes determine which fields are used:
 * - SPACED_INTERVAL: grade, repetitions, interval, eFactor (SM2 algorithm)
 * - FIXED_INTERVAL: intervalMultiplier, intervalMultiplierType, progressiveRepetitions
 */
export enum ReviewModes {
  FixedInterval = 'FIXED_INTERVAL',
  DefaultSpacedInterval = 'SPACED_INTERVAL',
}

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
