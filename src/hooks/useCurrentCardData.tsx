/**
 * useCurrentCardData Hook
 *
 * Resolves the active card's session data with real-time Data Page synchronization.
 *
 * Architecture:
 *   1. Card queue: Determined at session start, modified locally (Forgot reinsertion)
 *   2. Card session data: Real-time polling from Data Page every 1000ms
 *   3. Card meta (cardType, LBL): Read from meta block via polling
 *
 * Key simplification from previous version:
 *   - Removed reviewModeOverride mechanism entirely
 *   - reviewMode is now derived from cardMeta.cardType (card-level property)
 *   - Mode switching writes directly to Data Page via updateCardType
 *   - Optimistic update: cardMeta is updated immediately on mode switch
 *   - Polling reconciles any drift between optimistic state and Data Page
 *
 * Polling handles:
 *   - External data changes (user deleting card history on Data Page)
 *   - Reconciliation after optimistic updates
 *   - LBL flag changes
 */
import * as React from 'react';
import { CardType, CardMeta, NewSession, ReviewModes, Session, cardTypeToReviewMode } from '~/models/session';
import { generateNewSession, getPluginPageData } from '~/queries';

const CARD_DATA_POLL_INTERVAL = 1000;

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
    prev.intervalMultiplierType !== next.intervalMultiplierType ||
    prev.progressiveRepetitions !== next.progressiveRepetitions ||
    prev.lineByLineReview !== next.lineByLineReview ||
    prev.lineByLineProgress !== next.lineByLineProgress
  );
};

const isCardMetaChanged = (prev: CardMeta | undefined, next: CardMeta | undefined): boolean => {
  if (prev === next) return false;
  if (!prev || !next) return true;
  return (
    prev.cardType !== next.cardType ||
    prev.lineByLineReview !== next.lineByLineReview ||
    prev.lineByLineProgress !== next.lineByLineProgress
  );
};

const extractCardMetaFromPluginData = (
  pluginData: Record<string, any>,
  cardUid: string
): CardMeta => {
  const cardData = pluginData[cardUid];
  if (!cardData) return {};

  if (Array.isArray(cardData)) {
    const latestSession = cardData[cardData.length - 1] as Session & { cardType?: CardType };
    return {
      cardType: latestSession.cardType as CardType | undefined,
      lineByLineReview: latestSession.lineByLineReview as 'Y' | 'N' | undefined,
      lineByLineProgress: latestSession.lineByLineProgress as string | undefined,
      nextDueDate: latestSession.nextDueDate,
    };
  }

  const session = cardData as Session & { cardType?: CardType };
  return {
    cardType: session.cardType as CardType | undefined,
    lineByLineReview: session.lineByLineReview as 'Y' | 'N' | undefined,
    lineByLineProgress: session.lineByLineProgress as string | undefined,
    nextDueDate: session.nextDueDate,
  };
};

const resolveReviewModeFromMeta = (cardMeta: CardMeta | undefined, sessionReviewMode?: ReviewModes): ReviewModes => {
  if (cardMeta?.cardType) {
    return cardTypeToReviewMode(cardMeta.cardType);
  }
  if (sessionReviewMode) {
    return sessionReviewMode;
  }
  return ReviewModes.FixedInterval;
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

  const reviewMode = React.useMemo(
    () => resolveReviewModeFromMeta(cardMeta, latestSession?.reviewMode),
    [cardMeta, latestSession?.reviewMode]
  );

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

    if (cardChanged && latestSession) {
      setCurrentCardData(latestSession);
      prevCardDataRef.current = latestSession;
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
            reviewMode: resolveReviewModeFromMeta(resolvedMeta),
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

export { resolveReviewModeFromMeta, extractCardMetaFromPluginData };
