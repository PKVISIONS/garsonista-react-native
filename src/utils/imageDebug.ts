/**
 * Dev helpers for large remote images (e.g. kiosk splash from `images_url` + `kiosk_image1`).
 */

function perfNow(): number {
  const p = globalThis.performance;
  return typeof p?.now === 'function' ? p.now() : Date.now();
}

/** Try HEAD for Content-Length (no body). Falls back to one GET to measure real download size. */
export async function logRemoteImageDiagnostics(uri: string, label: string): Promise<void> {
  if (!__DEV__ || !uri) {
    return;
  }
  try {
    const t0 = perfNow();
    const head = await fetch(uri, {method: 'HEAD'});
    const headMs = perfNow() - t0;
    const len = head.headers.get('content-length');
    const mb = len != null ? (Number(len) / 1024 / 1024).toFixed(2) : '?';
    console.log(
      `[Garsonista HTTP][IMG] HEAD ${label} ${headMs.toFixed(0)}ms ~${mb}MB status=${head.status} ${uri.slice(0, 96)}`,
    );
    if (len == null || Number(len) === 0) {
      const t1 = perfNow();
      const res = await fetch(uri);
      const blob = await res.blob();
      const getMs = perfNow() - t1;
      console.log(
        `[Garsonista HTTP][IMG] GET ${label} ${getMs.toFixed(0)}ms ${(blob.size / 1024 / 1024).toFixed(2)}MB (extra download for size — consider fixing server Content-Length)`,
      );
    }
  } catch (e) {
    console.warn(`[Garsonista HTTP][IMG] ${label}`, e);
  }
}
