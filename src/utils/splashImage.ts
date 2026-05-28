import {Image} from 'expo-image';
import {kioskSplashImageUri} from './productImage';

const prefetchedRemotes = new Set<string>();
const inflight = new Map<string, Promise<boolean>>();

export function splashImageHeaders(remoteUrl: string): Record<string, string> {
  try {
    return {
      Accept: 'image/jpeg,image/png,image/webp,image/*',
      Referer: `${new URL(remoteUrl).origin}/`,
    };
  } catch {
    return {Accept: 'image/jpeg,image/png,image/webp,image/*'};
  }
}

export function splashImageSource(remoteUrl: string): {
  uri: string;
  headers: Record<string, string>;
} {
  return {uri: remoteUrl, headers: splashImageHeaders(remoteUrl)};
}

/** One prefetch per remote URL; expo-image keeps memory + disk cache. */
export function prefetchSplashOnce(
  remoteUrl: string | null | undefined,
): Promise<boolean> {
  const url = typeof remoteUrl === 'string' ? remoteUrl.trim() : '';
  if (!url) {
    return Promise.resolve(false);
  }
  if (prefetchedRemotes.has(url)) {
    if (__DEV__) {
      console.log('[SplashImage] prefetch memory hit');
    }
    return Promise.resolve(true);
  }
  const pending = inflight.get(url);
  if (pending) {
    if (__DEV__) {
      console.log('[SplashImage] join in-flight prefetch');
    }
    return pending;
  }
  if (__DEV__) {
    console.log(`[SplashImage] prefetch once ${url.slice(0, 120)}`);
  }
  const job = Image.prefetch(url, {
    cachePolicy: 'memory-disk',
    headers: splashImageHeaders(url),
  })
    .then(ok => {
      if (ok) {
        prefetchedRemotes.add(url);
        if (__DEV__) {
          console.log('[SplashImage] prefetch ok');
        }
      } else if (__DEV__) {
        console.log('[SplashImage] prefetch failed');
      }
      return ok;
    })
    .finally(() => {
      inflight.delete(url);
    });
  inflight.set(url, job);
  return job;
}

export function prefetchKioskSplash(
  wireRow: Record<string, unknown> | null | undefined,
): Promise<boolean> {
  return prefetchSplashOnce(kioskSplashImageUri(wireRow));
}
