import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// 파싱·검증은 utils/persistence의 순수 함수가 맡고, 이 훅은 localStorage 읽기/쓰기만 한다.
// 시크릿 모드나 용량 초과로 접근이 실패해도 앱은 메모리 상태로 계속 동작해야 하므로 예외는 삼킨다.
export function usePersistentState<T>(
  key: string,
  parse: (raw: string | null) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return parse(null);
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // 저장 실패는 무시한다.
    }
  }, [key, value]);

  return [value, setValue];
}
