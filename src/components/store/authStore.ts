import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {AuthSession} from '@models/auth';
import type {FeatureFlags} from '@models/featureFlags';
import {STORAGE_KEYS} from '@constants/config';
import {setApiCredentials} from '@services/http/client';
import {setRuntimeConfigFromWireRow} from '@constants/runtimeConfig';
import * as authApi from '@services/authService';
import {prefetchAfterAuth} from '@services/prefetchService';
import {clearImageAspectCache} from '@utils/imageAspectCache';
import {useCatalogStore} from './catalogStore';
import {mmkvStorage} from '../../storage/mmkv';

type AuthState = {
  booting: boolean;
  session: AuthSession | null;
  credentials: {user: string; password: string} | null;
  wireRow: Record<string, unknown> | null;
  featureFlags: FeatureFlags;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  restore: () => Promise<void>;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      booting: true,
      session: null,
      credentials: null,
      wireRow: null,
      featureFlags: {},
      login: async (email, password) => {
        const {session, wireRow, featureFlags} = await authApi.login(email, password);
        await prefetchAfterAuth(wireRow);
        set({
          session,
          credentials: {user: email, password},
          wireRow,
          featureFlags,
        });
      },
      logout: () => {
        authApi.logout();
        useCatalogStore.getState().clear();
        clearImageAspectCache();
        mmkvStorage.removeItem(STORAGE_KEYS.authPersist);
        set({
          session: null,
          credentials: null,
          wireRow: null,
          featureFlags: {},
        });
      },
      restore: async () => {
        const {credentials, session, wireRow} = get();
        if (credentials && session) {
          setApiCredentials(credentials);
          if (wireRow) {
            setRuntimeConfigFromWireRow(wireRow);
          }
          await prefetchAfterAuth(wireRow);
        }
        set({booting: false});
      },
    }),
    {
      name: STORAGE_KEYS.authPersist,
      storage: createJSONStorage(() => mmkvStorage),
      partialize: state => ({
        session: state.session,
        credentials: state.credentials,
        wireRow: state.wireRow,
        featureFlags: state.featureFlags,
      }),
    },
  ),
);
