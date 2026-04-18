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
  baseSessionData?: Session;
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

export interface CompleteRecords {
  [key: RecordUid]: Session[];
}

export interface LineByLineChildData {
  nextDueDate: string;
  sm2_interval?: number;
  sm2_repetitions?: number;
  sm2_eFactor?: number;
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

/**
 * 交互模式枚举。
 * 仅 NORMAL 和 LBL 两种：LBL 的具体行为由算法决定（SM2→打分，Fixed→Next 翻页）。
 * 已移除 READ（Incremental Read），因为 READ 本质上就是 LBL + Progressive，功能重复。
 */
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

export const isFixedAlgorithm = (algorithm: SchedulingAlgorithm | undefined): boolean => {
  if (!algorithm) return false;
  return ALGORITHM_META[algorithm]?.group === 'Fixed';
};

export const isSpacedAlgorithm = (algorithm: SchedulingAlgorithm | undefined): boolean => {
  if (!algorithm) return false;
  return ALGORITHM_META[algorithm]?.group === 'Spaced';
};

export const isLBLReviewMode = (interaction?: InteractionStyle): boolean =>
  interaction === InteractionStyle.LBL;

export const getDefaultIntervalMultiplier = (algorithm: SchedulingAlgorithm | undefined): number => {
  if (algorithm === SchedulingAlgorithm.PROGRESSIVE) return 2;
  if (isFixedAlgorithm(algorithm)) return 3;
  return 3;
};

/**
 * 解析算法和交互配置。无效值回退到默认（SM2 + NORMAL）。
 * 不再做 READ→LBL 的运行时兼容映射，由 Data Migration 负责数据转换。
 */
export const resolveReviewConfig = (
  rawAlgorithm?: string,
  rawInteraction?: string
): ReviewConfig => {
  const algorithm = Object.values(SchedulingAlgorithm).find(a => a === rawAlgorithm) || DEFAULT_REVIEW_CONFIG.algorithm;
  const interaction = Object.values(InteractionStyle).find(i => i === rawInteraction) || DEFAULT_REVIEW_CONFIG.interaction;
  return { algorithm, interaction };
};
