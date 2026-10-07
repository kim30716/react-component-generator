import { useState, useEffect } from 'react';
import { PromptInput } from './components/PromptInput';
import { ComponentCard } from './components/ComponentCard';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { usePersistentState } from './hooks/usePersistentState';
import {
  STORAGE_KEYS,
  addToHistory,
  clearLegacyKeys,
  parseHistory,
  parseProvider,
} from './utils/persistence';
import type { Provider } from './types';
import './App.css';

const PROVIDER_CONFIG = {
  anthropic: { label: 'Anthropic', placeholder: 'sk-ant-...' },
  google: { label: 'Google', placeholder: 'AIza...' },
} as const;

function App() {
  // API 키는 localStorage에 저장하지 않고 메모리에만 둔다. 미리보기가 생성된 코드를 같은 origin에서
  // 실행하므로, 저장해 두면 생성된 코드가 키를 읽어 갈 수 있다. provider별로 보관해 키가 섞여 나가지 않게 한다.
  const [apiKeys, setApiKeys] = useState<Record<Provider, string>>({ anthropic: '', google: '' });
  const [provider, setProvider] = usePersistentState(STORAGE_KEYS.provider, parseProvider);
  const [history, setHistory] = usePersistentState(STORAGE_KEYS.history, parseHistory);
  const [showKey, setShowKey] = useState(false);
  const apiKey = apiKeys[provider];
  const [envKeys, setEnvKeys] = useState<Record<Provider, boolean>>({
    anthropic: false,
    google: false,
  });
  const { components, isLoading, error, storageFailed, generate, removeComponent, clearAll } =
    useComponentGenerator();

  useEffect(() => {
    try {
      clearLegacyKeys(localStorage);
    } catch {
      // localStorage 참조 자체가 막힌 환경(일부 시크릿 모드)에서는 지울 것이 없다.
    }
  }, []);

  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => setEnvKeys(data.envKeys))
      .catch(() => {});
  }, []);

  const hasEnvKey = envKeys[provider];

  const handleGenerate = (prompt: string) => {
    if (!apiKey.trim() && !hasEnvKey) {
      alert(`${PROVIDER_CONFIG[provider].label} API 키를 입력하거나 .env에 설정해주세요.`);
      return;
    }
    // 실패한 프롬프트가 히스토리 자리를 차지하지 않도록 생성에 성공했을 때만 기록한다.
    generate(prompt, apiKey || undefined, provider).then((succeeded) => {
      if (succeeded) setHistory((prev) => addToHistory(prev, prompt));
    });
  };

  const handleApiKeyChange = (value: string) => {
    setApiKeys((prev) => ({ ...prev, [provider]: value }));
  };

  const activeProvider = PROVIDER_CONFIG[provider].label;

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-mark">RC</div>
        <div className="header-copy">
          <span className="eyebrow">React Component Generator</span>
          <h1>프롬프트로 만드는 UI 워크벤치</h1>
          <p>요청을 입력하고, 생성된 React 컴포넌트를 바로 미리보고 코드로 확인합니다.</p>
        </div>
        <div className="header-meta" aria-label="현재 작업 상태">
          <div>
            <span>Provider</span>
            <strong>{activeProvider}</strong>
          </div>
          <div>
            <span>Components</span>
            <strong>{components.length}</strong>
          </div>
        </div>
      </header>

      <main className="workspace">
        <section className="composer-panel" aria-label="컴포넌트 생성">
          <PromptInput onGenerate={handleGenerate} isLoading={isLoading} history={history} />
        </section>

        <aside className="settings-panel" aria-label="실행 설정">
          <div className="settings-header">
            <span className="panel-kicker">Runtime</span>
            <h2>실행 설정</h2>
          </div>
          <div className="provider-select">
            <label htmlFor="provider">Provider</label>
            <select
              id="provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value as Provider)}
            >
              {Object.entries(PROVIDER_CONFIG).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="api-key-input">
            <label htmlFor="api-key">
              API Key
            </label>
            <div className="api-key-field">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder={
                  hasEnvKey
                    ? '서버 키 사용 중 (직접 입력으로 덮어쓰기 가능)'
                    : PROVIDER_CONFIG[provider].placeholder
                }
              />
              <button
                className="btn-toggle-key"
                onClick={() => setShowKey(!showKey)}
                type="button"
              >
                {showKey ? '숨기기' : '보기'}
              </button>
            </div>
            <p className={`key-status ${hasEnvKey ? 'key-status--ready' : ''}`}>
              {hasEnvKey ? '.env 키가 연결되어 있습니다.' : '직접 입력하거나 서버 환경변수를 설정하세요.'}
            </p>
          </div>
        </aside>
      </main>

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {storageFailed && (
        <div className="error-banner" role="status">
          <p>브라우저 저장 공간이 부족해 생성된 컴포넌트를 저장하지 못했습니다. 새로고침하면 목록이 이전 상태로 돌아갈 수 있습니다. 오래된 컴포넌트를 삭제해주세요.</p>
        </div>
      )}

      <section className="results-section">
        {components.length > 0 && (
          <div className="results-header">
            <div>
              <span className="panel-kicker">Generated</span>
              <h2>생성된 컴포넌트</h2>
            </div>
            <button className="btn-clear" onClick={clearAll}>
              전체 삭제
            </button>
          </div>
        )}

        {components.length === 0 && !isLoading && (
          <div className="empty-state">
            <div className="empty-preview" aria-hidden="true">
              <div className="empty-window">
                <span />
                <span />
                <span />
              </div>
              <div className="empty-canvas">
                <div className="empty-card empty-card--primary" />
                <div className="empty-card" />
                <div className="empty-card empty-card--wide" />
              </div>
            </div>
            <div className="empty-copy">
              <h2>새 컴포넌트를 생성해보세요.</h2>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="loading-card">
            <div className="loading-pulse" />
            <p>컴포넌트를 생성하고 있습니다...</p>
          </div>
        )}

        <div className="results-grid">
          {components.map((component) => (
            <ComponentCard
              key={component.id}
              component={component}
              onRemove={removeComponent}
              onRegenerate={handleGenerate}
              isLoading={isLoading}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

export default App;
