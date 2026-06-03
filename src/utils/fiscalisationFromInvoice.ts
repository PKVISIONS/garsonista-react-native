export function resolveFiscalisationDataFromInvoiceUrl(
  invoiceUrl: string | null | undefined,
): string | undefined {
  if (!invoiceUrl) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(invoiceUrl) as Record<string, unknown>;
    const candidates = [
      parsed.fiscal_data,
      parsed.fiscalisationData,
      parsed.fiscalisationSigningDetails,
      parsed.signature_data,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) {
        return candidate.trim();
      }
    }
  } catch {
    /* not JSON */
  }

  const queryIndex = invoiceUrl.indexOf('?');
  if (queryIndex >= 0) {
    const params = new URLSearchParams(invoiceUrl.slice(queryIndex));
    const fromQuery =
      params.get('fiscalisationData') ??
      params.get('fiscalisationSigningDetails') ??
      params.get('fiscal_data');
    if (fromQuery && fromQuery.trim()) {
      return fromQuery.trim();
    }
  }

  return undefined;
}

export function resolveFiscalisationQrCodeUrlFromInvoiceUrl(
  invoiceUrl: string | null | undefined,
): string | undefined {
  if (!invoiceUrl) {
    return undefined;
  }

  const directMarkupMatch = invoiceUrl.match(/<qrcode[^>]*>([^<]+)<\/qrcode>/i);
  if (directMarkupMatch?.[1]?.trim()) {
    const qr = directMarkupMatch[1].trim();
    if (__DEV__) {
      console.log('[VivaFlow] QR source invoiceUrl.markup');
      console.log(`[VivaFlow] QR resolved invoiceUrl.markup=${qr}`);
    }
    return qr;
  }

  const extract = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const trimmed = value.trim();
    return trimmed ? trimmed : undefined;
  };

  const extractFromFtSignatures = (value: unknown): string | undefined => {
    if (typeof value !== 'string') {
      return undefined;
    }
    const candidates = [value.trim()];
    const decoded = extract(value);
    if (decoded) {
      candidates.unshift(decoded);
    }
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate) as Record<string, unknown>;
        const rawSignatures = parsed.ftSignatures;
        if (Array.isArray(rawSignatures)) {
          for (const entry of rawSignatures) {
            if (!entry || typeof entry !== 'object') {
              continue;
            }
            const sig = entry as Record<string, unknown>;
            const caption = extract(sig.caption);
            const data = extract(sig.data);
            if (!caption || !data) {
              continue;
            }
            if (caption === '[www.fiskaltrust.gr]' || caption === 'www.viva.com') {
              return data;
            }
          }
        }
      } catch {
        /* try next interpretation */
      }
    }
    return undefined;
  };

  try {
    const parsed = JSON.parse(invoiceUrl) as Record<string, unknown>;
    const directCandidates = [
      parsed.qrCodeUrl,
      parsed.qrcodeUrl,
      parsed.qr_url,
      parsed.vivaqrcode,
      parsed.vivaqrcode2,
    ];
    for (const candidate of directCandidates) {
      const url = extract(candidate);
      if (url) {
        if (__DEV__) {
          console.log(
            `[VivaFlow] QR source invoiceUrl.direct ${String(candidate).slice(0, 160)}`,
          );
          console.log(`[VivaFlow] QR resolved invoiceUrl.direct=${url}`);
        }
        return url;
      }
    }

    const signatureData = parsed.signature_data;
    if (signatureData && typeof signatureData === 'object') {
      const sig = signatureData as Record<string, unknown>;
      const nestedCandidates = [
        sig.qrCodeUrl,
        sig.qrcodeUrl,
        sig.qr_url,
        sig.vivaqrcode,
        sig.vivaqrcode2,
      ];
      for (const candidate of nestedCandidates) {
        const url = extract(candidate);
        if (url) {
          if (__DEV__) {
            console.log(
              `[VivaFlow] QR source invoiceUrl.signature_data ${String(candidate).slice(0, 160)}`,
            );
            console.log(`[VivaFlow] QR resolved invoiceUrl.signature_data=${url}`);
          }
          return url;
        }
      }
      const fromFtSignatures = extractFromFtSignatures(sig.signature_data);
      if (fromFtSignatures) {
        if (__DEV__) {
          console.log('[VivaFlow] QR source invoiceUrl.signature_data.ftSignatures');
          console.log(`[VivaFlow] QR resolved invoiceUrl.signature_data.ftSignatures=${fromFtSignatures}`);
        }
        return fromFtSignatures;
      }
      const fromNestedFtSignatures = extractFromFtSignatures(sig.fiscalisationSigningDetails);
      if (fromNestedFtSignatures) {
        if (__DEV__) {
          console.log('[VivaFlow] QR source invoiceUrl.fiscalisationSigningDetails.ftSignatures');
          console.log(
            `[VivaFlow] QR resolved invoiceUrl.fiscalisationSigningDetails.ftSignatures=${fromNestedFtSignatures}`,
          );
        }
        return fromNestedFtSignatures;
      }
      const fromDirectFtSignatures = extractFromFtSignatures(JSON.stringify(sig));
      if (fromDirectFtSignatures) {
        if (__DEV__) {
          console.log('[VivaFlow] QR source invoiceUrl.signature_data.json.ftSignatures');
          console.log(
            `[VivaFlow] QR resolved invoiceUrl.signature_data.json.ftSignatures=${fromDirectFtSignatures}`,
          );
        }
        return fromDirectFtSignatures;
      }
    } else if (typeof signatureData === 'string') {
      const fromSignatureData = extractFromFtSignatures(signatureData);
      if (fromSignatureData) {
        return fromSignatureData;
      }
    }
  } catch {
    /* not JSON */
  }

  const queryIndex = invoiceUrl.indexOf('?');
  if (queryIndex >= 0) {
    const params = new URLSearchParams(invoiceUrl.slice(queryIndex));
    const fromQuery =
      params.get('qrCodeUrl') ??
      params.get('qrcodeUrl') ??
      params.get('qr_url') ??
      params.get('vivaqrcode') ??
      params.get('vivaqrcode2');
    if (fromQuery && fromQuery.trim()) {
      if (__DEV__) {
        console.log('[VivaFlow] QR source invoiceUrl.query');
        console.log(`[VivaFlow] QR resolved invoiceUrl.query=${fromQuery.trim()}`);
      }
      return fromQuery.trim();
    }

    const fromFtSignatures = params.get('fiscalisationSigningDetails') ?? params.get('signature_data');
    if (fromFtSignatures) {
      const qr = extractFromFtSignatures(fromFtSignatures);
      if (qr) {
        if (__DEV__) {
          console.log('[VivaFlow] QR source invoiceUrl.query.ftSignatures');
          console.log(`[VivaFlow] QR resolved invoiceUrl.query.ftSignatures=${qr}`);
        }
        return qr;
      }
    }
  }

  return undefined;
}

export function resolveFiscalisationQrCodeUrlFromPayload(
  payload: string | null | undefined,
): string | undefined {
  if (!payload || !payload.trim()) {
    return undefined;
  }

  const input = payload.trim();
  const directMarkupMatch = input.match(/<qrcode[^>]*>([^<]+)<\/qrcode>/i);
  if (directMarkupMatch?.[1]?.trim()) {
    const qr = directMarkupMatch[1].trim();
    if (__DEV__) {
      console.log('[VivaFlow] QR source payload.markup');
      console.log(`[VivaFlow] QR resolved payload.markup=${qr}`);
    }
    return qr;
  }

  try {
    const parsed = JSON.parse(input) as Record<string, unknown>;
    const candidates = [
      parsed.qrCodeUrl,
      parsed.qrcodeUrl,
      parsed.qr_url,
      parsed.vivaqrcode,
      parsed.vivaqrcode2,
      parsed.fiscal_data,
      parsed.fiscalisationData,
      parsed.fiscalisationSigningDetails,
      parsed.escpos,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== 'string' || !candidate.trim()) {
        continue;
      }
      const nested = resolveFiscalisationQrCodeUrlFromPayload(candidate);
      if (nested) {
        if (__DEV__) {
          console.log(
            `[VivaFlow] QR source payload.json.${String(candidate).slice(0, 60)}`,
          );
          console.log(`[VivaFlow] QR resolved payload.json=${nested}`);
        }
        return nested;
      }
    }

    const signatureData = parsed.signature_data;
    if (signatureData && typeof signatureData === 'object') {
      const sig = signatureData as Record<string, unknown>;
      const nestedCandidates = [
        sig.qrCodeUrl,
        sig.qrcodeUrl,
        sig.qr_url,
        sig.vivaqrcode,
        sig.vivaqrcode2,
        sig.fiscal_data,
        sig.fiscalisationData,
        sig.fiscalisationSigningDetails,
        sig.escpos,
      ];
      for (const candidate of nestedCandidates) {
        if (typeof candidate !== 'string' || !candidate.trim()) {
          continue;
        }
        const nested = resolveFiscalisationQrCodeUrlFromPayload(candidate);
        if (nested) {
          if (__DEV__) {
            console.log(
              `[VivaFlow] QR source payload.signature_data.${String(candidate).slice(0, 60)}`,
            );
            console.log(`[VivaFlow] QR resolved payload.signature_data=${nested}`);
          }
          return nested;
        }
      }
    }
  } catch {
    /* not JSON */
  }

  return undefined;
}

export function resolveBestVivaQrCodeUrl(details: {
  fiskaltrustQr?: string | null;
  qrCodeUrl?: string | null;
  vivaQr?: string | null;
} | null | undefined): string | undefined {
  const candidates = [
    details?.fiskaltrustQr,
    details?.qrCodeUrl,
    details?.vivaQr,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      if (__DEV__) {
        console.log(`[VivaFlow] QR source details=${candidate.slice(0, 160)}`);
        console.log(`[VivaFlow] QR resolved details=${candidate.trim()}`);
      }
      return candidate.trim();
    }
  }
  return undefined;
}
