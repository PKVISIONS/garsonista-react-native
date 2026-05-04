import {setRuntimeConfigFromWireRow} from '@constants/runtimeConfig';
import type {IAuthRepository} from '../core/domain/repositories/IAuthRepository';
import * as authService from '../services/authService';
import {setApiCredentials} from '../services/http/client';

export class AuthRepository implements IAuthRepository {
  login = authService.login;

  clearHttpSession = (): void => {
    authService.logout();
  };

  applyRestoredHttpContext = (
    credentials: {user: string; password: string},
    wireRow: Record<string, unknown> | null,
  ): void => {
    setApiCredentials(credentials);
    if (wireRow) {
      setRuntimeConfigFromWireRow(wireRow);
    }
  };
}

export const authRepository = new AuthRepository();
