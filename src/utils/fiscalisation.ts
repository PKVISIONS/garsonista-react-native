export function resolveFiscalisationData(source: unknown): string | undefined {
  if (!source || typeof source !== 'object') {
    return undefined;
  }

  const row = source as Record<string, unknown>;
  const candidates = [
    row.fiscalisationData,
    row.fiscalisation_data,
    row.fiscalisationSigningDetails,
    row.fiscal_data,
    row.viva_fiscal_data,
    row.vivaFiscalData,
    row.viva_fiscalisation_data,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}
