/**
 * useOnVisibilityStateChange Hook
 *
 * Triggers a callback when the browser tab becomes visible again.
 * Used to refresh practice data when the user returns to Roam.
 */
import * as React from 'react';

const useOnVisibilityStateChange = (callback: () => void) => {
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        callback();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callback]);
};

export default useOnVisibilityStateChange;
