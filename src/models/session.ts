/**
 * Session & Card Data Models
 *
 * Data Architecture:
 *   Each card's data is split into two layers:
 *
 *   1. CardMeta (persistent, card-level):
 *      - reviewMode:      The card's review algorithm mode (e.g. SPACED_INTERVAL, FIXED_PROGRESSIVE).
 *                         This is the SINGLE SOURCE OF TRUTH for which algorithm to use.
 *                         Stored in the meta block on the data page.
 *      - lineByLineReview:  Whether line-by-line review is enabled (Y/N).
 *      - lineByLineProgress: JSON string tracking per-child progress for line-by-line cards.
 *      - nextDueDate:     Earliest due date across all children (for line-by-line) or the card itself.
 *
 *   2. Session (per-review, historical):
 *      - grade, interval, repetitions, eFactor, etc.
 *      - These are algorithm-specific parameters recorded at each review.
 *      - Different review modes produce different session fields,
 *        but all modes converge onto the SM2 memory curve.
 *
 *   Note: reviewMode, lineByLineReview, lineByLineProgress appear in the Session type
 *   for convenience (they're merged from CardMeta when reading card data),
 *   but they are NOT stored in session records — they live in the meta block only.
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
  mode === ReviewModes.SpacedIntervalLBL || mode === ReviewModes.FixedProgressiveLBL;

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
 *
 * Meta-level fields (reviewMode, lineByLineReview, lineByLineProgress) are included
 * here for convenience when passing card data through the UI, but they originate
 * from CardMeta, not from session records. They should NOT be written to session blocks.
 */
export type Session = {
  reviewMode: ReviewModes;
  repetitions?: number;
  interval?: number;
  eFactor?: number;
  grade?: number;
  intervalMultiplier?: number;
  progressiveRepetitions?: number;
  lineByLineReview?: string;
  lineByLineProgress?: string;
} & SessionCommon;

/**
 * CardMeta: persistent card-level properties stored in the meta block.
 * This is the authoritative source for reviewMode and line-by-line settings.
 */
export interface CardMeta {
  reviewMode?: ReviewModes;
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

export interface LineByLineChildData {
  nextDueDate: string;
  interval: number;
  repetitions: number;
  eFactor: number;
  progressiveRepetitions?: number;
}

export type LineByLineProgressMap = Record<string, LineByLineChildData>;
