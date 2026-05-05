import type {IReceiptRepository} from '../core/domain/repositories/IReceiptRepository';
import type {PaymentReceiptDetails} from '../core/interfaces/PaymentReceiptDetails';
import {printOrderSlip} from '../services/printing/printerService';

function formatDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export class ReceiptRepository implements IReceiptRepository {
  createPaymentReceiptText = async (
    details: PaymentReceiptDetails,
  ): Promise<string> => {
    const total = details.lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const methodLabel = details.paymentMethod === 'card' ? 'CARD' : 'CASH';
    const bodyLines = details.lines.map(
      line =>
        `${line.productName} x${line.quantity}  ${line.lineTotal
          .toFixed(2)
          .replace('.', ',')}${details.currencySymbol}`,
    );

    return [
      'GARSONISTA KIOSK',
      '-----------------------------',
      `ORDER: #${details.orderNumber}`,
      `PAYMENT: ${methodLabel}`,
      `DATE: ${formatDateTime(details.createdAt)}`,
      '-----------------------------',
      ...bodyLines,
      '-----------------------------',
      `TOTAL: ${total.toFixed(2).replace('.', ',')}${details.currencySymbol}`,
      '',
      'THANK YOU',
    ].join('\n');
  };

  printThermalReceipt = async (receiptText: string): Promise<void> => {
    const lines = receiptText.split('\n');
    await printOrderSlip(lines);
  };
}

export const receiptRepository = new ReceiptRepository();
