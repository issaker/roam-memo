export enum ReviewModes {
  SpacedInterval = 'SPACED_INTERVAL',
  SpacedIntervalLBL = 'SPACED_INTERVAL_LBL',
  FixedProgressive = 'FIXED_PROGRESSIVE',
  FixedDays = 'FIXED_DAYS',
  FixedWeeks = 'FIXED_WEEKS',
  FixedMonths = 'FIXED_MONTHS',
  FixedYears = 'FIXED_YEARS',
}

export const isFixedMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.FixedProgressive ||
  mode === ReviewModes.FixedDays ||
  mode === ReviewModes.FixedWeeks ||
  mode === ReviewModes.FixedMonths ||
  mode === ReviewModes.FixedYears;

export const isSpacedMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.SpacedInterval || mode === ReviewModes.SpacedIntervalLBL;

export const isLineByLineMode = (mode: ReviewModes | undefined): boolean =>
  mode === ReviewModes.SpacedIntervalLBL;

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
}

export type LineByLineProgressMap = Record<string, LineByLineChildData>;
