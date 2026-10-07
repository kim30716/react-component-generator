import { describe, it, expect } from 'vitest';
import {
  createSseParser,
  extractAnthropicChunk,
  extractGoogleChunk,
  encodeStreamEvent,
  iterateChunks,
  buildDoneEvent,
} from './stream';

describe('createSseParser', () => {
  it('완결된 이벤트의 data를 반환한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a":1}\n\n')).toEqual(['{"a":1}']);
  });

  it('청크 경계에서 잘린 이벤트는 다음 청크와 합쳐 반환한다', () => {
    const parser = createSseParser();
    expect(parser.push('data: {"a"')).toEqual([]);
    expect(parser.push(':1}\n\ndata: 2\n\n')).toEqual(['{"a":1}', '2']);
  });

  it('CRLF 구분자와 event 라인을 처리한다', () => {
    const parser = createSseParser();
    expect(parser.push('event: x\r\ndata: hi\r\n\r\n')).toEqual(['hi']);
  });
});

describe('extractAnthropicChunk', () => {
  it('text_delta에서 텍스트를 꺼낸다', () => {
    const data = JSON.stringify({
      type: 'content_block_delta',
      delta: { type: 'text_delta', text: 'const A' },
    });
    expect(extractAnthropicChunk(data)).toEqual({ text: 'const A' });
  });

  it('stop_reason이 max_tokens이면 잘림으로 표시한다', () => {
    const data = JSON.stringify({ type: 'message_delta', delta: { stop_reason: 'max_tokens' } });
    expect(extractAnthropicChunk(data)).toEqual({ truncated: true });
  });

  it('error 이벤트의 메시지를 반환한다', () => {
    const data = JSON.stringify({ type: 'error', error: { message: 'overloaded' } });
    expect(extractAnthropicChunk(data)).toEqual({ error: 'overloaded' });
  });

  it('관심 없는 이벤트는 빈 객체를 반환한다', () => {
    expect(extractAnthropicChunk(JSON.stringify({ type: 'ping' }))).toEqual({});
  });
});

describe('extractGoogleChunk', () => {
  it('parts의 텍스트를 이어 붙여 반환한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'const ' }, { text: 'A' }] } }],
    });
    expect(extractGoogleChunk(data)).toEqual({ text: 'const A' });
  });

  it('finishReason이 MAX_TOKENS이면 잘림으로 표시한다', () => {
    const data = JSON.stringify({
      candidates: [{ content: { parts: [{ text: 'x' }] }, finishReason: 'MAX_TOKENS' }],
    });
    expect(extractGoogleChunk(data)).toEqual({ text: 'x', truncated: true });
  });
});

describe('iterateChunks', () => {
  function bodyOf(...parts: string[]) {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const part of parts) controller.enqueue(encoder.encode(part));
        controller.close();
      },
    });
  }

  async function collect(iterable: AsyncIterable<unknown>) {
    const out: unknown[] = [];
    for await (const item of iterable) out.push(item);
    return out;
  }

  it('SSE 본문을 읽어 extract한 청크를 순서대로 내보낸다', async () => {
    const body = bodyOf(
      'data: {"t":"a"}\n\ndata: {"t"',
      ':"b"}\n\n',
    );
    const chunks = await collect(iterateChunks(body, (data) => ({ text: JSON.parse(data).t })));
    expect(chunks).toEqual([{ text: 'a' }, { text: 'b' }]);
  });

  it('마지막 이벤트가 빈 줄로 끝나지 않아도 유실하지 않는다', async () => {
    const body = bodyOf('data: {"t":"a"}\n\ndata: {"t":"b"}');
    const chunks = await collect(iterateChunks(body, (data) => ({ text: JSON.parse(data).t })));
    expect(chunks).toEqual([{ text: 'a' }, { text: 'b' }]);
  });

  it('멀티바이트 문자가 청크 경계에서 잘려도 깨지지 않는다', async () => {
    const bytes = new TextEncoder().encode('data: {"t":"가"}\n\n');
    const split = bytes.indexOf(0xea) + 1; // '가'(3바이트)의 중간
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split));
        controller.close();
      },
    });
    const chunks = await collect(iterateChunks(body, (data) => ({ text: JSON.parse(data).t })));
    expect(chunks).toEqual([{ text: '가' }]);
  });
});

describe('buildDoneEvent', () => {
  it('누적 텍스트를 후처리한 코드로 done 이벤트를 만든다', () => {
    expect(buildDoneEvent('```jsx\nconst Card = () => null;\n```')).toEqual({
      type: 'done',
      code: 'const Card = () => null;\n\nrender(<Card />);',
    });
  });

  it('텍스트가 비어 있으면 한국어 error 이벤트를 만든다', () => {
    expect(buildDoneEvent('  \n')).toEqual({
      type: 'error',
      message: '생성된 코드가 비어 있습니다. 다시 시도해주세요.',
    });
  });
});

describe('encodeStreamEvent', () => {
  it('JSON 한 줄과 개행으로 직렬화한다', () => {
    expect(encodeStreamEvent({ type: 'delta', text: '가' })).toBe('{"type":"delta","text":"가"}\n');
  });
});
