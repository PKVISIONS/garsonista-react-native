import type {CustomerInfo} from './customer';

export interface SelectedOption {
  groupId: number;
  valueId: number;
  label: string;
  priceDelta: number;
}

export interface CartItem {
  lineId: string;
  productId: number;
  productName: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  lineTotal: number;
}

export interface Cart {
  id: string;
  tableId: number;
  type: 'dine-in' | 'takeaway';
  items: CartItem[];
  comment: string;
  customer: CustomerInfo | null;
}
