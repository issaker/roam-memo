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
import { NewSession, ReviewModes, Session } from '~/models/session';
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
    prev.progressiveRepetitions !== next.progressiveRepetitions
  );
};

/**
 * Resolve card data for a specific reviewMode by searching session history.
 *
 * Mode isolation: Each review mode (SM2, Fixed Interval subtypes) maintains
 * independent data. When switching modes, we find the latest session matching
 * the target mode. If a mode-specific field (e.g., progressiveRepetitions)
 * is undefined in that session, we backfill from earlier sessions of the same mode.
 *
 * If no matching session exists, generates a fresh session for that mode.
 */
export const getResolvedCardData = ({
  sessions,
  reviewMode,
}: {
  sessions: Session[];
  reviewMode: ReviewModes;
}) => {
  const matchingSessions = sessions.filter((s) => s.reviewMode === reviewMode);
  if (matchingSessions.length === 0) {
    return generateNewSession({ reviewMode });
  }

  const latest = matchingSessions[matchingSessions.length - 1];

  if (reviewMode === ReviewModes.FixedInterval) {
    let progressiveRepetitions = latest.progressiveRepetitions;
    let intervalMultiplier = latest.intervalMultiplier;
    let intervalMultiplierType = latest.intervalMultiplierType;

    for (let i = matchingSessions.length - 2; i >= 0; i--) {
      const prev = matchingSessions[i];
      if (progressiveRepetitions === undefined && prev.progressiveRepetitions !== undefined) {
        progressiveRepetitions = prev.progressiveRepetitions;
      }
      if (intervalMultiplier === undefined && prev.intervalMultiplier !== undefined) {
        intervalMultiplier = prev.intervalMultiplier;
      }
      if (intervalMultiplierType === undefined && prev.intervalMultiplierType !== undefined) {
        intervalMultiplierType = prev.intervalMultiplierType;
      }
      if (
        progressiveRepetitions !== undefined &&
        intervalMultiplier !== undefined &&
        intervalMultiplierType !== undefined
      ) {
        break;
      }
    }

    return {
      ...latest,
      progressiveRepetitions,
      intervalMultiplier,
      intervalMultiplierType,
    };
  }

  if (reviewMode === ReviewModes.DefaultSpacedInterval) {
    let interval = latest.interval;
    let repetitions = latest.repetitions;
    let eFactor = latest.eFactor;

    for (let i = matchingSessions.length - 2; i >= 0; i--) {
      const prev = matchingSessions[i];
      if (interval === undefined && prev.interval !== undefined) interval = prev.interval;
      if (repetitions === undefined && prev.repetitions !== undefined) repetitions = prev.repetitions;
      if (eFactor === undefined && prev.eFactor !== undefined) eFactor = prev.eFactor;
      if (interval !== undefined && repetitions !== undefined && eFactor !== undefined) break;
    }

    return {
      ...latest,
      interval,
      repetitions,
      eFactor,
    };
  }

  return latest;
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

  // Effect 2: When dataPageTitle is not available, clear reviewModeOverride on card change.
  // With Data Page access, the polling effect (Effect 3) handles override clearing
  // automatically by detecting persisted changes. Without Data Page, we must clear
  // it explicitly to prevent stale overrides from persisting across card navigation.
  React.useEffect(() => {
    if (!currentCardRefUid) {
      setReviewModeOverride(undefined);
      setReviewMode(undefined);
      return;
    }

    if (!dataPageTitle) {
      setReviewModeOverride(undefined);
      setReviewMode(latestSession?.reviewMode);
    }
  }, [currentCardRefUid, latestSession, dataPageTitle]);

  // Effect 3: Poll Data Page for real-time card session data.
  // Every 200ms, reads ALL session history for the current card from Data Page,
  // then resolves data matching the current reviewMode via getResolvedCardData.
  // This ensures mode isolation: switching from Days back to Progressive correctly
  // finds the latest Progressive record with valid progressiveRepetitions,
  // rather than using the Days record's undefined value.
  React.useEffect(() => {
    if (!currentCardRefUid || !dataPageTitle) {
      return;
    }

    let cancelled = false;

    const fetchLiveData = async () => {
      try {
        const allPluginData = await getPluginPageData({ dataPageTitle, limitToLatest: false });
        if (cancelled) return;

        const liveSessions = allPluginData[currentCardRefUid] as Session[] | undefined;

        // When user has manually overridden reviewMode in the UI,
        // don't override currentCardData from live data.
        // Only check if the override has been persisted to Data Page
        // (i.e., user graded the card with the overridden mode),
        // in which case we clear the override.
        if (reviewModeOverrideRef.current) {
          if (liveSessions && liveSessions.length > 0) {
            const latestLiveSession = liveSessions[liveSessions.length - 1];
            if (
              latestLiveSession &&
              'reviewMode' in latestLiveSession &&
              latestLiveSession.reviewMode === reviewModeOverrideRef.current
            ) {
              setReviewModeOverride(undefined);
            }
          }
          return;
        }

        // No user override active — resolve data for the current reviewMode.

        // Case 1: Card data deleted or no sessions exist.
        // This happens when user deletes card history on Data Page.
        // Generate a fresh session to reflect the reset state.
        if (!liveSessions || liveSessions.length === 0) {
          const currentReviewMode = reviewModeRef.current || ReviewModes.DefaultSpacedInterval;
          const newSession = generateNewSession({ reviewMode: currentReviewMode });
          if (isSessionDataChanged(prevCardDataRef.current, newSession)) {
            setCurrentCardData(newSession);
            setReviewMode(newSession.reviewMode);
            prevCardDataRef.current = newSession;
          }
          return;
        }

        // Case 2: Session history exists.
        // Resolve data for the current reviewMode with backfill for undefined fields.
        const currentReviewMode = reviewModeRef.current || liveSessions[liveSessions.length - 1]?.reviewMode || ReviewModes.DefaultSpacedInterval;
        const resolvedData = getResolvedCardData({
          sessions: liveSessions,
          reviewMode: currentReviewMode,
        });
        if (isSessionDataChanged(prevCardDataRef.current, resolvedData)) {
          setCurrentCardData(resolvedData);
          setReviewMode(resolvedData.reviewMode);
          prevCardDataRef.current = resolvedData;
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
  };
}
