/**
 * Constants
 *
 * All practice data fields are now stored uniformly in session blocks.
 * The meta block architecture has been removed — reviewMode, nextDueDate,
 * and lineByLineProgress are saved directly in each session record alongside
 * algorithm-specific fields (grade, interval, eFactor, etc.).
 *
 * CARD_META_SESSION_KEYS is kept empty as a no-op guard for backward
 * compatibility during the transition period.
 */

export const CARD_META_SESSION_KEYS = new Set<string>();
