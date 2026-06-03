export type VivaFiscalSigningDetails = {
  invoiceUid?: string | null;
  invoiceMark?: string | null;
  authenticationCode?: string | null;
  fiskaltrustQr?: string | null;
  qrCodeUrl?: string | null;
  vivaQr?: string | null;
};

function decodeBase64Url(input: string): string | null {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = `${normalized}${'='.repeat((4 - (normalized.length % 4 || 4)) % 4)}`;

  try {
    const atobFn = globalThis.atob;
    if (typeof atobFn === 'function') {
      const binary = atobFn(padded);
      const bytes = Uint8Array.from(binary, ch => ch.charCodeAt(0));
      if (typeof TextDecoder !== 'undefined') {
        return new TextDecoder().decode(bytes);
      }
      return binary;
    }
  } catch {
    /* ignore */
  }

  return null;
}

function pickString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseVivaFiscalSigningDetails(
  source: string | null | undefined,
): VivaFiscalSigningDetails | null {
  if (!source || !source.trim()) {
    return null;
  }

  const candidates = [source.trim()];
  const decoded = decodeBase64Url(source.trim());
  if (decoded && decoded.trim()) {
    candidates.unshift(decoded.trim());
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>;
      const rawSignatures = parsed.ftSignatures;
      if (Array.isArray(rawSignatures)) {
        const out: VivaFiscalSigningDetails = {};
        for (const entry of rawSignatures) {
          if (!entry || typeof entry !== 'object') {
            continue;
          }
          const sig = entry as Record<string, unknown>;
          const caption = pickString(sig.caption);
          const data = pickString(sig.data);
          if (!caption || !data) {
            continue;
          }
          if (caption === 'invoiceUid') out.invoiceUid = data;
          if (caption === 'invoiceMark') out.invoiceMark = data;
          if (caption === 'authenticationCode') out.authenticationCode = data;
          if (
            caption === '[www.fiskaltrust.gr]' ||
            caption === 'fiskaltrustQr' ||
            caption === 'qrCodeUrl' ||
            caption === 'qrcodeUrl' ||
            caption === 'qr_url'
          ) {
            out.fiskaltrustQr = data;
          }
          if (caption === 'vivaqrcode' || caption === 'vivaqrcode2' || caption === 'www.viva.com') {
            out.vivaQr = data;
          }
          if (caption === 'qrCodeUrl' || caption === 'qrcodeUrl' || caption === 'qr_url') {
            out.qrCodeUrl = data;
          }
        }
        return out;
      }

      const invoiceUid = pickString(parsed.invoiceUid);
      const invoiceMark = pickString(parsed.invoiceMark);
      const authenticationCode = pickString(parsed.authenticationCode);
      const fiskaltrustQr = pickString(
        parsed.fiskaltrustQr ??
          parsed.qrCodeUrl ??
          parsed.qrcodeUrl ??
          parsed.qr_url ??
          parsed.vivaqrcode,
      );
      const qrCodeUrl = pickString(parsed.qrCodeUrl ?? parsed.qrcodeUrl ?? parsed.qr_url);
      const vivaQr = pickString(parsed.vivaQr ?? parsed.vivaqrcode2);
      if (invoiceUid || invoiceMark || authenticationCode || fiskaltrustQr || qrCodeUrl || vivaQr) {
        return {
          invoiceUid,
          invoiceMark,
          authenticationCode,
          fiskaltrustQr,
          qrCodeUrl,
          vivaQr,
        };
      }
    } catch {
      /* try next interpretation */
    }
  }

  return null;
}
