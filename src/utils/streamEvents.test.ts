import { describe, it, expect } from 'vitest';
import { createStreamEventParser } from './streamEvents';

describe('createStreamEventParser', () => {
  it('완결된 줄을 이벤트로 파싱한다', () => {
    const parser = createStreamEventParser();
    expect(parser.push('{"type":"delta","text":"a"}\n{"type":"done","code":"c"}\n')).toEqual([
      { type: 'delta', text: 'a' },
      { type: 'done', code: 'c' },
    ]);
  });

  it('청크 경계에서 잘린 줄은 다음 청크와 합쳐 파싱한다', () => {
    const parser = createStreamEventParser();
    expect(parser.push('{"type":"del')).toEqual([]);
    expect(parser.push('ta","text":"a"}\n')).toEqual([{ type: 'delta', text: 'a' }]);
  });

  it('깨진 줄은 한국어 메시지로 에러를 던진다', () => {
    const parser = createStreamEventParser();
    expect(() => parser.push('not json\n')).toThrow('서버 응답을 해석하지 못했습니다.');
  });

  it('빈 줄은 무시한다', () => {
    const parser = createStreamEventParser();
    expect(parser.push('\n\n')).toEqual([]);
  });
});
