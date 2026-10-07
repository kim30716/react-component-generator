import type { GeneratedComponent, Provider } from '../types';

export const STORAGE_KEYS = {
  provider: 'rcg:provider',
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

// API 키는 생성된 코드와 같은 origin에 저장하면 미리보기 코드가 읽어 갈 수 있어 더 이상 저장하지 않는다.
// 이전 버전이 남긴 키 항목은 앱 시작 시 지운다.
const LEGACY_KEYS = ['rcg:apiKeys'];

export function clearLegacyKeys(storage: Pick<Storage, 'removeItem'>): void {
  try {
    LEGACY_KEYS.forEach((key) => storage.removeItem(key));
  } catch {
    // 저장소 접근이 막혀 있으면 지울 것도 없다.
  }
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
