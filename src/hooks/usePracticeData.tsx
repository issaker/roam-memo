/**
 * usePracticeData Hook
 *
 * Fetches and manages practice card data from the Roam data page.
 * Uses refetchTrigger pattern to avoid stale data from object reference changes.
 * cachedData is accessed via ref to prevent unnecessary re-fetches.
 */
import * as React from 'react';
import { Today, TodayInitial } from '~/models/practice';
import { Records } from '~/models/session';
import * as queries from '~/queries';

const usePracticeCardsData = ({
  tagsList,
  selectedTag,
  dataPageTitle,
  cachedData,
  isCramming,
  dailyLimit,
  shuffleCards,
}: {
  tagsList: string[];
  selectedTag: string;
  dataPageTitle: string;
  cachedData: any;
  isCramming: boolean;
  dailyLimit: number;
  shuffleCards: boolean;
}) => {
  const [practiceData, setPracticeData] = React.useState<Records>({});
  const [refetchTrigger, setRefetchTrigger] = React.useState(false);
  const [today, setToday] = React.useState<Today>(TodayInitial);

  const refetchTriggerFn = React.useCallback(() => setRefetchTrigger((trigger) => !trigger), []);

  const cachedDataRef = React.useRef(cachedData);
  cachedDataRef.current = cachedData;

  React.useEffect(() => {
    (async () => {
      if (!selectedTag) return;

      const { practiceData, todayStats } = await queries.getPracticeData({
        tagsList,
        dataPageTitle,
        dailyLimit,
        isCramming,
        shuffleCards,
        cachedData: cachedDataRef.current,
      });

      setToday(todayStats);
      setPracticeData(practiceData);
    })();
  }, [
    selectedTag,
    dataPageTitle,
    refetchTrigger,
    isCramming,
    dailyLimit,
    tagsList,
    shuffleCards,
  ]);

  return {
    practiceData,
    fetchPracticeData: refetchTriggerFn,
    today,
  };
};

export default usePracticeCardsData;
