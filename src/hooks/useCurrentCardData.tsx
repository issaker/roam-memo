import * as React from 'react';
import { ReviewModes, Session } from '~/models/session';
import { generateNewSession, getPluginPageData } from '~/queries';

export const getResolvedCardData = ({
  sessions,
  reviewMode,
}: {
  sessions: Session[];
  reviewMode: ReviewModes;
}) => {
  let lastSessionWithMatchingReviewMode: Session | undefined;

  for (let i = sessions.length - 1; i >= 0; i--) {
    const data = sessions[i];
    if (data.reviewMode === reviewMode) {
      lastSessionWithMatchingReviewMode = data;
      break;
    }
  }

  if (lastSessionWithMatchingReviewMode) {
    return lastSessionWithMatchingReviewMode;
  } else {
    const newCard = generateNewSession({ reviewMode });
    return newCard;
  }
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

  // Effect 1: Respond to reviewModeOverride changes (manual switch or live-data override)
  // Resolves the correct session data matching the override, or falls back to latestSession
  React.useEffect(() => {
    if (!currentCardRefUid) {
      setCurrentCardData(undefined);
      return;
    }

    if (reviewModeOverride && reviewModeOverride !== latestSession?.reviewMode) {
      const resolvedCardData = getResolvedCardData({
        sessions,
        reviewMode: reviewModeOverride,
      });
      setCurrentCardData(resolvedCardData);
      setReviewMode(resolvedCardData.reviewMode);

      return;
    }

    setCurrentCardData(latestSession);
    setReviewMode(latestSession?.reviewMode);
  }, [reviewMode, sessions, currentCardRefUid, latestSession, reviewModeOverride]);

  // Effect 2: On card navigation, fetch live reviewMode from Data Page
  // Defers state update until async query completes to avoid flicker
  // (no intermediate reset of reviewModeOverride before the new value is ready)
  React.useEffect(() => {
    if (!currentCardRefUid) {
      setReviewModeOverride(undefined);
      setReviewMode(undefined);
      return;
    }

    if (!dataPageTitle) {
      setReviewModeOverride(undefined);
      setReviewMode(latestSession?.reviewMode);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // getPluginPageData({ limitToLatest: true }) returns Records type:
        // { [uid: string]: Session } — each value is a single Session object, NOT an array
        const latestPluginData = await getPluginPageData({ dataPageTitle, limitToLatest: true });
        if (cancelled) return;

        const liveSession = latestPluginData[currentCardRefUid];
        if (liveSession?.reviewMode && liveSession.reviewMode !== latestSession?.reviewMode) {
          // Live reviewMode differs from session-cached value → apply override
          setReviewModeOverride(liveSession.reviewMode);
        } else {
          // No difference → clear override, confirm current reviewMode
          setReviewModeOverride(undefined);
          setReviewMode(latestSession?.reviewMode);
        }
      } catch (error) {
        console.error('[Memo] Error getting latest plugin data:', error);
        setReviewModeOverride(undefined);
        setReviewMode(latestSession?.reviewMode);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentCardRefUid, latestSession, dataPageTitle]);

  return {
    currentCardData,
    reviewMode,
    setReviewModeOverride,
  };
}
