import { describe, it, expect } from 'vitest';
import { MAX_PROMPT_LENGTH, validatePrompt } from './validatePrompt';

describe('validatePrompt', () => {
  it('최대 길이는 500자다', () => {
    expect(MAX_PROMPT_LENGTH).toBe(500);
  });

  it('정확히 500자는 유효하다', () => {
    expect(validatePrompt('가'.repeat(500)).valid).toBe(true);
  });

  it('501자는 유효하지 않다', () => {
    expect(validatePrompt('가'.repeat(501)).valid).toBe(false);
  });

  it('초과 시 한국어 에러 메시지를 반환한다', () => {
    expect(validatePrompt('가'.repeat(501)).error).toBe('프롬프트는 500자를 넘을 수 없습니다.');
  });

  it('유효하면 에러가 없다', () => {
    expect(validatePrompt('프로필 카드').error).toBeUndefined();
  });

  it('앞뒤 공백은 길이에 포함하지 않는다', () => {
    expect(validatePrompt(`  ${'가'.repeat(500)}  `).valid).toBe(true);
  });
});
