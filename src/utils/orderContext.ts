import type {BuildWireContext} from '@services/adapters/orderAdapter';
import type {AuthSession} from '@models/auth';

export function buildWireContext(
  session: AuthSession,
  wireRow: Record<string, unknown> | null,
  tableId: number,
): BuildWireContext {
  return {
    userId: session.userId,
    userToken: session.token,
    slogtok: String(wireRow?.slogtok ?? ''),
    tableId,
    semiLocal: Number(wireRow?.semi_local ?? 0),
    localIp: String(wireRow?.local_ip ?? ''),
  };
}
