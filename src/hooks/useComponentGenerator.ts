import { useState, useCallback } from 'react';
import type { GeneratedComponent, Provider } from '../types';
import { STORAGE_KEYS, addComponent, parseComponents } from '../utils/persistence';
import { createStreamEventParser } from '../utils/streamEvents';
import { usePersistentState } from './usePersistentState';

interface UseComponentGeneratorReturn {
  components: GeneratedComponent[];
  isLoading: boolean;
  /** 생성 중에 받은 코드(누적). 생성 중이 아니면 null. */
  streamingCode: string | null;
  error: string | null;
  storageFailed: boolean;
  /** 생성에 성공하면 true, 실패하면 false를 반환한다. */
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<boolean>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

/** 스트림을 끝까지 읽어 최종 코드를 반환한다. 델타가 올 때마다 onProgress로 누적 코드를 알린다. */
async function readCode(
  body: ReadableStream<Uint8Array>,
  onProgress: (accumulated: string) => void,
): Promise<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const parser = createStreamEventParser();
  let accumulated = '';

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    for (const event of parser.push(decoder.decode(value, { stream: true }))) {
      if (event.type === 'delta') {
        accumulated += event.text;
        onProgress(accumulated);
      } else if (event.type === 'error') {
        throw new Error(event.message);
      } else {
        return event.code;
      }
    }
  }

  throw new Error('생성이 중단되었습니다. 다시 시도해주세요.');
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents, storageFailed] = usePersistentState(
    STORAGE_KEYS.components,
    parseComponents,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [streamingCode, setStreamingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    setIsLoading(true);
    setStreamingCode('');
    setError(null);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }

      const code = await readCode(res.body, setStreamingCode);

      const newComponent: GeneratedComponent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        prompt,
        code,
        createdAt: new Date(),
      };

      setComponents((prev) => addComponent(prev, newComponent));
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      return false;
    } finally {
      setIsLoading(false);
      setStreamingCode(null);
    }
  }, [setComponents]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, isLoading, streamingCode, error, storageFailed, generate, removeComponent, clearAll };
}
