// /api/generate 스트림(NDJSON)을 이벤트로 해석하는 순수 함수. server/stream.ts의 StreamEvent와 같은 형태다.
// 프론트에서 server/ 모듈을 import 할 수 없어 타입을 따로 선언한다.

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'done'; code: string }
  | { type: 'error'; message: string };

function parseLine(line: string): StreamEvent {
  try {
    return JSON.parse(line) as StreamEvent;
  } catch {
    throw new Error('서버 응답을 해석하지 못했습니다.');
  }
}

export function createStreamEventParser(): { push(chunk: string): StreamEvent[] } {
  let buffer = '';

  return {
    push(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      return lines.filter((line) => line.trim()).map(parseLine);
    },
  };
}
