/**
 * useBlockInfo Hook
 *
 * Fetches block content, children, and breadcrumb data from Roam's API.
 * Breadcrumbs are sorted by hierarchy depth to match Roam's native display order.
 */
import * as React from 'react';
import { BlockInfo, fetchBlockInfo } from '~/queries';

const useBlockInfo = ({ refUid }) => {
  const [blockInfo, setBlockInfo] = React.useState<BlockInfo>({} as BlockInfo);

  React.useEffect(() => {
    if (!refUid) return;

    const fetch = async () => {
      const blockInfo = await fetchBlockInfo(refUid);
      setBlockInfo({ ...blockInfo, refUid });
    };

    fetch();
  }, [refUid]);

  return { blockInfo };
};

export default useBlockInfo;
