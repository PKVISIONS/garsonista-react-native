import {useAuthStore} from '@store/authStore';
import type {FeatureFlags} from '@models/featureFlags';

export function useFeatureFlag<K extends keyof FeatureFlags>(
  key: K,
): FeatureFlags[K] | undefined {
  return useAuthStore(s => s.featureFlags[key]);
}

export function useFeatureFlagBool(key: string, defaultValue = false): boolean {
  const v = useAuthStore(s => s.featureFlags[key]);
  if (typeof v === 'boolean') {
    return v;
  }
  if (typeof v === 'number') {
    return v !== 0;
  }
  return defaultValue;
}
