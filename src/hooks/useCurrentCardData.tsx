/**
 * useCurrentCardData Hook
 *
 * Provides card data for the currently displayed card in the practice overlay.
 *
 * Data source:
 *   sessions prop — Complete session history from the initial data fetch.
 *   algorithm, interaction, and other meta fields are already merged into each
 *   Session record during the initial data load (see data.ts → mapPluginPageData),
 *   so no separate polling or meta query is needed.
 *
 * Key outputs:
 * - currentCardData: Latest session data for the current card (Session type)
 * - cardMeta: Card-level metadata (algorithm, interaction, lineByLine*) derived from latestSession
 * - algorithm / interaction: Resolved from cardMeta as the SINGLE SOURCE OF TRUTH
 * - applyOptimisticCardMeta: Instant UI update when user switches review config
 */
import * as React from 'react';
import {
  CardMeta,
  Session,
  DEFAULT_REVIEW_CONFIG,
  SchedulingAlgorithm,
  InteractionStyle,
} from '~/models/session';

export default function useCurrentCardData({
  currentCardRefUid,
  sessions,
}: {
  currentCardRefUid: string | undefined;
  sessions: Session[];
}) {
  const latestSession = sessions[sessions.length - 1] as Session | undefined;
  const [currentCardData, setCurrentCardData] = React.useState<Session | undefined>(latestSession);
  const [cardMeta, setCardMeta] = React.useState<CardMeta | undefined>(undefined);

  const algorithm = React.useMemo<SchedulingAlgorithm>(() => {
    if (cardMeta?.algorithm) return cardMeta.algorithm;
    if (latestSession?.algorithm) return latestSession.algorithm;
    return DEFAULT_REVIEW_CONFIG.algorithm;
  }, [cardMeta, latestSession]);

  const interaction = React.useMemo<InteractionStyle>(() => {
    if (cardMeta?.interaction) return cardMeta.interaction;
    if (latestSession?.interaction) return latestSession.interaction;
    return DEFAULT_REVIEW_CONFIG.interaction;
  }, [cardMeta, latestSession]);

  const prevCardUidRef = React.useRef<string | undefined>();

  const applyOptimisticCardMeta = React.useCallback((newMeta: CardMeta) => {
    const resolvedAlgorithm = newMeta.algorithm ?? DEFAULT_REVIEW_CONFIG.algorithm;
    const resolvedInteraction = newMeta.interaction ?? DEFAULT_REVIEW_CONFIG.interaction;

    setCardMeta({
      ...newMeta,
      algorithm: resolvedAlgorithm,
      interaction: resolvedInteraction,
    });
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

        const derivedAlgorithm = latestSession.algorithm ?? DEFAULT_REVIEW_CONFIG.algorithm;
        const derivedInteraction = latestSession.interaction ?? DEFAULT_REVIEW_CONFIG.interaction;

        const initialMeta: CardMeta = {
          algorithm: derivedAlgorithm,
          interaction: derivedInteraction,
          lbl_progress: latestSession.lbl_progress as string | undefined,
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
    algorithm,
    interaction,
    latestSession,
    applyOptimisticCardMeta,
  };
}
