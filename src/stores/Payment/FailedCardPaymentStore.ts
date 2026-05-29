import {create} from 'zustand';
import type {Cart} from '@models/cart';
import {useCartStore} from '../Cart/CartStore';

type FailedCardState = {
  cartSnapshot: Cart | null;
  orderNumber: number | null;
  idtaxdocument: string | null;
  saveAttempt: (
    cart: Cart,
    orderNumber: number,
    idtaxdocument?: string | null,
  ) => void;
  setIdtaxdocument: (id: string | null) => void;
  restoreCart: () => Cart | null;
  clear: () => void;
};

export const useFailedCardPaymentStore = create<FailedCardState>((set, get) => ({
  cartSnapshot: null,
  orderNumber: null,
  idtaxdocument: null,
  saveAttempt: (cart, orderNumber, idtaxdocument = null) => {
    set({
      cartSnapshot: cart,
      orderNumber,
      idtaxdocument: idtaxdocument ?? get().idtaxdocument,
    });
    if (!useCartStore.getState().cart) {
      useCartStore.setState({cart});
    }
  },
  setIdtaxdocument: id => set({idtaxdocument: id}),
  restoreCart: () => {
    const snap = get().cartSnapshot;
    if (snap) {
      useCartStore.setState({cart: snap});
    }
    return snap;
  },
  clear: () =>
    set({
      cartSnapshot: null,
      orderNumber: null,
      idtaxdocument: null,
    }),
}));
