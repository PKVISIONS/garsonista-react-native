import type {PaymentReceiptDetails} from '../../interfaces/PaymentReceiptDetails';

export interface IReceiptRepository {
  createPaymentReceiptText: (details: PaymentReceiptDetails) => Promise<string>;
  printThermalReceipt: (receiptText: string) => Promise<void>;
}
