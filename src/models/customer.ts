export interface CustomerInfo {
  id: number | null;
  name: string;
  phone: string;
  address: string | null;
}

export interface TaxCustomer {
  id: number;
  taxType: string;
  vatId: string;
  taxOffice: string;
  businessName: string;
  businessType: string;
  address: string;
  city: string;
  postalCode: string;
  countryCode: string;
  email: string;
  vatExemptCode: string | null;
}
