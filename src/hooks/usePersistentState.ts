import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';

// 파싱·검증은 utils/persistence의 순수 함수가 맡고, 이 훅은 localStorage 읽기/쓰기와 탭 간 동기화만 한다.
// 시크릿 모드나 용량 초과로 접근이 실패해도 앱은 메모리 상태로 계속 동작해야 하므로 예외는 삼키되,
// 저장이 안 되고 있다는 사실은 saveFailed로 알려 사용자가 새로고침 시 유실을 예상할 수 있게 한다.
export function usePersistentState<T>(
  key: string,
  parse: (raw: string | null) => T,
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    try {
      return parse(localStorage.getItem(key));
    } catch {
      return parse(null);
    }
  });
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    // 저장 성공 여부는 localStorage에 써 봐야 알 수 있어, 외부 시스템 쓰기 결과를 상태로 반영한다.
    try {
      localStorage.setItem(key, JSON.stringify(value));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [key, value]);

  // 다른 탭이 값을 바꾸면 따라간다. 따라가지 않으면 이 탭의 오래된 상태가 다음 저장 때 다른 탭의 변경을 덮어쓴다.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key) setValue(parse(event.newValue));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, parse]);

  return [value, setValue, saveFailed];
}
