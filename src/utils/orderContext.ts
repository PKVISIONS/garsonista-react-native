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
    userLogin: String(wireRow?.user_login ?? session.email ?? ''),
    password: String(wireRow?.password_login ?? ''),
    slogtok: String(wireRow?.slogtok ?? ''),
    tableId,
    semiLocal: Number(wireRow?.semi_local ?? 0),
    localIp: String(wireRow?.local_ip ?? ''),
    idstore_pos: Number(wireRow?.idstore_pos ?? 0),
    aade_branchcode: Number(wireRow?.aade_branchcode ?? 0),
    ismellon: Number(wireRow?.ismellon ?? 0),
    isvivacloud: Number(wireRow?.isvivacloud ?? 0),
    tid_nsp: String(wireRow?.tid_nsp ?? ''),
    always_receipt_final: Number(wireRow?.always_receipt_final ?? 0),
    novus_user: Number(wireRow?.novus_user ?? 0),
    auto_receipt: Number(wireRow?.auto_receipt ?? 1),
    headaa: Number(wireRow?.headaa ?? 0),
  };
}
