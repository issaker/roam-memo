/**
 * Session & Card Data Models
 *
 * Unified Data Architecture:
 *   All card data is stored in session blocks — no separate meta block.
 *   The latest session block is the single source of truth.
 *
 *   Session block fields:
 *   - reviewMode:         The card's review algorithm mode (e.g. SPACED_INTERVAL, FIXED_PROGRESSIVE).
 *                         LBL modes (SPACED_INTERVAL_LBL, FIXED_PROGRESSIVE_LBL) encode
 *                         line-by-line functionality directly — no separate lineByLineReview field.
 *   - nextDueDate:        Next due date for the card.
 *   - lineByLineProgress: JSON string tracking per-child progress for LBL cards.
 *   - grade, interval, repetitions, eFactor, etc.: Algorithm-specific parameters.
 */

export enum ReviewModes {
  SpacedInterval = 'SPACED_INTERVAL',
  SpacedIntervalLBL = 'SPACED_INTERVAL_LBL',
  FixedProgressive = 'FIXED_PROGRESSIVE',
  FixedProgressiveLBL = 'FIXED_PROGRESSIVE_LBL',
  FixedDays = 'FIXED_DAYS',
  FixedWeeks = 'FIXED_WEEKS',
  FixedMonths = 'FIXED_MONTHS',
  FixedYears = 'FIXED_YEARS',
}

export const isFixedMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.FixedProgressive ||
  mode === ReviewModes.FixedProgressiveLBL ||
  mode === ReviewModes.FixedDays ||
  mode === ReviewModes.FixedWeeks ||
  mode === ReviewModes.FixedMonths ||
  mode === ReviewModes.FixedYears;

export const isSpacedMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.SpacedInterval || mode === ReviewModes.SpacedIntervalLBL;

export const isLineByLineMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.SpacedIntervalLBL;

export const isReadingMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.FixedProgressiveLBL;

export const DEFAULT_REVIEW_MODE = ReviewModes.FixedProgressive;

export const LEGACY_REVIEW_MODE_MAP: Record<string, ReviewModes> = {
  FIXED_INTERVAL: ReviewModes.FixedProgressive,
  SPACED_INTERVAL: ReviewModes.SpacedInterval,
};

export const resolveReviewMode = (rawMode: string | undefined, intervalMultiplierType?: string): ReviewModes => {
  if (!rawMode) return DEFAULT_REVIEW_MODE;
  if (rawMode in ReviewModes) return rawMode as ReviewModes;
  if (rawMode in LEGACY_REVIEW_MODE_MAP) {
    const resolved = LEGACY_REVIEW_MODE_MAP[rawMode];
    if (resolved === ReviewModes.FixedProgressive && intervalMultiplierType) {
      const subModeMap: Record<string, ReviewModes> = {
        Days: ReviewModes.FixedDays,
        Weeks: ReviewModes.FixedWeeks,
        Months: ReviewModes.FixedMonths,
        Years: ReviewModes.FixedYears,
        Progressive: ReviewModes.FixedProgressive,
      };
      return subModeMap[intervalMultiplierType] || resolved;
    }
    return resolved;
  }
  return DEFAULT_REVIEW_MODE;
};

interface SessionCommon {
  nextDueDate?: Date;
  dateCreated?: Date;
  isRoamSrOldPracticeRecord?: boolean;
}

/**
 * Session: represents a single review record for a card.
 * All fields are stored uniformly in session blocks.
 */
export type Session = {
  reviewMode: ReviewModes;
  repetitions?: number;
  interval?: number;
  eFactor?: number;
  grade?: number;
  intervalMultiplier?: number;
  progressiveRepetitions?: number;
  lineByLineProgress?: string;
} & SessionCommon;

/**
 * CardMeta: derived from the latest session block for UI convenience.
 * No longer persisted separately — the latest session is the authority.
 */
export interface CardMeta {
  reviewMode?: ReviewModes;
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

export interface LineByLineChildData {
  nextDueDate: string;
  interval: number;
  repetitions: number;
  eFactor: number;
  progressiveRepetitions?: number;
}

export type LineByLineProgressMap = Record<string, LineByLineChildData>;
