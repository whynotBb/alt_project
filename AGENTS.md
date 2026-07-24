<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Alt Text Helper — 프로젝트 가이드

이 문서는 Cursor로 개발되어온 이 프로젝트를 Claude Code로 유지보수하기 위한 참고 문서입니다. 코드에서 바로 확인 가능한 내용(파일 목록, 함수 시그니처 등)은 담지 않고, 코드만 봐서는 알기 어려운 구조·함정·규칙 위주로 작성했습니다.

## 0. 프로젝트가 하는 일

사내 이미지 alt 텍스트(웹 접근성) 검수 도구입니다. 퍼블리싱 결과물(ZIP)을 업로드하면 이미지를 추출해 OCR로 텍스트를 읽고, 사람이 검수·수정한 뒤 alt 속성을 HTML에 반영하거나 검수 이력을 엑셀로 산출합니다.

## 1. 아키텍처 — 두 갈래로 나뉘어 있음을 반드시 인지할 것

**실제로 서비스되는 흐름 (기본적으로 여기를 수정하게 됨):**
`app/page.tsx` → `components/image-review-workspace.tsx` (클라이언트 컴포넌트)
- ZIP은 서버로 보내지 않고 브라우저에서 `JSZip`(`lib/client/extract-zip-assets.ts`)으로 직접 풀어 이미지·HTML을 추출
- 이미지별 OCR은 엔진에 따라 분기 (2절 참고)
- 검수 결과는 `lib/client/append-alt-review-excel-to-zip.ts` + `lib/build-alt-review-deliverable-excel.ts`로 엑셀을 만들어 ZIP에 추가 후 다운로드
- `app/inspection`, `app/comparator`, `app/image-compare`는 이 워크스페이스의 변형/보조 화면 (각각 `AltInspectionWorkspace`, `TextComparatorWorkspace`, `ImageComparatorWorkspace`)

**서버 배치 파이프라인 (현재 어떤 UI에서도 호출되지 않는 고아 코드):**
`lib/pipeline/*.ts`(오케스트레이터는 `run-zip-job.ts`) + `actions/upload-and-process.ts` + `app/api/upload-zip/route.ts` + `components/zip-upload-section.tsx`
- "ZIP을 서버로 업로드 → 서버 임시 디렉터리에서 추출 → Tesseract로 alt 자동 주입 → 재압축 후 다운로드 토큰 발급"을 구현하고 있지만, `zip-upload-section.tsx`를 import하는 page가 없어 실제로는 죽은 코드
- `app/(protected)/upload/page.tsx`도 콘텐츠 없이 `redirect("/")`만 함

**작업 전 반드시 확인:** 요청받은 기능이 어느 갈래에 속하는지 먼저 파악하고, 헷갈리면 사용자에게 확인. 고아 코드 쪽을 되살리거나 삭제하는 결정은 임의로 하지 말 것.

## 2. OCR 엔진

3개 엔진(`tesseract` / `google-vision` / `ocr-space`)은 `/api/ocr-image/route.ts`의 `parseEngine()`에서 분기됩니다 (기본값 google-vision). 실제 선택 로직은 `lib/client/ocr-image-fetch.ts`의 `requestOcrForImageItem(item, engine)`에 있는데:
- `tesseract` 선택 시에만 서버를 거치지 않고 `lib/client/tesseract-browser-ocr.ts`를 동적 import해 **브라우저에서 직접** OCR 수행 (`public/vendor/tesseract` 정적 자산 사용, `scripts/sync-tesseract-public.mjs`가 postinstall에서 동기화)
- 나머지 엔진(google-vision, ocr-space)은 항상 `/api/ocr-image`로 서버 fetch — 각각 `GOOGLE_CLOUD_VISION_API_KEY`, `OCR_SPACE_API_KEY` 필요

주의: 고아 코드인 `lib/pipeline/ocr-alt-inject.ts`는 엔진 선택 없이 Tesseract만 하드코딩되어 있음. 실제 서비스 흐름과 혼동하지 말 것.

## 3. 인증/보안 — 3단 방어선

1. `middleware.ts` (Edge, DB 접근 불가): `x-forwarded-for`/`x-real-ip` + env `ALLOWED_IPS`로 1차 IP 필터링. matcher는 `/`, `/login`, `/upload/:path*`, `/admin/:path*`.
2. `app/(protected)/layout.tsx`: `auth()` 세션 체크(없으면 `/login`) + `assertIpAllowed()`(`lib/security/ip-guard.ts`)로 IP 재검증. env에 `ALLOWED_IPS`가 없으면 DB `AllowedIp` 테이블(`lib/security/ip.ts`의 `matchesRule`)까지 확인 — **이 매칭은 진짜 CIDR 파싱이 아니라 단순 prefix 매칭**이므로 IP allowlist 로직을 건드릴 땐 그 한계를 인지할 것.
3. `auth.ts`: NextAuth v5(beta) 이메일 매직링크 로그인 시 `signIn` 콜백에서 `ALLOWED_EMAIL_DOMAINS` 검사. `SMTP_HOST` 미설정 시 실제 메일 발송 대신 콘솔에 링크만 출력(로컬 개발용).

`lib/dev-access.ts`의 `isOpenAccessDev()`(`OPEN_ACCESS_DEV=true`)는 위 세 단계를 전부 우회하는 개발 전용 스위치입니다. **운영 환경에서는 반드시 `false`**여야 하며, 이 값을 다루는 코드를 수정할 땐 특히 신중할 것.

## 4. DB (Prisma, SQLite)

Auth.js 표준 모델(`User`/`Account`/`Session`/`VerificationToken`) 외 앱 고유 모델:
- `AllowedIp` — `cidr` unique, `note` — IP allowlist (관리자 UI에서 CRUD)
- `AuditLog` — `userId?`(User optional, `onDelete: SetNull`), `action`, `fileCount`, `clientIp` — 검수 처리 이력

스키마 변경 시 `npm run db:migrate`로 마이그레이션 생성 (SQLite 파일은 `prisma/prisma/dev.db`, git에 커밋되지 않음).

## 5. 개발 명령어

```bash
npm run dev          # next dev
npm run build         # prisma generate && next build
npm run lint          # eslint (flat config, core-web-vitals + typescript, 커스텀 규칙 없음)
npm run db:migrate    # prisma migrate dev
npm run db:studio     # prisma studio
```

## 6. 코딩 컨벤션

- TypeScript `strict: true`, path alias `@/*`, `moduleResolution: "bundler"`
- **들여쓰기가 파일마다 혼재**함: 워크스페이스 관련 컴포넌트(`image-review-workspace.tsx`, `app/inspection/page.tsx` 등)는 탭, admin 페이지·`auth.ts`·`actions/*.ts`는 2-space. Prettier/`.editorconfig` 없음 — 새 파일은 인접 파일 스타일을 따르고, 기존 파일 수정 시 그 파일의 기존 스타일을 유지할 것.
- shadcn/ui 설정(`components.json`): style `base-nova`, baseColor `neutral`
- Tailwind v4 CSS-first (`app/globals.css`의 `@import`/`@theme inline`), 폰트는 Pretendard
- `useSearchParams()`를 쓰는 클라이언트 워크스페이스는 항상 `<Suspense>`로 감싸는 패턴이 모든 워크스페이스 page.tsx에서 일관되게 나타남 — 새 워크스페이스 페이지를 추가할 때도 따를 것
- `headers()`는 비동기이므로 `await headers()`로 사용 (`app/(protected)/layout.tsx`, `actions/audit.ts` 참고)
- Server Action 파일은 상단에 `"use server"` 지시어

## 7. next.config.ts 관련 주의사항

- `serverExternalPackages: ["tesseract.js", "tesseract.js-core", "sharp"]`, `outputFileTracingIncludes`로 tesseract wasm 파일을 명시적으로 포함 — Vercel 서버리스 배포 시 누락되면 런타임 ENOENT 발생하니 tesseract 관련 의존성을 건드릴 때 이 설정도 같이 확인할 것
- `experimental.serverActions.bodySizeLimit: "50mb"` — 대용량 ZIP 업로드 대응. Server Action으로 파일을 받는 코드를 추가/수정할 때 이 상한을 넘는지 고려

## 8. 환경 변수 (`.env.example` 참고)

`DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`은 필수. `OPEN_ACCESS_DEV`(기본 false, 3절 참고), `ALLOWED_IPS`/`ALLOWED_EMAIL_DOMAINS`(미설정 시 각각 DB 기반/무제한), SMTP 관련(`SMTP_HOST` 등 미설정 시 콘솔 출력 모드), `MAX_OCR_IMAGES`, `GOOGLE_CLOUD_VISION_API_KEY`가 있음.

## 9. 작업 시 원칙

1. 위 1절의 두 갈래 구조를 확인하지 않고 "고아 코드" 쪽을 수정하거나, 반대로 실제 서비스 흐름을 놔두고 죽은 코드를 고치는 실수를 하지 않는다.
2. 읽지 않은 파일이나 실행해보지 않은 코드를 확인했다고 말하지 않는다. 코드 변경 후에는 가능하면 `npm run lint`를 돌리고, UI 관련 변경은 실제로 `npm run dev`로 동작을 확인한다.
3. 요청 범위를 벗어난 리팩터링·스타일 통일(예: 탭/스페이스 통일)·기능 추가는 하지 않는다. 필요하다고 판단되면 마지막에 제안만 한다.
4. `OPEN_ACCESS_DEV`, IP allowlist, 이메일 도메인 검사 등 보안 관련 로직을 수정할 땐 우회 경로가 생기지 않는지 특히 주의한다.
5. 작업을 계획만 하고 멈추지 않는다. 막히면 지금까지의 결과와 막힌 지점, 시도한 방법을 함께 보고한다.
