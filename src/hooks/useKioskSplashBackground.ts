import {useCallback, useEffect} from 'react';
import type {ImageSource} from 'expo-image';
import {prefetchSplashOnce, splashImageSource} from '@utils/splashImage';
import {kioskSplashImageUri} from '@utils/productImage';

/**
 * Kiosk splash via expo-image: prefetch once for cache, display from memory/disk after.
 */
export function useKioskSplashBackground(
  wireRow: Record<string, unknown> | null | undefined,
  logTag: string,
): {
  source: ImageSource | null;
  onLoad: () => void;
  onError: () => void;
} {
  const splashUri = kioskSplashImageUri(wireRow);
  const source = splashUri ? splashImageSource(splashUri) : null;

  useEffect(() => {
    if (!splashUri) {
      return;
    }
    void prefetchSplashOnce(splashUri);
  }, [splashUri]);

  const onLoad = useCallback(() => {
    if (__DEV__) {
      console.log(`[SplashImage][${logTag}] onLoad success`);
    }
  }, [logTag]);

  const onError = useCallback(() => {
    if (__DEV__) {
      console.log(`[SplashImage][${logTag}] onError`);
    }
  }, [logTag]);

  useEffect(() => {
    if (__DEV__) {
      console.log(
        `[SplashImage][${logTag}] splashUri=${String(splashUri ?? '').slice(0, 120)}`,
      );
    }
  }, [splashUri, logTag]);

  return {source, onLoad, onError};
}
