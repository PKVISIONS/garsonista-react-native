import {useCallback, useEffect, useRef} from 'react';
import {flushClientLogs} from '@services/systemService';

type LogEntry = {alog: string; afrom: string; adata: string};

export function useClientLogger(flushIntervalMs = 30_000): {
  log: (alog: string, afrom: string, adata?: string) => void;
} {
  const buffer = useRef<LogEntry[]>([]);

  const flush = useCallback(async () => {
    if (!buffer.current.length) {
      return;
    }
    const batch = buffer.current.splice(0, buffer.current.length);
    try {
      await flushClientLogs(batch);
    } catch {
      buffer.current.unshift(...batch);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void flush();
    }, flushIntervalMs);
    return () => clearInterval(id);
  }, [flush, flushIntervalMs]);

  const log = useCallback(
    (alog: string, afrom: string, adata = '') => {
      buffer.current.push({alog, afrom, adata});
    },
    [],
  );

  return {log};
}
