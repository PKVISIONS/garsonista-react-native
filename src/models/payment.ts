export interface PaymentSummary {
  method: 'cash' | 'card' | 'bank' | 'iris';
  cashAmount: number;
  cardAmount: number;
  bankAmount: number;
  discountAmount: number;
  totalAmount: number;
  isPrepaid: boolean;
}

export interface VivaTransaction {
  transactionId: string;
  clientTransactionId: string;
  status: 'pending' | 'success' | 'failed';
  amount: number;
  cardType: string;
  maskedCard: string;
  aadeTransactionId: string;
  receiptData: string | null;
}
