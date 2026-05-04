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
  setPhase: (p: VivaPhase) => void;
  setError: (e: string | null) => void;
  setDeepLink: (u: string | null) => void;
  reset: () => void;
};

export const usePaymentStore = create<PaymentState>(set => ({
  phase: 'idle',
  lastError: null,
  lastDeepLink: null,
  setPhase: p => set({phase: p}),
  setError: e => set({lastError: e}),
  setDeepLink: u => set({lastDeepLink: u}),
  reset: () =>
    set({phase: 'idle', lastError: null, lastDeepLink: null}),
}));
