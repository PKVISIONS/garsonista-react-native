import {Platform} from 'react-native';
import {API_BASE_URL} from '@constants/config';

let _agentH1State: string | null = null;
/** Login payload field used for static uploads host (legacy web client). */
export function imagesBaseUrlFromWireRow(
  wireRow: Record<string, unknown> | null | undefined,
): string | null {
  if (!wireRow) {
    // #region agent log
    if (_agentH1State !== 'no-wire') {
      _agentH1State = 'no-wire';
      fetch('http://127.0.0.1:7806/ingest/a1837756-80df-4bbf-b9af-46808b0f37e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'616b00'},body:JSON.stringify({sessionId:'616b00',hypothesisId:'H1',location:'productImage.ts:imagesBaseUrlFromWireRow',message:'wireRow missing',data:{hasWireRow:false},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return null;
  }
  const v = wireRow.images_url;
  if (typeof v === 'string' && v.trim()) {
    const out = v.trim();
    // #region agent log
    if (_agentH1State !== 'ok') {
      _agentH1State = 'ok';
      fetch('http://127.0.0.1:7806/ingest/a1837756-80df-4bbf-b9af-46808b0f37e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'616b00'},body:JSON.stringify({sessionId:'616b00',hypothesisId:'H1',location:'productImage.ts:imagesBaseUrlFromWireRow',message:'base from login',data:{hasWireRow:true,images_url_len:out.length,preview:out.slice(0,80)},timestamp:Date.now()})}).catch(()=>{});
    }
    // #endregion
    return out;
  }
  // #region agent log
  if (_agentH1State !== 'bad-url') {
    _agentH1State = 'bad-url';
    fetch('http://127.0.0.1:7806/ingest/a1837756-80df-4bbf-b9af-46808b0f37e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'616b00'},body:JSON.stringify({sessionId:'616b00',hypothesisId:'H1',location:'productImage.ts:imagesBaseUrlFromWireRow',message:'images_url empty/invalid',data:{images_url_type:typeof v,keys:Object.keys(wireRow).slice(0,20)},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
 * Remote image `source` object with Android cache hint so decoded bitmaps reuse
 * the disk cache instead of flashing on every remount.
 */
export function remoteUriSource(uri: string): {
  uri: string;
  cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached';
} {
  if (Platform.OS === 'android') {
    return {uri, cache: 'default'};
  }
  return {uri};
}

/** For React Native `<Image source={...} />`. */
let _agentPicLogN = 0;
export function productImageSource(
  raw: string | null | undefined,
  imagesBaseUrl?: string | null,
): ReturnType<typeof remoteUriSource> | null {
  const uri = resolveProductImageUri(raw, imagesBaseUrl);
  // #region agent log
  if (_agentPicLogN < 6) {
    _agentPicLogN++;
    const sch =
      uri && /^https?:/i.test(uri) ? (uri.startsWith('https') ? 'https' : 'http') : uri ? 'other' : null;
    fetch('http://127.0.0.1:7806/ingest/a1837756-80df-4bbf-b9af-46808b0f37e2',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'616b00'},body:JSON.stringify({sessionId:'616b00',hypothesisId:'H2',location:'productImage.ts:productImageSource',message:'resolve product image',data:{n:_agentPicLogN,rawPreview:raw?String(raw).slice(0,100):null,hasBase:!!imagesBaseUrl,uri:uri?uri.slice(0,160):null,scheme:sch},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion
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
  return resolveProductImageUri(path, base);
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
