# server/AGENTS.md

## Module Context

Bun 런타임에서 실행되는 AI API 프록시 (`Bun.serve`, 포트 3002). 프론트는 Vite 프록시(`/api`)로만 접근한다.

## Tech Stack & Constraints

- 런타임 API는 Bun 전용 (`Bun.serve`, `process.env`). 외부 HTTP 클라이언트 라이브러리 없이 전역 `fetch`만 사용한다.
- 의존성 추가 없이 Anthropic/Google REST를 직접 호출한다. SDK를 새로 도입하지 마라.

## Implementation Patterns

- 응답 후처리 순서: `ensureRenderCall(stripCodeFences(text))`. (`index.ts:188`)
- 상위 API 오류는 `Claude API error: <status>` / `Gemini API error: <status>` 문자열로 던지고, 핸들러가 `message.includes('503'|'429')`로 상태코드를 매핑한다. (`index.ts:84-86,111-113,194-206`)
- 모든 응답에 `CORS_HEADERS`를 붙인다. 새 라우트/에러 분기에서도 누락하지 마라. (`index.ts:51-55`)
- 테스트 가능해야 하는 로직은 `generator.ts`, `fallback.ts`처럼 부수효과 없는 모듈로 분리한다.

## Testing Strategy

- 실행: `bun run test -- server/` (파일명은 `*.test.ts`, 대상 파일 옆에 배치).
- 모킹은 `vi.fn` 사용 (`fallback.test.ts`).

## Local Golden Rules

- Don't: `index.ts`를 테스트에서 import 하지 마라. import 시점에 `Bun.serve`가 포트 3002를 점유한다. (`index.ts:138`)
- Do: 시스템 프롬프트 수정 시 "import 금지, 인라인 스타일, TypeScript 문법 금지, 마지막에 `render(<X />)`" 규칙을 유지하라. 생성 코드는 react-live에서 실행되므로 위반 시 미리보기가 깨진다. (`index.ts:7-20`)
- Asymmetry: `withModelFallback` 폴백은 Google 경로에만 있고 Anthropic은 단일 모델이다. 폴백을 추가하려면 `GOOGLE_MODELS` 같은 우선순위 배열 패턴을 따르라. (`index.ts:5,134-136,77`)
- Asymmetry: `MAX_TOKENS` 잘림 검사는 Gemini에만 있다. Anthropic 경로를 수정할 때 `stop_reason` 확인 필요 여부를 함께 검토하라. (`index.ts:123-125`)
- Security Boundary: `/api/config`는 키 존재 여부(boolean)만 반환한다. 키 값을 응답/로그에 넣지 마라. Gemini 호출 URL은 쿼리에 키를 포함하므로 URL을 로그나 에러 메시지에 노출하지 마라. (`index.ts:147-157,99`)
