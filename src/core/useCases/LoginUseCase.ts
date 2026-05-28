import type {
  AuthLoginBundle,
  IAuthRepository,
} from '../domain/repositories/IAuthRepository';
import type {ICatalogRepository} from '../domain/repositories/ICatalogRepository';
import type {CatalogBootstrap} from '@services/catalogService';
import {warmMenuExperience} from '@utils/menuPreload';

export interface LoginInput {
  email: string;
  password: string;
}

export type LoginOutput = AuthLoginBundle & {
  catalog: CatalogBootstrap | null;
};

/**
 * Authenticates the kiosk user, then loads the catalog and warms menu images.
 * Catalog failures do not fail login.
 */
export class LoginUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private catalogRepository: ICatalogRepository,
  ) {}

  execute(input: LoginInput): Promise<LoginOutput> {
    const email = input.email?.trim();
    if (!email || !input.password) {
      return Promise.reject(new Error('Email and password are required'));
    }

    return this.authRepository
      .login(email, input.password)
      .then(loginBundle =>
        this.catalogRepository
          .fetchBootstrap()
          .then(catalog =>
            warmMenuExperience(catalog, loginBundle.wireRow).then(() => ({
              ...loginBundle,
              catalog,
            })),
          )
          .catch(() => ({...loginBundle, catalog: null})),
      );
  }
}
