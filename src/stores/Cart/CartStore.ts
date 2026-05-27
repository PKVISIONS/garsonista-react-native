import {create} from 'zustand';
import {KIOSK_ORDER_TABLE_ID} from '@constants/service';
import type {Cart, CartItem} from '@models/cart';
import {createId} from '@utils/id';

type CartState = {
  cart: Cart | null;
  resetForServiceType: (type: 'dine-in' | 'takeaway', tableId?: number) => void;
  addItem: (item: Omit<CartItem, 'lineId'> & {lineId?: string}) => void;
  updateLineQuantity: (lineId: string, quantity: number) => void;
  removeLine: (lineId: string) => void;
  setComment: (comment: string) => void;
  clear: () => void;
};

export const useCartStore = create<CartState>((set, get) => ({
  cart: null,
  resetForServiceType: (type, tableId = KIOSK_ORDER_TABLE_ID) =>
    set({
      cart: {
        id: createId(),
        tableId,
        type,
        items: [],
        comment: '',
        customer: null,
      },
    }),
  addItem: item => {
    const c = get().cart;
    if (!c) {
      return;
    }
    const line: CartItem = {
      ...item,
      lineId: item.lineId ?? createId(),
    };
    set({cart: {...c, items: [...c.items, line]}});
  },
  updateLineQuantity: (lineId, quantity) => {
    const c = get().cart;
    if (!c) {
      return;
    }
    if (quantity <= 0) {
      set({
        cart: {...c, items: c.items.filter(i => i.lineId !== lineId)},
      });
      return;
    }
    set({
      cart: {
        ...c,
        items: c.items.map(i =>
          i.lineId === lineId
            ? {...i, quantity, lineTotal: i.unitPrice * quantity}
            : i,
        ),
      },
    });
  },
  removeLine: lineId => {
    const c = get().cart;
    if (!c) {
      return;
    }
    set({cart: {...c, items: c.items.filter(i => i.lineId !== lineId)}});
  },
  setComment: comment => {
    const c = get().cart;
    if (!c) {
      return;
    }
    set({cart: {...c, comment}});
  },
  clear: () => set({cart: null}),
}));
