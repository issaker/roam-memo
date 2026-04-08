import * as React from 'react';
import { ReviewModes, Session } from '~/models/session';
import { generateNewSession, getLatestReviewModeForCard } from '~/queries';

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

  React.useEffect(() => {
    setReviewModeOverride(undefined);
    setReviewMode(latestSession?.reviewMode);

    if (!currentCardRefUid || !dataPageTitle) return;

    const liveReviewMode = getLatestReviewModeForCard({
      dataPageTitle,
      refUid: currentCardRefUid,
    });

    if (liveReviewMode && liveReviewMode !== latestSession?.reviewMode) {
      setReviewModeOverride(liveReviewMode);
    }
  }, [currentCardRefUid, latestSession, dataPageTitle]);

  return {
    currentCardData,
    reviewMode,
    setReviewModeOverride,
  };
}
