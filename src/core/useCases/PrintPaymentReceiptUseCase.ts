import type {IReceiptRepository} from '../domain/repositories/IReceiptRepository';
import type {PaymentReceiptDetails} from '../interfaces/PaymentReceiptDetails';

export interface PrintPaymentReceiptInput {
  details: PaymentReceiptDetails;
}

export interface PrintPaymentReceiptOutput {}

export class PrintPaymentReceiptUseCase {
  constructor(private receiptRepository: IReceiptRepository) {}

  execute(
    input: PrintPaymentReceiptInput,
  ): Promise<PrintPaymentReceiptOutput> {
    if (!input.details || input.details.orderNumber <= 0) {
      return Promise.reject(new Error('A valid receipt payload is required'));
    }

    return this.receiptRepository
      .createPaymentReceiptText(input.details)
      .then(receiptText =>
        this.receiptRepository.printThermalReceipt(receiptText),
      )
      .then(() => ({}));
  }
}
