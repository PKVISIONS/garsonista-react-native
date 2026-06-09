import type {CustomerInfo} from './customer';

export interface SelectedOption {
  groupId: number;
  valueId: number;
  label: string;
  descrValue?: string;
  groupLabel?: string | null;
  quantity?: number;
  unitPriceDelta?: number;
  priceDelta: number;
  forGrouping?: number | string | null;
  flatPrice?: number | string | null;
}

export interface CartItem {
  lineId: string;
  productId: number;
  productName: string;
  productImageUrl?: string | null;
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
