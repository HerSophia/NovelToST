export function nextTimestamp(): string {
  return new Date().toISOString();
}

export function nextTimestampAfter(previous: string | null | undefined): string {
  const previousMs = typeof previous === 'string' ? Date.parse(previous) : Number.NaN;
  const nowMs = Date.now();
  const nextMs = Number.isFinite(previousMs) && nowMs <= previousMs ? previousMs + 1 : nowMs;

  return new Date(nextMs).toISOString();
}

export function normalizeTimestamp(value: unknown): string {
  if (typeof value !== 'string') {
    return nextTimestamp();
  }

  return value.trim() || nextTimestamp();
}
