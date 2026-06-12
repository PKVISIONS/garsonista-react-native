type LogValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | LogValue[]
  | {[key: string]: LogValue};

function stringify(value: LogValue): string {
  if (value == null) {
    return String(value);
  }
  if (typeof value !== 'object') {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return '[unserializable]';
  }
}

export function vivaTimestamp(): string {
  return new Date().toISOString();
}

export function vivaLog(message: string, data?: LogValue): void {
  const suffix = data === undefined ? '' : ` ${stringify(data)}`;
  console.log(`[VivaFlow][${vivaTimestamp()}] ${message}${suffix}`);
}

export function vivaPreview(value: string | null | undefined, length = 500): string {
  const text = String(value ?? '');
  if (text.length <= length) {
    return text;
  }
  return `${text.slice(0, length)}...`;
}
