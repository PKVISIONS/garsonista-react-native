import {Image as ExpoImage} from 'expo-image';
import {Platform} from 'react-native';
import {API_BASE_URL, STORAGE_KEYS} from '@constants/config';
import {mmkv} from '../storage/mmkv';
import {splashImageHeaders} from './splashImage';

/** Login payload field used for static uploads host (legacy web client). */
export function imagesBaseUrlFromWireRow(
  wireRow: Record<string, unknown> | null | undefined,
): string | null {
  if (!wireRow) {
    return null;
  }
  const v = wireRow.images_url;
  if (typeof v === 'string' && v.trim()) {
    return v.trim();
  }
  return null;
}

/**
 * Legacy catalog (`www/js/catalog-navigation.js`): full URL = `images_url + image1`
 * where `images_url` comes from login row (`user_logedin[0].images_url`).
 */
function joinImagesBase(baseRaw: string, path: string): string {
  const b = baseRaw.replace(/\/+$/, '');
  const p = path.replace(/^\/+/, '');
  return `${b}/${p}`;
}

/**
 * Turn backend image fields (often relative paths like `uploads/...`) into a full URL.
 * Prefer `imagesBaseUrl` from login (`wireRow.images_url`) — same as legacy web kiosk.
 */
export function resolveProductImageUri(
  raw: string | null | undefined,
  imagesBaseUrl?: string | null,
): string | null {
  if (raw == null) {
    return null;
  }
  const u = String(raw).trim();
  if (!u || u === '0') {
    return null;
  }
  if (/^https?:\/\//i.test(u)) {
    return u;
  }
  if (u.startsWith('//')) {
    return `https:${u}`;
  }

  const fromLogin = imagesBaseUrl?.trim();
  if (fromLogin) {
    return joinImagesBase(fromLogin, u);
  }

  const base = API_BASE_URL.replace(/\/$/, '');
  if (u.startsWith('/')) {
    return `${base}${u}`;
  }
  if (/^[a-z0-9][a-z0-9+.-]*:\/\//i.test(u)) {
    return u;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}\//i.test(u)) {
    return `https://${u}`;
  }
  return `${base}/${u.replace(/^\/+/, '')}`;
}

/**
 * Remote HTTP(S) image source with optional Android cache hint.
 * Local `file://` / `content://` URIs must not use cache flags — Fresco fails on remount.
 */
export function remoteUriSource(
  uri: string,
  options?: {reload?: boolean},
): {
  uri: string;
  cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached';
} {
  if (/^(file|content):\/\//i.test(uri)) {
    return {uri};
  }
  if (options?.reload) {
    return Platform.OS === 'android'
      ? {uri, cache: 'reload'}
      : {uri};
  }
  const cached = remoteSourceCache.get(uri);
  if (cached) {
    return cached;
  }
  const source =
    Platform.OS === 'android'
      ? {uri, cache: 'default' as const}
      : {uri};
  remoteSourceCache.set(uri, source);
  return source;
}

const remoteSourceCache = new Map<
  string,
  {uri: string; cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached'}
>();
const prefetchedUris = new Set<string>();
const inflightProductPrefetch = new Map<string, Promise<boolean>>();
let lastGoodSplashUri: string | null = null;

/** expo-image source for catalog photos — headers must match prefetch for cache hits. */
export function productImageExpoSource(uri: string): {
  uri: string;
  headers: Record<string, string>;
} {
  return {uri, headers: splashImageHeaders(uri)};
}

/** One prefetch per URI into expo-image memory/disk cache (matches `ProductGridImage`). */
export function prefetchProductImageOnce(
  uri: string | null | undefined,
): Promise<boolean> {
  const url = typeof uri === 'string' ? uri.trim() : '';
  if (!url) {
    return Promise.resolve(false);
  }
  if (prefetchedUris.has(url)) {
    return Promise.resolve(true);
  }
  const pending = inflightProductPrefetch.get(url);
  if (pending) {
    return pending;
  }
  const job = ExpoImage.prefetch(url, {
    cachePolicy: 'memory-disk',
    headers: splashImageHeaders(url),
  })
    .then(ok => {
      if (ok) {
        prefetchedUris.add(url);
      }
      return ok;
    })
    .finally(() => {
      inflightProductPrefetch.delete(url);
    });
  inflightProductPrefetch.set(url, job);
  return job;
}

/** Best-effort one-time prefetch for remote images to reduce category-switch flashes. */
export function warmRemoteImageCache(uris: Array<string | null | undefined>): void {
  for (const raw of uris) {
    void prefetchProductImageOnce(raw).catch(() => {
      /* best-effort */
    });
  }
}

export function clearRememberedSplashUri(): void {
  lastGoodSplashUri = null;
  mmkv.remove(STORAGE_KEYS.lastGoodSplashUri);
}

export function rememberGoodSplashUri(uri: string | null | undefined): void {
  const v = typeof uri === 'string' ? uri.trim() : '';
  if (v) {
    lastGoodSplashUri = v;
    mmkv.set(STORAGE_KEYS.lastGoodSplashUri, v);
    if (__DEV__) {
      console.log(`[SplashImage] rememberGoodSplashUri uri=${v.slice(0, 180)}`);
    }
  }
}

export function getRememberedSplashUri(): string | null {
  if (lastGoodSplashUri) {
    if (__DEV__) {
      console.log('[SplashImage] getRememberedSplashUri source=memory');
    }
    return lastGoodSplashUri;
  }
  const persisted = mmkv.getString(STORAGE_KEYS.lastGoodSplashUri) ?? null;
  if (persisted && persisted.trim()) {
    lastGoodSplashUri = persisted.trim();
    if (__DEV__) {
      console.log('[SplashImage] getRememberedSplashUri source=mmkv');
    }
    return lastGoodSplashUri;
  }
  if (__DEV__) {
    console.log('[SplashImage] getRememberedSplashUri source=empty');
  }
  return null;
}

export function deriveApiHostUploadsFallback(
  uri: string | null | undefined,
): string | null {
  const v = typeof uri === 'string' ? uri.trim() : '';
  if (!v) {
    return null;
  }
  const idx = v.indexOf('/uploads/');
  if (idx < 0) {
    return null;
  }
  const path = v.slice(idx);
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const alt = `${base}${path}`;
  return alt === v ? null : alt;
}

export function productImageSource(
  raw: string | null | undefined,
  imagesBaseUrl?: string | null,
): ReturnType<typeof remoteUriSource> | null {
  const uri = resolveProductImageUri(raw, imagesBaseUrl);
  return uri ? remoteUriSource(uri) : null;
}

function wireKioskPath(
  wireRow: Record<string, unknown>,
  key: string,
): string | null {
  const v = wireRow[key];
  if (typeof v !== 'string') {
    return null;
  }
  const s = v.trim();
  if (!s || s === '0') {
    return null;
  }
  return s;
}

/**
 * Cordova `www/js/head.js` `check_if_logein`: background is `images_url + kiosk_image1`
 * in portrait (`kiosk_orientation == 0 || == "0"`), else `images_url + kiosk_image2`.
 * Falls back to the other slot if the primary path is empty.
 */
export function kioskSplashImageUri(
  wireRow: Record<string, unknown> | null | undefined,
): string | null {
  if (!wireRow) {
    return null;
  }
  const base = imagesBaseUrlFromWireRow(wireRow);
  const o = wireRow.kiosk_orientation;
  const portrait = o === 0 || o === '0';
  const primary = portrait
    ? wireKioskPath(wireRow, 'kiosk_image1')
    : wireKioskPath(wireRow, 'kiosk_image2');
  const fallback = portrait
    ? wireKioskPath(wireRow, 'kiosk_image2')
    : wireKioskPath(wireRow, 'kiosk_image1');
  const path = primary ?? fallback;
  if (!path) {
    return null;
  }
  const resolved = resolveProductImageUri(path, base);
  if (__DEV__) {
    console.log(
      `[SplashImage] kioskSplashImageUri orientation=${String(
        o,
      )} path=${String(path).slice(0, 120)} resolved=${String(resolved ?? '').slice(0, 180)}`,
    );
  }
  return resolved;
}

/** Cordova: `kiosk_image3` → `.logo_new_image` src (`images_url + kiosk_image3`). */
export function kioskLogoImageUri(
  wireRow: Record<string, unknown> | null | undefined,
): string | null {
  if (!wireRow) {
    return null;
  }
  const path = wireKioskPath(wireRow, 'kiosk_image3');
  if (!path) {
    return null;
  }
  return resolveProductImageUri(path, imagesBaseUrlFromWireRow(wireRow));
}
