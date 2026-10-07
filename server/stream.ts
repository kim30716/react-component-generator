// 상위 API(SSE)의 스트림을 해석하고 프론트로 보낼 이벤트를 직렬화하는 순수 함수들.
// 부수효과(Bun.serve, fetch)가 없어 단위 테스트가 가능하다.

import { ensureRenderCall, stripCodeFences } from './generator';

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; message: string };

export interface StreamChunk {
  text?: string;
  truncated?: boolean;
  error?: string;
}

/** SSE 바이트 스트림을 청크 단위로 받아 완결된 이벤트의 data 페이로드만 돌려준다. */
export function createSseParser(): { push(chunk: string): string[] } {
  let buffer = '';

  return {
    push(chunk) {
      buffer += chunk;
      const events = buffer.replace(/\r\n/g, '\n').split('\n\n');
      buffer = events.pop() ?? '';

      const payloads: string[] = [];
      for (const event of events) {
        const data = event
          .split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n');
        if (data) payloads.push(data);
      }
      return payloads;
    },
  };
}

export function extractAnthropicChunk(data: string): StreamChunk {
  const event = JSON.parse(data) as {
    type: string;
    delta?: { type?: string; text?: string; stop_reason?: string };
    error?: { message?: string };
  };

  if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
    return { text: event.delta.text ?? '' };
  }
  if (event.type === 'message_delta' && event.delta?.stop_reason === 'max_tokens') {
    return { truncated: true };
  }
  if (event.type === 'error') {
    return { error: event.error?.message ?? 'Unknown error' };
  }
  return {};
}

export function extractGoogleChunk(data: string): StreamChunk {
  const event = JSON.parse(data) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
      finishReason?: string;
    }>;
  };

  const candidate = event.candidates?.[0];
  const chunk: StreamChunk = {};
  const text = candidate?.content?.parts?.map((part) => part.text ?? '').join('');
  if (text) chunk.text = text;
  if (candidate?.finishReason === 'MAX_TOKENS') chunk.truncated = true;
  return chunk;
}

/** 상위 API의 SSE 본문을 읽어 data마다 extract한 청크를 순서대로 내보낸다. */
export async function* iterateChunks(
  body: ReadableStream<Uint8Array>,
  extract: (data: string) => StreamChunk,
): AsyncGenerator<StreamChunk> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const data of parser.push(decoder.decode(value, { stream: true }))) {
        yield extract(data);
      }
    }
    // 마지막 이벤트가 빈 줄 없이 끝난 경우를 위해 남은 버퍼를 비운다.
    for (const data of parser.push(`${decoder.decode()}\n\n`)) {
      yield extract(data);
    }
  } finally {
    // 소비자가 중간에 멈추면 상위 응답 읽기도 중단한다.
    await reader.cancel().catch(() => {});
  }
}

/** 누적된 응답 텍스트로 최종 이벤트를 만든다. 비어 있으면(안전 차단 등) 실패로 알린다. */
export function buildDoneEvent(text: string): StreamEvent {
  if (!text.trim()) {
    return { type: 'error', message: '생성된 코드가 비어 있습니다. 다시 시도해주세요.' };
  }
  return { type: 'done', code: ensureRenderCall(stripCodeFences(text)) };
}

/** 프론트로 보내는 NDJSON 한 줄. */
export function encodeStreamEvent(event: StreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}
