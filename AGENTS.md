# AGENTS.md

## Operational Commands

- 패키지 매니저는 `bun` 고정 (`bun.lock`). npm/yarn/pnpm 사용 금지.
- 설치: `bun install`
- 개발 (API + Vite 동시): `bun run dev` — API `:3002`, 프론트 `:5173`
- 테스트 전체: `bun run test` (vitest run). `bun test`는 Bun 내장 러너를 실행하므로 사용 금지.
- 단일 테스트: `bun run test -- server/fallback.test.ts`
- 린트: `bun run lint`
- 빌드/타입체크: `bun run build` (`tsc -b && vite build`)

## Golden Rules

### Immutable

- `.env`를 읽거나 출력하거나 커밋하지 마라. 키 이름 확인이 필요하면 값을 마스킹하라. (`.gitignore:32`, `server/index.ts:59-62`)
- API 키는 서버 밖으로 나가면 안 된다. `/api/config`는 키 존재 여부(boolean)만 반환한다. 키 값을 응답에 포함하지 마라. (`server/index.ts:147-157`)
- 클라이언트에서 Anthropic/Google API를 직접 호출하지 마라. 모든 호출은 `/api/generate` 프록시를 거친다. (`src/hooks/useComponentGenerator.ts:23`, `vite.config.ts:9-14`)

### Do's & Don'ts

- Don't: 프론트(`src/`)에서 `server/` 모듈을 import 하지 마라. 두 영역은 런타임이 다르다 (브라우저/jsdom vs Bun).
- Don't: 새 사용자 노출 문자열은 기존처럼 한국어로 작성하라 (에러 메시지, 테스트 설명 포함).
- Do: 생성 코드 미리보기는 react-live `noInline` 전제다. 이 설정을 바꾸면 서버의 `ensureRenderCall` 후처리와 시스템 프롬프트도 함께 바꿔야 한다. (`src/components/LivePreview.tsx:14`)

### 팀 고유 규칙 (코드 근거)

- Test Boundary: 순수 함수(`server/generator.ts`, `server/fallback.ts`)와 `PromptInput`만 테스트가 있다. HTTP 핸들러, LivePreview, 훅은 테스트가 없으므로 로직을 추가할 때는 부수효과 없는 모듈로 분리해 테스트하라. (`server/generator.ts:1-2`)
- Hard Constraint: vitest `include`는 `src/**`와 `server/**`만 잡고 환경은 전역 `jsdom`이다. 이 밖의 경로에 테스트를 두면 실행되지 않는다. (`vite.config.ts:16-21`)
- Security Boundary: 사용자가 UI에 입력한 `apiKey`는 요청 바디로만 전달되며 서버 환경변수 키보다 우선한다. 로그나 에러 메시지에 키를 남기지 마라. (`server/index.ts:64-66`, `src/hooks/useComponentGenerator.ts:26`)

## Project Context

프롬프트로 React 컴포넌트를 AI가 생성하고 실시간 미리보기와 코드를 제공하는 도구. 설치/실행/기능은 `README.md` 참고.

Tech Stack: React 19, TypeScript, Vite 8, Bun(`Bun.serve`), react-live, Vitest 4, Testing Library, ESLint 9.

## Standards & References

- 커밋 메시지: `type: 한국어 요약` (`feat`, `fix`, `refactor`, `docs`, `chore`). 예: `feat: 백엔드 서버 구현`.
- 기본 브랜치는 `main`.
- 코드 변경 후 `bun run lint`, `bun run test`, `bun run build`를 통과시켜라.

## Maintenance Policy

이 파일의 규칙과 코드 사이에 괴리가 발견되면 (예: 폴백이 Anthropic에도 추가됨, 라인 근거가 이동함) 작업을 마치기 전에 업데이트를 제안하라.
