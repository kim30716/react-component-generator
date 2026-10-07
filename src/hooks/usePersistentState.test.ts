import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePersistentState } from './usePersistentState';

const KEY = 'test:key';
const parse = (raw: string | null): string => (raw === null ? '기본값' : (JSON.parse(raw) as string));

function emitStorage(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

describe('usePersistentState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('저장된 값을 초기값으로 복원한다', () => {
    localStorage.setItem(KEY, '"저장됨"');
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    expect(result.current[0]).toBe('저장됨');
  });

  it('값이 바뀌면 localStorage에 저장한다', () => {
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    act(() => result.current[1]('새 값'));
    expect(localStorage.getItem(KEY)).toBe('"새 값"');
  });

  it('다른 탭에서 같은 키가 바뀌면 상태를 동기화한다', () => {
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    act(() => emitStorage(KEY, '"다른 탭"'));
    expect(result.current[0]).toBe('다른 탭');
  });

  it('다른 키의 변경은 무시한다', () => {
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    act(() => emitStorage('other:key', '"무관"'));
    expect(result.current[0]).toBe('기본값');
  });

  it('다른 탭에서 항목이 삭제되면 기본값으로 돌아간다', () => {
    localStorage.setItem(KEY, '"저장됨"');
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    act(() => emitStorage(KEY, null));
    expect(result.current[0]).toBe('기본값');
  });

  it('저장에 성공하면 saveFailed는 false다', () => {
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    expect(result.current[2]).toBe(false);
  });

  it('저장에 실패하면 saveFailed가 true가 된다', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const { result } = renderHook(() => usePersistentState(KEY, parse));
    expect(result.current[2]).toBe(true);
  });
});
