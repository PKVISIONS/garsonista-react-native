/** Row from legacy `get_store_premises` — company / branch details for receipts. */
export interface StorePremise {
  id: number;
  descr: string;
  epwnimia: string | null;
  companyDescr: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  taxId: string | null;
  taxOffice: string | null;
}
