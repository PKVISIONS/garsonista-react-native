import {useQuery} from '@tanstack/react-query';
import {fetchSubscription} from '@services/subscriptionService';

export function useSubscriptionQuery(enabled: boolean) {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: fetchSubscription,
    enabled,
    staleTime: 3_600_000,
    refetchInterval: 3_600_000,
  });
}
