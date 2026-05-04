import type {IAuthRepository} from '../domain/repositories/IAuthRepository';

/**
 * Clears server client credentials and runtime routing derived from the session.
 */
export class LogoutUseCase {
  constructor(private authRepository: IAuthRepository) {}

  execute(): Promise<void> {
    return Promise.resolve().then(() => {
      this.authRepository.clearHttpSession();
    });
  }
}
