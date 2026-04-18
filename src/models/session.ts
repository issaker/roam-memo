/**
 * Session & Card Data Models
 *
 * Unified Data Architecture:
 *   All card data is stored in session blocks — no separate meta block.
 *   The latest session block is the single source of truth.
 *
 *   Field naming convention: {owner}_{purpose}
 *   - sm2_*:      SM2 algorithm fields
 *   - progressive_*: Progressive algorithm fields
 *   - fixed_*:    Fixed interval algorithm fields
 *   - lbl_*:      Line by Line interaction fields
 *   - (no prefix): Universal/config fields
 *
 *   Session block fields:
 *   - algorithm:          Scheduling algorithm (SM2, PROGRESSIVE, FIXED_DAYS, etc.)
 *   - interaction:        Interaction style (NORMAL, LBL)
 *   - nextDueDate:        Next due date for the card.
 *   - lbl_progress:       JSON string tracking per-child progress for LBL cards.
 *   - sm2_grade, sm2_interval, sm2_repetitions, sm2_eFactor: SM2-specific parameters.
 *   - progressive_repetitions, progressive_interval: Progressive-specific parameters.
 *   - fixed_multiplier:   Fixed interval user-configured multiplier.
 */

interface SessionCommon {
  nextDueDate?: Date;
  dateCreated?: Date;
}

export type Session = {
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
  sm2_repetitions?: number;
  sm2_interval?: number;
  sm2_eFactor?: number;
  sm2_grade?: number;
  progressive_repetitions?: number;
  progressive_interval?: number;
  fixed_multiplier?: number;
  lbl_progress?: string;
} & SessionCommon;

export interface CardMeta {
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
  lbl_progress?: string;
  nextDueDate?: Date;
}

export interface NewSession extends Omit<Session, 'nextDueDate' | 'sm2_grade'> {
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
  sm2_interval: number;
  sm2_repetitions: number;
  sm2_eFactor: number;
  progressive_repetitions?: number;
}

export type LineByLineProgressMap = Record<string, LineByLineChildData>;

export enum SchedulingAlgorithm {
  SM2 = 'SM2',
  PROGRESSIVE = 'PROGRESSIVE',
  FIXED_DAYS = 'FIXED_DAYS',
  FIXED_WEEKS = 'FIXED_WEEKS',
  FIXED_MONTHS = 'FIXED_MONTHS',
  FIXED_YEARS = 'FIXED_YEARS',
}

export enum InteractionStyle {
  NORMAL = 'NORMAL',
  LBL = 'LBL',
}

export type ReviewConfig = {
  algorithm: SchedulingAlgorithm;
  interaction: InteractionStyle;
};

export const DEFAULT_REVIEW_CONFIG: ReviewConfig = {
  algorithm: SchedulingAlgorithm.SM2,
  interaction: InteractionStyle.NORMAL,
};

export type AlgorithmGroup = 'Spaced' | 'Fixed';

export type AlgorithmMeta = {
  group: AlgorithmGroup;
  label: string;
};

export type InteractionMeta = {
  label: string;
  icon?: string;
};

export const ALGORITHM_META: Record<SchedulingAlgorithm, AlgorithmMeta> = {
  [SchedulingAlgorithm.SM2]: { group: 'Spaced', label: 'SM2' },
  [SchedulingAlgorithm.PROGRESSIVE]: { group: 'Fixed', label: 'Progressive' },
  [SchedulingAlgorithm.FIXED_DAYS]: { group: 'Fixed', label: 'Fixed Days' },
  [SchedulingAlgorithm.FIXED_WEEKS]: { group: 'Fixed', label: 'Fixed Weeks' },
  [SchedulingAlgorithm.FIXED_MONTHS]: { group: 'Fixed', label: 'Fixed Months' },
  [SchedulingAlgorithm.FIXED_YEARS]: { group: 'Fixed', label: 'Fixed Years' },
};

export const INTERACTION_META: Record<InteractionStyle, InteractionMeta> = {
  [InteractionStyle.NORMAL]: { label: 'Normal', icon: 'layers' },
  [InteractionStyle.LBL]: { label: 'Line by Line', icon: 'list' },
};

export const isFixedAlgorithm = (algorithm: SchedulingAlgorithm): boolean => {
  return ALGORITHM_META[algorithm]?.group === 'Fixed';
};

export const isSpacedAlgorithm = (algorithm: SchedulingAlgorithm): boolean => {
  return ALGORITHM_META[algorithm]?.group === 'Spaced';
};

export const isFixedMode = (mode: SchedulingAlgorithm | undefined): boolean => {
  if (!mode) return false;
  return isFixedAlgorithm(mode);
};

export const isSpacedMode = (mode: SchedulingAlgorithm | undefined): boolean => {
  if (!mode) return false;
  return isSpacedAlgorithm(mode);
};

export const isLBLReviewMode = (interaction?: InteractionStyle): boolean =>
  interaction === InteractionStyle.LBL;

export const isLineByLineUI = (interaction?: InteractionStyle): boolean =>
  interaction === InteractionStyle.LBL;

export const resolveReviewConfig = (
  rawAlgorithm?: string,
  rawInteraction?: string
): ReviewConfig => {
  const algorithm = Object.values(SchedulingAlgorithm).find(a => a === rawAlgorithm) || DEFAULT_REVIEW_CONFIG.algorithm;
  const interaction = Object.values(InteractionStyle).find(i => i === rawInteraction) || DEFAULT_REVIEW_CONFIG.interaction;
  return { algorithm, interaction };
};
