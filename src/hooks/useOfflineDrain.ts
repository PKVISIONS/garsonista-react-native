import {useEffect} from 'react';
import {drainOfflineQueue, submitCartOnline} from '@services/orderService';
import {useNetworkStatus} from './useNetworkStatus';

export function useOfflineDrain(enabled: boolean): void {
  const online = useNetworkStatus();

  useEffect(() => {
    if (!enabled || !online) {
      return;
    }
    void drainOfflineQueue(submitCartOnline);
  }, [enabled, online]);
}
