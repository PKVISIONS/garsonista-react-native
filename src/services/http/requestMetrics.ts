/**
 * Dev-only timing for `legacyPostText` (fetch FormData POSTs).
 * In Metro console: `global.__garsonistaHttpStats()`
 */

type Entry = {
  select: string;
  host: string;
  ms: number;
  ok: boolean;
  at: number;
};

const MAX = 300;
const entries: Entry[] = [];

function hostOnly(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.slice(0, 48);
  }
}

export function recordLegacyPost(
  url: string,
  select: string | undefined,
  ms: number,
  ok: boolean,
): void {
  const row: Entry = {
    select: select ?? '(unknown)',
    host: hostOnly(url),
    ms,
    ok,
    at: Date.now(),
  };
  entries.push(row);
  if (entries.length > MAX) {
    entries.splice(0, entries.length - MAX);
  }

  if (__DEV__) {
    const tag = ok ? 'ok' : 'FAIL';
    console.log(
      `[Garsonista HTTP] POST ${tag} ${ms.toFixed(0)}ms select=${row.select} host=${row.host}`,
    );
  }
}

type Agg = {count: number; sumMs: number; minMs: number; maxMs: number; fails: number};

function aggregate(bySelect: Map<string, Agg>, e: Entry): void {
  let a = bySelect.get(e.select);
  if (!a) {
    a = {count: 0, sumMs: 0, minMs: Infinity, maxMs: 0, fails: 0};
    bySelect.set(e.select, a);
  }
  a.count += 1;
  a.sumMs += e.ms;
  a.minMs = Math.min(a.minMs, e.ms);
  a.maxMs = Math.max(a.maxMs, e.ms);
  if (!e.ok) {
    a.fails += 1;
  }
}

/** Human-readable stats for Metro / Flipper. */
export function formatHttpRequestStats(): string {
  if (entries.length === 0) {
    return '[Garsonista HTTP] no requests recorded yet.';
  }
  const bySelect = new Map<string, Agg>();
  for (const e of entries) {
    aggregate(bySelect, e);
  }
  const lines: string[] = [
    `[Garsonista HTTP] ${entries.length} POST(s) — by select=`,
    ...[...bySelect.entries()]
      .sort((a, b) => b[1].sumMs - a[1].sumMs)
      .map(([sel, a]) => {
        const avg = a.sumMs / a.count;
        return `  ${sel}: n=${a.count} avg=${avg.toFixed(0)}ms min=${a.minMs === Infinity ? 0 : a.minMs.toFixed(0)}ms max=${a.maxMs.toFixed(0)}ms fails=${a.fails}`;
      }),
  ];
  const totalMs = entries.reduce((s, e) => s + e.ms, 0);
  lines.push(`  TOTAL wall-sum: ${totalMs.toFixed(0)}ms (parallel calls overlap — not user-perceived latency)`);
  const slow = [...entries].sort((a, b) => b.ms - a.ms).slice(0, 8);
  lines.push(`Slowest single calls:`);
  for (const e of slow) {
    lines.push(`  ${e.ms.toFixed(0)}ms ${e.select} ${e.host} ${e.ok ? '' : 'FAIL'}`);
  }
  return lines.join('\n');
}

export function installHttpStatsGlobal(): void {
  if (!__DEV__) {
    return;
  }
  const g = globalThis as unknown as {__garsonistaHttpStats?: () => void};
  g.__garsonistaHttpStats = () => {
    console.log(formatHttpRequestStats());
  };
}
