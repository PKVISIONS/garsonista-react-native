import {create} from 'zustand';
import type {CatalogBootstrap} from '@services/catalogService';

type CatalogState = {
  data: CatalogBootstrap | null;
  setBootstrap: (d: CatalogBootstrap) => void;
  clear: () => void;
};

export const useCatalogStore = create<CatalogState>(set => ({
  data: null,
  setBootstrap: d => set({data: d}),
  clear: () => set({data: null}),
}));
