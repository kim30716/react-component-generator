import { describe, it, expect, vi } from 'vitest';
import {
  MAX_HISTORY,
  addToHistory,
  clearLegacyKeys,
  parseComponents,
  parseHistory,
  parseProvider,
} from './persistence';

describe('parseProvider', () => {
  it('저장된 값이 없으면 google이 기본값이다', () => {
    expect(parseProvider(null)).toBe('google');
  });

  it('저장된 provider를 복원한다', () => {
    expect(parseProvider('"anthropic"')).toBe('anthropic');
  });

  it('알 수 없는 provider면 기본값을 쓴다', () => {
    expect(parseProvider('"openai"')).toBe('google');
  });

  it('JSON이 깨졌으면 기본값을 쓴다', () => {
    expect(parseProvider('{깨짐')).toBe('google');
  });
});

describe('clearLegacyKeys', () => {
  it('이전 버전이 저장했던 API 키 항목을 삭제한다', () => {
    const storage = { removeItem: vi.fn() };
    clearLegacyKeys(storage);
    expect(storage.removeItem).toHaveBeenCalledWith('rcg:apiKeys');
  });

  it('저장소 접근이 실패해도 예외를 던지지 않는다', () => {
    const storage = {
      removeItem: () => {
        throw new Error('접근 불가');
      },
    };
    expect(() => clearLegacyKeys(storage)).not.toThrow();
  });
});

describe('parseHistory', () => {
  it('저장된 값이 없으면 빈 배열이다', () => {
    expect(parseHistory(null)).toEqual([]);
  });

  it('문자열 배열을 복원한다', () => {
    expect(parseHistory('["a","b"]')).toEqual(['a', 'b']);
  });

  it('문자열이 아닌 항목은 걸러낸다', () => {
    expect(parseHistory('["a",1,null,"b"]')).toEqual(['a', 'b']);
  });

  it('배열이 아니면 빈 배열이다', () => {
    expect(parseHistory('{"a":1}')).toEqual([]);
  });

  it('JSON이 깨졌으면 빈 배열이다', () => {
    expect(parseHistory('{깨짐')).toEqual([]);
  });
});

describe('parseComponents', () => {
  const stored = {
    id: '1',
    prompt: '프로필 카드',
    code: 'render(<div />)',
    createdAt: '2026-10-07T04:38:27.000Z',
  };

  it('저장된 값이 없으면 빈 배열이다', () => {
    expect(parseComponents(null)).toEqual([]);
  });

  it('createdAt을 Date 객체로 복원한다', () => {
    const [component] = parseComponents(JSON.stringify([stored]));
    expect(component.createdAt).toBeInstanceOf(Date);
    expect(component.createdAt.toISOString()).toBe(stored.createdAt);
  });

  it('필수 필드가 빠진 항목은 버린다', () => {
    const broken: Partial<typeof stored> = { ...stored };
    delete broken.code;
    expect(parseComponents(JSON.stringify([broken, stored]))).toHaveLength(1);
  });

  it('날짜가 올바르지 않은 항목은 버린다', () => {
    const broken = { ...stored, createdAt: '날짜 아님' };
    expect(parseComponents(JSON.stringify([broken]))).toEqual([]);
  });

  it('JSON이 깨졌으면 빈 배열이다', () => {
    expect(parseComponents('{깨짐')).toEqual([]);
  });
});

describe('addToHistory', () => {
  it('새 프롬프트를 맨 앞에 추가한다', () => {
    expect(addToHistory(['a'], 'b')).toEqual(['b', 'a']);
  });

  it('중복 프롬프트는 맨 앞으로 옮기고 하나만 남긴다', () => {
    expect(addToHistory(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
  });

  it('앞뒤 공백을 제거해 저장한다', () => {
    expect(addToHistory([], '  a  ')).toEqual(['a']);
  });

  it('공백뿐인 프롬프트는 추가하지 않는다', () => {
    expect(addToHistory(['a'], '   ')).toEqual(['a']);
  });

  it(`최대 ${MAX_HISTORY}개까지만 유지한다`, () => {
    const history = Array.from({ length: MAX_HISTORY }, (_, i) => `p${i}`);
    const next = addToHistory(history, 'new');
    expect(next).toHaveLength(MAX_HISTORY);
    expect(next[0]).toBe('new');
    expect(next).not.toContain(`p${MAX_HISTORY - 1}`);
  });
});
