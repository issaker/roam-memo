/**
 * Constants
 *
 * CARD_META_BLOCK_NAME: The block name for card metadata on the data page.
 *
 * CARD_META_SESSION_KEYS: Fields that appear in the practice result data
 * but should be routed to the meta block (not session records) when saving.
 *
 * - reviewMode: Must be persisted to meta on every practice click to ensure
 *   new cards get their reviewMode written to meta immediately.
 * - nextDueDate: Written to meta as the single source of truth for when a
 *   card is due next. Not written to session records to avoid redundant
 *   per-session nextDueDate values that cause confusion when modes switch.
 *
 * lineByLineReview and lineByLineProgress were previously in this set but
 * are now handled exclusively by updateCardType() and updateLineByLineProgress()
 * respectively, so they no longer need to be routed through savePracticeData.
 */

export const CARD_META_BLOCK_NAME = 'meta';

export const CARD_META_SESSION_KEYS = new Set(['reviewMode', 'nextDueDate']);
