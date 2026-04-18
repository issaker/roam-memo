/**
 * useCachedData Hook
 *
 * Manages per-tag cache data stored on the Roam data page.
 * Cache stores UI state like renderMode (Normal/AnswerFirst) per deck.
 */
import React from 'react';
import * as queries from '~/queries';

const useCachedData = ({
  dataPageTitle,
  selectedTag,
}: {
  dataPageTitle: string;
  selectedTag?: string;
}) => {
  const [data, setData] = React.useState({});
  const [refetchTrigger, setRefetchTrigger] = React.useState(0);

  const deleteCacheDataKey = async (toDeleteKeyId: string) => {
    await queries.deleteCacheDataKey({ dataPageTitle, selectedTag, toDeleteKeyId });
  };

  React.useEffect(() => {
    const getData = async () => {
      const result = await queries.getPluginPageCachedData({ dataPageTitle });
      setData(result);
    };

    getData();
  }, [refetchTrigger, dataPageTitle, selectedTag]);

  const fetchCacheData = React.useCallback(
    () => setRefetchTrigger((prev) => prev + 1),
    [setRefetchTrigger]
  );
  return {
    saveCacheData: async (data: { [key: string]: any }, overrides?: { [key: string]: any }) => {
      await queries.saveCacheData({ dataPageTitle, data, selectedTag, ...overrides });
      setRefetchTrigger((prev) => prev + 1);
    },
    deleteCacheDataKey,
    fetchCacheData,
    data: selectedTag ? data[selectedTag] || {} : data,
  };
};

export default useCachedData;
