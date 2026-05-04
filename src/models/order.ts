import type {CustomerInfo} from './customer';
import type {FiscalDocument} from './fiscal';
import type {PaymentSummary} from './payment';

export type OrderStatus =
  | 'pending'
  | 'sent'
  | 'prepaid'
  | 'paid'
  | 'cancelled';

export type OrderType = 'dine-in' | 'takeaway' | 'delivery';

export interface OrderLine {
  lineId: string;
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: number;
  clientId: string;
  tableId: number;
  type: OrderType;
  status: OrderStatus;
  items: OrderLine[];
  payment: PaymentSummary;
  customer: CustomerInfo | null;
  fiscalDoc: FiscalDocument | null;
  createdAt: string;
  updatedAt: string;
}
