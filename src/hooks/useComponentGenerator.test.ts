import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComponentGenerator } from './useComponentGenerator';
import type { StreamEvent } from '../utils/streamEvents';

const encoder = new TextEncoder();

function encode(events: StreamEvent[]): Uint8Array {
  return encoder.encode(events.map((e) => `${JSON.stringify(e)}\n`).join(''));
}

function mockStreamFetch(events: StreamEvent[]) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encode(events));
      controller.close();
    },
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body }));
}

function mockErrorFetch(error: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error }) }),
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

  it('생성에 성공하면 true를 반환하고 완성된 코드를 목록에 추가한다', async () => {
    mockStreamFetch([
      { type: 'delta', text: 'const A' },
      { type: 'done', code: 'const A = 1;\n\nrender(<A />);' },
    ]);
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(true);
    expect(result.current.components).toHaveLength(1);
    expect(result.current.components[0].code).toBe('const A = 1;\n\nrender(<A />);');
  });

  it('생성에 실패하면 false를 반환하고 에러를 남긴다', async () => {
    mockErrorFetch('키가 올바르지 않습니다.');
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('키가 올바르지 않습니다.');
    expect(result.current.components).toHaveLength(0);
  });

  it('스트림 도중 error 이벤트가 오면 false를 반환하고 컴포넌트를 추가하지 않는다', async () => {
    mockStreamFetch([
      { type: 'delta', text: 'const A' },
      { type: 'error', message: '스트림 오류' },
    ]);
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('스트림 오류');
    expect(result.current.components).toHaveLength(0);
  });

  it('done 이벤트 없이 스트림이 끝나면 실패로 처리한다', async () => {
    mockStreamFetch([{ type: 'delta', text: 'const A' }]);
    const { result, succeeded } = await generateOnce();
    expect(succeeded).toBe(false);
    expect(result.current.error).toBe('생성이 중단되었습니다. 다시 시도해주세요.');
    expect(result.current.components).toHaveLength(0);
  });

  it('생성 중에는 받은 델타를 streamingCode에 누적하고 끝나면 null로 되돌린다', async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c;
      },
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, body }));

    const { result } = renderHook(() => useComponentGenerator());
    expect(result.current.streamingCode).toBeNull();

    let pending!: Promise<boolean>;
    act(() => {
      pending = result.current.generate('프로필 카드', undefined, 'google');
    });
    expect(result.current.streamingCode).toBe('');

    await act(async () => {
      controller.enqueue(encode([{ type: 'delta', text: 'const A' }]));
    });
    await waitFor(() => expect(result.current.streamingCode).toBe('const A'));

    await act(async () => {
      controller.enqueue(encode([{ type: 'delta', text: ' = 1;' }]));
    });
    await waitFor(() => expect(result.current.streamingCode).toBe('const A = 1;'));

    await act(async () => {
      controller.enqueue(encode([{ type: 'done', code: 'const A = 1;' }]));
      controller.close();
      await pending;
    });
    expect(result.current.streamingCode).toBeNull();
  });
});
