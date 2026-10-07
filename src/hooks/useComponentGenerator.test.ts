import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';

function mockFetch(response: { ok: boolean; body: unknown }) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: response.ok, json: async () => response.body }),
  );
}

async function generateOnce() {
  const { result } = renderHook(() => useComponentGenerator());
  let succeeded: boolean | undefined;
  await act(async () => {
    succeeded = await result.current.generate('프로필 카드', undefined, 'google');
  });
  return { result, succeeded };
}

describe('useComponentGenerator.generate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('생성에 성공하면 true를 반환하고 목록에 추가한다', async () => {
    mockFetch({ ok: true, body: { code: 'render(<div />)' } });
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(true);
    expect(result.current.components).toHaveLength(1);
  });

  it('생성에 실패하면 false를 반환하고 에러를 남긴다', async () => {
    mockFetch({ ok: false, body: { error: '키가 올바르지 않습니다.' } });
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('키가 올바르지 않습니다.');
    expect(result.current.components).toHaveLength(0);
  });
});
