import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {AuthSession} from '@models/auth';
import type {FeatureFlags} from '@models/featureFlags';
import {STORAGE_KEYS} from '@constants/config';
import {LoginUseCase} from '../../core/useCases/LoginUseCase';
import {LogoutUseCase} from '../../core/useCases/LogoutUseCase';
import {RestoreSessionUseCase} from '../../core/useCases/RestoreSessionUseCase';
import {authRepository} from '../../repositories/AuthRepository';
import {catalogRepository} from '../../repositories/CatalogRepository';
import {clearImageAspectCache} from '../../utils/imageAspectCache';
import {mmkvStorage} from '../../storage/mmkv';
import {useCatalogStore} from '../Catalog/CatalogStore';

const loginUseCase = new LoginUseCase(authRepository, catalogRepository);
const restoreSessionUseCase = new RestoreSessionUseCase(
  authRepository,
  catalogRepository,
);
const logoutUseCase = new LogoutUseCase(authRepository);

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
      login: (email, password) =>
        loginUseCase
          .execute({email, password})
          .then(result => {
            if (result.catalog) {
              useCatalogStore.getState().setBootstrap(result.catalog);
            }
            set({
              session: result.session,
              credentials: {user: email.trim(), password},
              wireRow: result.wireRow,
              featureFlags: result.featureFlags,
            });
          }),
      logout: () => {
        void logoutUseCase
          .execute()
          .then(() => {
            useCatalogStore.getState().clear();
            clearImageAspectCache();
            mmkvStorage.removeItem(STORAGE_KEYS.authPersist);
            set({
              session: null,
              credentials: null,
              wireRow: null,
              featureFlags: {},
            });
          })
          .catch(console.error);
      },
      restore: () => {
        const {credentials, session, wireRow} = get();
        return restoreSessionUseCase
          .execute({credentials, session, wireRow})
          .then(out => {
            if (out.catalog) {
              useCatalogStore.getState().setBootstrap(out.catalog);
            }
          })
          .catch(console.error)
          .finally(() => {
            set({booting: false});
          });
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
