/**
 * useCurrentCardData Hook
 *
 * Provides card data for the currently displayed card in the practice overlay.
 *
 * Data source:
 *   sessions prop — Complete session history from the initial data fetch.
 *   reviewMode and other meta fields are already merged into each Session
 *   record during the initial data load (see data.ts → mapPluginPageData),
 *   so no separate polling or meta query is needed.
 *
 * Key outputs:
 * - currentCardData: Latest session data for the current card (Session type)
 * - cardMeta: Card-level metadata (reviewMode, lineByLine*) derived from latestSession
 * - reviewMode: Resolved from cardMeta as the SINGLE SOURCE OF TRUTH
 * - applyOptimisticCardMeta: Instant UI update when user switches review mode
 */
import * as React from 'react';
import { CardMeta, Session, DEFAULT_REVIEW_MODE } from '~/models/session';

export default function useCurrentCardData({
  currentCardRefUid,
  sessions,
}: {
  currentCardRefUid: string | undefined;
  sessions: Session[];
  dataPageTitle?: string;
}) {
  const latestSession = sessions[sessions.length - 1] as Session | undefined;
  const [currentCardData, setCurrentCardData] = React.useState<Session | undefined>(latestSession);
  const [cardMeta, setCardMeta] = React.useState<CardMeta | undefined>(undefined);

  const reviewMode = React.useMemo(() => {
    if (cardMeta?.reviewMode) return cardMeta.reviewMode;
    return latestSession?.reviewMode || DEFAULT_REVIEW_MODE;
  }, [cardMeta, latestSession]);

  const prevCardUidRef = React.useRef<string | undefined>();

  const applyOptimisticCardMeta = React.useCallback((newMeta: CardMeta) => {
    setCardMeta(newMeta);
  }, []);

  React.useEffect(() => {
    if (!currentCardRefUid) {
      setCurrentCardData(undefined);
      setCardMeta(undefined);
      prevCardUidRef.current = undefined;
      return;
    }

    const cardChanged = prevCardUidRef.current !== currentCardRefUid;
    prevCardUidRef.current = currentCardRefUid;

    if (cardChanged) {
      if (latestSession) {
        setCurrentCardData(latestSession);

        const initialMeta: CardMeta = {
          reviewMode: latestSession.reviewMode || DEFAULT_REVIEW_MODE,
          lineByLineProgress: latestSession.lineByLineProgress as string | undefined,
          nextDueDate: latestSession.nextDueDate,
        };
        setCardMeta(initialMeta);
      } else {
        setCardMeta(undefined);
      }
    }
  }, [currentCardRefUid, latestSession]);

  return {
    currentCardData,
    cardMeta,
    reviewMode,
    latestSession,
    applyOptimisticCardMeta,
  };
}
