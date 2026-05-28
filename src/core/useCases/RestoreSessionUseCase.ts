import type {AuthSession} from '@models/auth';
import type {IAuthRepository} from '../domain/repositories/IAuthRepository';
import type {ICatalogRepository} from '../domain/repositories/ICatalogRepository';
import type {CatalogBootstrap} from '@services/catalogService';
import {warmMenuExperience} from '@utils/menuPreload';

export interface RestoreSessionInput {
  credentials: {user: string; password: string} | null;
  session: AuthSession | null;
  wireRow: Record<string, unknown> | null;
}

export interface RestoreSessionOutput {
  catalog: CatalogBootstrap | null;
}

/**
 * Re-applies persisted HTTP/runtime context and reloads catalog + image cache.
 */
export class RestoreSessionUseCase {
  constructor(
    private authRepository: IAuthRepository,
    private catalogRepository: ICatalogRepository,
  ) {}

  execute(input: RestoreSessionInput): Promise<RestoreSessionOutput> {
    const {credentials, session, wireRow} = input;
    if (!credentials || !session) {
      return Promise.resolve({catalog: null});
    }

    return Promise.resolve()
      .then(() => {
        this.authRepository.applyRestoredHttpContext(credentials, wireRow);
        return this.catalogRepository
          .fetchBootstrap()
          .then(catalog =>
            warmMenuExperience(catalog, wireRow).then(() => ({catalog})),
          )
          .catch(() => ({catalog: null}));
      });
  }
}
