import {create} from 'zustand';

export type VivaPhase =
  | 'idle'
  | 'initiating'
  | 'awaiting_app'
  | 'processing'
  | 'success'
  | 'failed'
  | 'cancelled';

type PaymentState = {
  phase: VivaPhase;
  lastError: string | null;
  lastDeepLink: string | null;
  lastVivaRequest: string | null;
  lastVivaResponse: string | null;
  pendingOrderNumber: number | null;
  pendingReceiptOrderNumber: string | null;
  setPhase: (p: VivaPhase) => void;
  setError: (e: string | null) => void;
  setDeepLink: (u: string | null) => void;
  setVivaRequest: (request: string | null) => void;
  setVivaResponse: (response: string | null) => void;
  setPendingOrderNumber: (n: number | null) => void;
  setPendingReceiptOrderNumber: (n: string | null) => void;
  reset: () => void;
};

export const usePaymentStore = create<PaymentState>(set => ({
  phase: 'idle',
  lastError: null,
  lastDeepLink: null,
  lastVivaRequest: null,
  lastVivaResponse: null,
  pendingOrderNumber: null,
  pendingReceiptOrderNumber: null,
  setPhase: p => set({phase: p}),
  setError: e => set({lastError: e}),
  setDeepLink: u => set({lastDeepLink: u}),
  setVivaRequest: request => set({lastVivaRequest: request}),
  setVivaResponse: response => set({lastVivaResponse: response}),
  setPendingOrderNumber: n => set({pendingOrderNumber: n}),
  setPendingReceiptOrderNumber: n => set({pendingReceiptOrderNumber: n}),
  reset: () =>
    set({
      phase: 'idle',
      lastError: null,
      lastDeepLink: null,
      lastVivaRequest: null,
      lastVivaResponse: null,
      pendingOrderNumber: null,
      pendingReceiptOrderNumber: null,
    }),
}));
