export interface PaymentReceiptLine {
  productName: string;
  quantity: number;
  lineTotal: number;
}

export interface PaymentReceiptDetails {
  orderNumber: number;
  paymentMethod: 'cash' | 'card';
  currencySymbol: string;
  createdAt: Date;
  lines: PaymentReceiptLine[];
}
