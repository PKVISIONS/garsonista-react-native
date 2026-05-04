import type {AuthSession} from '@models/auth';
import type {FeatureFlags} from '@models/featureFlags';

export type AuthLoginBundle = {
  session: AuthSession;
  wireRow: Record<string, unknown>;
  featureFlags: FeatureFlags;
};

export interface IAuthRepository {
  login: (email: string, password: string) => Promise<AuthLoginBundle>;
  clearHttpSession: () => void;
  applyRestoredHttpContext: (
    credentials: {user: string; password: string},
    wireRow: Record<string, unknown> | null,
  ) => void;
}
