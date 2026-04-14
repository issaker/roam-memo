/**
 * useCurrentCardData Hook
 *
 * Provides real-time card data for the currently displayed card in the practice overlay.
 *
 * Data sources:
 * 1. sessions prop: Complete session history from the initial data fetch (synchronous)
 * 2. Polling: Periodic Datalog queries to detect external changes (e.g., updateCardType)
 *
 * Key outputs:
 * - currentCardData: Latest session data for the current card (Session type)
 * - cardMeta: Card-level metadata (reviewMode, lineByLine*) from the meta block
 * - reviewMode: Resolved from cardMeta as the SINGLE SOURCE OF TRUTH
 * - applyOptimisticCardMeta: Instant UI update before polling confirms the change
 */
import * as React from 'react';
import { CardMeta, NewSession, ReviewModes, Session, DEFAULT_REVIEW_MODE } from '~/models/session';
import { generateNewSession, getPluginPageData } from '~/queries';

/**
 * Polling interval for live card data updates.
 * 2000ms balances responsiveness (detecting external changes like updateCardType)
 * with performance (avoiding excessive Datalog queries).
 * Optimistic updates (applyOptimisticCardMeta) provide instant UI feedback
 * without waiting for the next poll cycle.
 */
const CARD_DATA_POLL_INTERVAL = 2000;

const isSessionDataChanged = (prev: Session | undefined, next: Session | undefined): boolean => {
  if (prev === next) return false;
  if (!prev || !next) return true;
  const isSameDate = (a?: Date, b?: Date) => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.getTime() === b.getTime();
  };
  return (
    prev.interval !== next.interval ||
    prev.repetitions !== next.repetitions ||
    prev.eFactor !== next.eFactor ||
    prev.reviewMode !== next.reviewMode ||
    !isSameDate(prev.nextDueDate, next.nextDueDate) ||
    !isSameDate(prev.dateCreated, next.dateCreated) ||
    prev.intervalMultiplier !== next.intervalMultiplier ||
    prev.progressiveRepetitions !== next.progressiveRepetitions ||
    prev.lineByLineReview !== next.lineByLineReview ||
    prev.lineByLineProgress !== next.lineByLineProgress
  );
};

const isCardMetaChanged = (prev: CardMeta | undefined, next: CardMeta | undefined): boolean => {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return (
    prev.reviewMode !== next.reviewMode ||
    prev.lineByLineReview !== next.lineByLineReview ||
    prev.lineByLineProgress !== next.lineByLineProgress
  );
};

/**
 * Extract CardMeta from the plugin page data for a specific card.
 * reviewMode is read from the session data (which already has meta merged in
 * by mapPluginPageDataLatest). If reviewMode is missing, the card has not
 * been migrated yet — use DEFAULT_REVIEW_MODE.
 */
const extractCardMetaFromPluginData = (
  pluginData: Record<string, any>,
  cardUid: string
): CardMeta | undefined => {
  const cardData = pluginData[cardUid];
  if (!cardData) return undefined;

  const latestSession = Array.isArray(cardData)
    ? cardData[cardData.length - 1] as Session
    : cardData as Session;

  return {
    reviewMode: latestSession.reviewMode || DEFAULT_REVIEW_MODE,
    lineByLineReview: latestSession.lineByLineReview as 'Y' | 'N' | undefined,
    lineByLineProgress: latestSession.lineByLineProgress as string | undefined,
    nextDueDate: latestSession.nextDueDate,
  };
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
   * - If cardMeta is loaded but has no reviewMode → use DEFAULT_REVIEW_MODE
   * - If cardMeta is undefined (not yet loaded) → use DEFAULT_REVIEW_MODE (will be resolved when meta loads)
   */
  const reviewMode = React.useMemo(() => {
    if (cardMeta === undefined) return DEFAULT_REVIEW_MODE;
    if (cardMeta?.reviewMode) return cardMeta.reviewMode;
    return DEFAULT_REVIEW_MODE;
  }, [cardMeta]);

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

    const fetchLiveData = async () => {
      try {
        const latestPluginData = await getPluginPageData({ dataPageTitle, limitToLatest: true });
        if (cancelled) return;

        const liveSession = latestPluginData[currentCardRefUid] as Session | NewSession | undefined;

        if (!liveSession || !('reviewMode' in liveSession)) {
          const resolvedMeta = extractCardMetaFromPluginData(latestPluginData, currentCardRefUid);
          const newSession = generateNewSession({
            reviewMode: resolvedMeta?.reviewMode || DEFAULT_REVIEW_MODE,
          });
          if (isSessionDataChanged(prevCardDataRef.current, newSession)) {
            setCurrentCardData(newSession);
            prevCardDataRef.current = newSession;
          }
          if (isCardMetaChanged(prevCardMetaRef.current, resolvedMeta)) {
            setCardMeta(resolvedMeta);
            prevCardMetaRef.current = resolvedMeta;
          }
          return;
        }

        const liveSessionData = liveSession as Session;
        if (isSessionDataChanged(prevCardDataRef.current, liveSessionData)) {
          setCurrentCardData(liveSessionData);
          prevCardDataRef.current = liveSessionData;
        }

        const resolvedMeta = extractCardMetaFromPluginData(latestPluginData, currentCardRefUid);
        if (isCardMetaChanged(prevCardMetaRef.current, resolvedMeta)) {
          setCardMeta(resolvedMeta);
          prevCardMetaRef.current = resolvedMeta;
        }
      } catch (error) {
        console.error('[Memo] Error polling live card data:', error);
      }
    };

    fetchLiveData();
    const intervalId = setInterval(fetchLiveData, CARD_DATA_POLL_INTERVAL);

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

export { extractCardMetaFromPluginData };
