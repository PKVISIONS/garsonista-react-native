export interface FiscalDocument {
  id: number;
  type: string;
  receiptNumber: string;
  issuedAt: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  aadeTransactionId: string;
  invoiceUrl: string;
  escpos?: string | null;
  fiscalData?: string | null;
  signatureData?: string | null;
}
