/**
 * useCurrentCardData Hook
 *
 * Provides real-time card data for the currently displayed card in the practice overlay.
 *
 * Data sources:
 * 1. sessions prop: Complete session history from the initial data fetch (synchronous)
 * 2. Meta-only polling: Periodic lightweight queries to detect reviewMode changes
 *
 * Key outputs:
 * - currentCardData: Latest session data for the current card (Session type)
 * - cardMeta: Card-level metadata (reviewMode, lineByLine*) from the meta block
 * - reviewMode: Resolved from cardMeta as the SINGLE SOURCE OF TRUTH
 * - applyOptimisticCardMeta: Instant UI update before polling confirms the change
 */
import * as React from 'react';
import { CardMeta, Session, DEFAULT_REVIEW_MODE } from '~/models/session';
import { getCardMetaOnly } from '~/queries';

/**
 * Polling interval for live card data updates.
 * 2000ms balances responsiveness with performance.
 * Polling now reads ONLY the meta block (reviewMode, nextDueDate, etc.)
 * to detect mode changes — full session data is not re-queried on each poll.
 */
const CARD_DATA_POLL_INTERVAL = 2000;

const isCardMetaChanged = (prev: CardMeta | undefined, next: CardMeta | undefined): boolean => {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return (
    prev.reviewMode !== next.reviewMode ||
    prev.lineByLineReview !== next.lineByLineReview ||
    prev.lineByLineProgress !== next.lineByLineProgress
  );
};

export default function useCurrentCardData({
  currentCardRefUid,
  sessions,
  dataPageTitle,
}: {
  currentCardRefUid: string | undefined;
  sessions: Session[];
  dataPageTitle?: string;
}) {
  const latestSession = sessions[sessions.length - 1] as Session | undefined;
  const [currentCardData, setCurrentCardData] = React.useState<Session | undefined>(latestSession);
  const [cardMeta, setCardMeta] = React.useState<CardMeta | undefined>(undefined);

  /**
   * reviewMode: meta is the single source of truth.
   * - If cardMeta is loaded and has reviewMode → use it
   * - If cardMeta is loaded but has no reviewMode → use latestSession's reviewMode or DEFAULT
   * - If cardMeta is undefined (not yet loaded) → use latestSession's reviewMode or DEFAULT
   */
  const reviewMode = React.useMemo(() => {
    if (cardMeta?.reviewMode) return cardMeta.reviewMode;
    return latestSession?.reviewMode || DEFAULT_REVIEW_MODE;
  }, [cardMeta, latestSession]);

  const prevCardDataRef = React.useRef<Session | undefined>();
  const prevCardMetaRef = React.useRef<CardMeta | undefined>();
  const prevCardUidRef = React.useRef<string | undefined>();

  const applyOptimisticCardMeta = React.useCallback((newMeta: CardMeta) => {
    setCardMeta(newMeta);
    prevCardMetaRef.current = newMeta;
  }, []);

  React.useEffect(() => {
    if (!currentCardRefUid) {
      setCurrentCardData(undefined);
      setCardMeta(undefined);
      prevCardDataRef.current = undefined;
      prevCardMetaRef.current = undefined;
      prevCardUidRef.current = undefined;
      return;
    }

    const cardChanged = prevCardUidRef.current !== currentCardRefUid;
    prevCardUidRef.current = currentCardRefUid;

    if (cardChanged) {
      setCardMeta(undefined);
      prevCardMetaRef.current = undefined;

      if (latestSession) {
        setCurrentCardData(latestSession);
        prevCardDataRef.current = latestSession;
      }
    }
  }, [currentCardRefUid, latestSession]);

  React.useEffect(() => {
    if (!currentCardRefUid || !dataPageTitle) return;

    let cancelled = false;

    const fetchLiveMeta = async () => {
      try {
        const metaOnlyData = await getCardMetaOnly({ dataPageTitle });
        if (cancelled) return;

        const cardMetaRaw = metaOnlyData[currentCardRefUid];
        if (!cardMetaRaw) return;

        const resolvedMeta: CardMeta = {
          reviewMode: cardMetaRaw.reviewMode || DEFAULT_REVIEW_MODE,
          lineByLineReview: cardMetaRaw.lineByLineReview as 'Y' | 'N' | undefined,
          lineByLineProgress: cardMetaRaw.lineByLineProgress as string | undefined,
          nextDueDate: cardMetaRaw.nextDueDate,
        };

        if (isCardMetaChanged(prevCardMetaRef.current, resolvedMeta)) {
          setCardMeta(resolvedMeta);
          prevCardMetaRef.current = resolvedMeta;
        }
      } catch (error) {
        console.error('[Memo] Error polling live card meta:', error);
      }
    };

    fetchLiveMeta();
    const intervalId = setInterval(fetchLiveMeta, CARD_DATA_POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentCardRefUid, dataPageTitle]);

  return {
    currentCardData,
    cardMeta,
    reviewMode,
    latestSession,
    applyOptimisticCardMeta,
  };
}
