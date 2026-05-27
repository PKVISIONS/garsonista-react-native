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
