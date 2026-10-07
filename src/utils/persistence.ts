import type { GeneratedComponent, Provider } from '../types';

export const STORAGE_KEYS = {
  provider: 'rcg:provider',
  apiKeys: 'rcg:apiKeys',
  history: 'rcg:promptHistory',
  components: 'rcg:components',
} as const;

export const MAX_HISTORY = 20;

const PROVIDERS: readonly Provider[] = ['anthropic', 'google'];
const DEFAULT_PROVIDER: Provider = 'google';

// 저장소 값은 사용자가 직접 고치거나 깨질 수 있으므로, 파싱 실패는 예외 대신 undefined로 다룬다.
function safeParse(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseProvider(raw: string | null): Provider {
  const value = safeParse(raw);
  return PROVIDERS.find((p) => p === value) ?? DEFAULT_PROVIDER;
}

export function parseApiKeys(raw: string | null): Record<Provider, string> {
  const value = safeParse(raw);
  const source = isRecord(value) ? value : {};
  const pick = (provider: Provider) =>
    typeof source[provider] === 'string' ? (source[provider] as string) : '';
  return { anthropic: pick('anthropic'), google: pick('google') };
}

export function parseHistory(raw: string | null): string[] {
  const value = safeParse(raw);
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export function parseComponents(raw: string | null): GeneratedComponent[] {
  const value = safeParse(raw);
  if (!Array.isArray(value)) return [];

  return value.flatMap((item): GeneratedComponent[] => {
    if (!isRecord(item)) return [];
    const { id, prompt, code, createdAt } = item;
    if (typeof id !== 'string' || typeof prompt !== 'string' || typeof code !== 'string') return [];
    if (typeof createdAt !== 'string') return [];

    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return [];
    return [{ id, prompt, code, createdAt: date }];
  });
}

export function addToHistory(history: string[], prompt: string): string[] {
  const trimmed = prompt.trim();
  if (!trimmed) return history;
  return [trimmed, ...history.filter((item) => item !== trimmed)].slice(0, MAX_HISTORY);
}
