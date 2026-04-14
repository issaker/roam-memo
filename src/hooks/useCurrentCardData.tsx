/**
 * useCurrentCardData Hook
 *
 * Resolves the active card's session data with real-time Data Page synchronization.
 *
 * Architecture:
 *   1. Session queue: One-time read on session start (preserved until session closes)
 *   2. Card session data: Real-time polling from Data Page every 200ms
 *
 * This ensures that external changes (e.g., user deleting card history on Data Page)
 * are immediately reflected in the UI without requiring a session restart.
 *
 * Review mode override mechanism:
 *   - When user toggles reviewMode in the UI, reviewModeOverride takes effect
 *   - Override is resolved from the sessions array (captured at session start)
 *   - Override is automatically cleared once Data Page reflects the change
 *   - Polling skips currentCardData updates while override is active
 */
import * as React from 'react';
import { IntervalMultiplierType, NewSession, ReviewModes, Session } from '~/models/session';
import { generateNewSession, getPluginPageData } from '~/queries';

/** Polling interval for reading live card data from Data Page (ms) */
const CARD_DATA_POLL_INTERVAL = 200;

/**
 * Shallow comparison of key session fields to detect meaningful changes.
 * Avoids unnecessary re-renders when polling returns structurally identical data.
 * Covers both Spaced Interval (interval, repetitions, eFactor) and
 * Fixed Interval (intervalMultiplier, intervalMultiplierType, progressiveRepetitions) fields.
 */
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

export const getResolvedCardData = ({
  sessions,
  reviewMode,
}: {
  sessions: Session[];
  reviewMode: ReviewModes;
}) => {
  for (let i = sessions.length - 1; i >= 0; i--) {
    const data = sessions[i];
    if (data.reviewMode === reviewMode) {
      return data;
    }
  }

  return generateNewSession({ reviewMode });
};

/**
 * Resolve mode-specific data fields by looking back through session history.
 *
 * Each review mode owns independent data fields:
 *   - Progressive: progressiveRepetitions
 *   - Days/Weeks/Months/Years: intervalMultiplier
 *   - SM2: repetitions, interval, eFactor
 *
 * When the latest session is from a different sub-mode (e.g. Days instead of
 * Progressive), mode-specific fields may be undefined. This function searches
 * backward through the session history for the most recent session that has
 * a valid value for the missing field, preventing cross-mode data pollution.
 */
export const resolveModeSpecificData = (
  session: Session,
  sessions: Session[],
  targetIntervalMultiplierType?: IntervalMultiplierType
): Session => {
  if (!session) return session;

  const resolved = { ...session };

  if (session.reviewMode === ReviewModes.FixedInterval) {
    if (targetIntervalMultiplierType === IntervalMultiplierType.Progressive) {
      if (resolved.progressiveRepetitions === undefined) {
        for (let i = sessions.length - 1; i >= 0; i--) {
          const hist = sessions[i];
          if (
            hist.intervalMultiplierType === IntervalMultiplierType.Progressive &&
            hist.progressiveRepetitions !== undefined
          ) {
            resolved.progressiveRepetitions = hist.progressiveRepetitions;
            break;
          }
        }
      }
    } else if (targetIntervalMultiplierType) {
      if (resolved.intervalMultiplier === undefined) {
        for (let i = sessions.length - 1; i >= 0; i--) {
          const hist = sessions[i];
          if (
            hist.intervalMultiplierType === targetIntervalMultiplierType &&
            hist.intervalMultiplier !== undefined
          ) {
            resolved.intervalMultiplier = hist.intervalMultiplier;
            break;
          }
        }
      }
    }
  } else if (session.reviewMode === ReviewModes.DefaultSpacedInterval) {
    if (
      resolved.repetitions === undefined ||
      resolved.interval === undefined ||
      resolved.eFactor === undefined
    ) {
      for (let i = sessions.length - 1; i >= 0; i--) {
        const hist = sessions[i];
        if (hist.reviewMode === ReviewModes.DefaultSpacedInterval) {
          if (resolved.repetitions === undefined && hist.repetitions !== undefined) {
            resolved.repetitions = hist.repetitions;
          }
          if (resolved.interval === undefined && hist.interval !== undefined) {
            resolved.interval = hist.interval;
          }
          if (resolved.eFactor === undefined && hist.eFactor !== undefined) {
            resolved.eFactor = hist.eFactor;
          }
          if (
            resolved.repetitions !== undefined &&
            resolved.interval !== undefined &&
            resolved.eFactor !== undefined
          ) {
            break;
          }
        }
      }
    }
  }

  if (resolved.lineByLineReview === undefined) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].lineByLineReview !== undefined) {
        resolved.lineByLineReview = sessions[i].lineByLineReview;
        break;
      }
    }
  }

  if (resolved.lineByLineReview === 'Y' && resolved.lineByLineProgress === undefined) {
    for (let i = sessions.length - 1; i >= 0; i--) {
      if (sessions[i].lineByLineProgress !== undefined) {
        resolved.lineByLineProgress = sessions[i].lineByLineProgress;
        break;
      }
    }
  }

  return resolved;
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
  const [reviewMode, setReviewMode] = React.useState<ReviewModes | undefined>(
    latestSession?.reviewMode
  );

  const [reviewModeOverride, setReviewModeOverride] = React.useState<ReviewModes | undefined>();

  // Refs to access latest values inside polling callback without triggering effect restart.
  // This prevents the polling interval from resetting on every state change.
  const reviewModeOverrideRef = React.useRef<ReviewModes | undefined>();
  reviewModeOverrideRef.current = reviewModeOverride;

  const reviewModeRef = React.useRef<ReviewModes | undefined>();
  reviewModeRef.current = reviewMode;

  // Track previous currentCardData to avoid unnecessary re-renders
  // when polling returns identical data (shallow comparison by key fields)
  const prevCardDataRef = React.useRef<Session | undefined>();

  // Effect 1: Resolve currentCardData from sessions when reviewModeOverride is active,
  // or set initial data from sessions as fallback when card changes.
  // When no override is active, the polling effect (Effect 2) will provide live data.
  React.useEffect(() => {
    if (!currentCardRefUid) {
      setCurrentCardData(undefined);
      setReviewMode(undefined);
      setReviewModeOverride(undefined);
      return;
    }

    if (reviewModeOverride && reviewModeOverride !== latestSession?.reviewMode) {
      const resolvedCardData = getResolvedCardData({
        sessions,
        reviewMode: reviewModeOverride,
      });
      setCurrentCardData(resolvedCardData);
      setReviewMode(resolvedCardData.reviewMode);
      prevCardDataRef.current = resolvedCardData;
      return;
    }

    // Fallback: use sessions data until live data arrives from polling.
    // This provides immediate display while the async poll completes.
    setCurrentCardData(latestSession);
    setReviewMode(latestSession?.reviewMode);
    prevCardDataRef.current = latestSession;
  }, [sessions, currentCardRefUid, latestSession, reviewModeOverride]);

  // Effect 2: Reset reviewModeOverride and reviewMode on card navigation.
  // When navigating to a new card, any active reviewModeOverride from the
  // previous card must be cleared to prevent it from incorrectly applying
  // to the new card. Previously, when dataPageTitle was available, this
  // effect relied on the polling effect (Effect 3) to clear the override —
  // but the polling effect only checks the CURRENT card's data against the
  // override, so after navigation the override would never match the new
  // card's reviewMode and would persist indefinitely, causing the new card
  // to inherit the previous card's review mode.
  React.useEffect(() => {
    if (!currentCardRefUid) {
      setReviewModeOverride(undefined);
      setReviewMode(undefined);
      return;
    }

    setReviewModeOverride(undefined);
    setReviewMode(latestSession?.reviewMode);
  }, [currentCardRefUid, latestSession, dataPageTitle]);

  // Effect 3: Poll Data Page for real-time card session data.
  // Every 200ms, reads the latest session for the current card from Data Page.
  // This detects external changes (history deletion, reviewMode edits) and
  // updates the display immediately — achieving "what you see is what you get".
  React.useEffect(() => {
    if (!currentCardRefUid || !dataPageTitle) {
      return;
    }

    let cancelled = false;

    const fetchLiveData = async () => {
      try {
        const latestPluginData = await getPluginPageData({ dataPageTitle, limitToLatest: true });
        if (cancelled) return;

        const liveSession = latestPluginData[currentCardRefUid] as Session | NewSession | undefined;

        // When user has manually overridden reviewMode in the UI,
        // don't override currentCardData from live data.
        // Only check if the override has been persisted to Data Page
        // (i.e., user graded the card with the overridden mode),
        // in which case we clear the override.
        if (reviewModeOverrideRef.current) {
          if (
            liveSession &&
            'reviewMode' in liveSession &&
            liveSession.reviewMode === reviewModeOverrideRef.current
          ) {
            setReviewModeOverride(undefined);
          }
          return;
        }

        // No user override active — update currentCardData with live data.

        // Case 1: Card data deleted or invalid (no reviewMode field).
        // This happens when user deletes card history on Data Page.
        // Generate a fresh session to reflect the reset state.
        if (!liveSession || !('reviewMode' in liveSession)) {
          const currentReviewMode = reviewModeRef.current || ReviewModes.DefaultSpacedInterval;
          const newSession = generateNewSession({ reviewMode: currentReviewMode });
          if (isSessionDataChanged(prevCardDataRef.current, newSession)) {
            setCurrentCardData(newSession);
            setReviewMode(newSession.reviewMode);
            prevCardDataRef.current = newSession;
          }
          return;
        }

        // Case 2: Valid live session data exists.
        // Only update if data has meaningfully changed to avoid unnecessary re-renders.
        const liveSessionData = liveSession as Session;
        if (isSessionDataChanged(prevCardDataRef.current, liveSessionData)) {
          setCurrentCardData(liveSessionData);
          setReviewMode(liveSessionData.reviewMode);
          prevCardDataRef.current = liveSessionData;
        }
      } catch (error) {
        console.error('[Memo] Error polling live card data:', error);
      }
    };

    // Start periodic polling only (no immediate fetch).
    // Effect 1 already provides initial data from the sessions array on mount,
    // so the first 200ms delay before the first poll is imperceptible to users.
    // Skipping the immediate fetch avoids async state updates that can interfere
    // with the initial render cycle and test act() boundaries.
    const intervalId = setInterval(fetchLiveData, CARD_DATA_POLL_INTERVAL);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [currentCardRefUid, dataPageTitle]);

  return {
    currentCardData,
    reviewMode,
    setReviewModeOverride,
    latestSession,
  };
}
