import type {PaymentSummary, VivaTransaction} from '@models/payment';

export function mapPaymentSummary(p: Partial<PaymentSummary>): PaymentSummary {
  return {
    method: p.method ?? 'cash',
    cashAmount: p.cashAmount ?? 0,
    cardAmount: p.cardAmount ?? 0,
    bankAmount: p.bankAmount ?? 0,
    discountAmount: p.discountAmount ?? 0,
    totalAmount: p.totalAmount ?? 0,
    isPrepaid: p.isPrepaid ?? false,
  };
}

export function mapVivaTransaction(p: Partial<VivaTransaction>): VivaTransaction {
  return {
    transactionId: p.transactionId ?? '',
    clientTransactionId: p.clientTransactionId ?? '',
    status: p.status ?? 'pending',
    amount: p.amount ?? 0,
    cardType: p.cardType ?? '',
    maskedCard: p.maskedCard ?? '',
    aadeTransactionId: p.aadeTransactionId ?? '',
    receiptData: p.receiptData ?? null,
  };
}
