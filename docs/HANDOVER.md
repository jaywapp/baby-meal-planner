# BabyMeal Planner — 인수인계서

작성일: 2026-07-24 | 작성: Claude (Aina 세션)
다른 사람/AI 세션이 이 문서만 읽고 이어서 작업할 수 있도록 정리한 문서.

---

## 1. 프로젝트 개요

- **목적**: 이나(아기, 2025-12-03생)의 이유식 식단·알러지 테스트·냉장고 큐브 재고·성장 기록을 관리하는 가족용 웹앱
- **레포**: https://github.com/jaywapp/baby-meal-planner (`main` 브랜치 기준)
- **로컬 경로**: `D:\aina\ina\babymeal`
- **운영 방침 (사용자 지시)**: BabyMeal Planner 관련 모든 요청·지시는 **이 레포 기준으로** 작업한다. 단순 정적 HTML이 아니라 **DB + 서버 기반 동적 앱**으로 운영한다.
- **설계 문서**(이유식 도메인 규칙): `D:\aina\docs\superpowers\specs\2026-07-23-babymeal-planner-design.md`
  - 하루 2끼(오전/저녁), 3일 사이클로 죽 2종 제작, 저녁엔 소고기 필수
  - 알러지 테스트: 3일 사이클 (3g → 10g → 20g), 고위험 식품은 평일만
  - 금지 조합·연속 끼니 중복 금지 등 규칙 포함 — **식단 자동 생성 구현 시 반드시 참조**

## 2. 히스토리 (시간순)

1. **v1 (2026-07-23)**: 바닐라 HTML 단일 파일(`index.html`, LocalStorage 저장) — 삭제됨 (git 히스토리 `d40e920`에 있음)
2. v1을 GitHub Pages로 배포했었음 → https://jaywapp.github.io/baby-meal-planner/ (**현재는 낡은 v1이 그대로 서비스 중 — 아래 잔여 작업 참조**)
3. **v2 (2026-07-24, 현재)**: Next.js + Neon Postgres로 전면 재구축, `main`에 푸시 완료 (`97c22fd`)
   - v1의 버그 수정 포함: 식단 캘린더의 주간/일간/월간 탭이 동작 안 하던 문제 (핸들러 부재) → React 상태 기반으로 3개 뷰 모두 구현
   - v1 하드코딩 데이터(식단 사이클 1~3, 냉장고 재고, 알러지 큐, 먹어본 재료 32종)를 시드 스크립트로 이관

## 3. 기술 스택 / 구조

- Next.js 15 (App Router) + TypeScript + React 19, 별도 CSS 프레임워크 없음 (기존 다크 디자인을 `app/globals.css`로 이식)
- DB: **Neon Postgres** (Vercel Marketplace) — `@neondatabase/serverless` HTTP 드라이버, ORM 없이 raw SQL
- 호스팅: Vercel (프로젝트명 `baby-meal-planner`, 계정 `jaywapp16-2281`, CLI 인증됨)

```
app/
  page.tsx              # 대시보드 (오늘 식단, 알러지 진행, 재고, 성장)
  calendar/page.tsx     # ★ 식단 캘린더: 주간/일간/월간 탭 + 슬롯별 식단 편집 모달
  allergy/page.tsx      # 진행중/대기 테스트, 완료 처리(→ 먹어본 재료 자동 등록), 테스트 추가
  fridge/page.tsx       # 큐브 재고 카드, 추가/수량수정/삭제
  ingredients/page.tsx  # 먹어본 재료 (카테고리별)
  growth/page.tsx       # 성장 기록 + SVG 차트
  nutrition/page.tsx    # 최근 7일 식단에서 자동 집계
  shopping/page.tsx     # 앞으로 3일 식단 vs 재고 비교해 자동 산출
  settings/page.tsx     # 아기 정보 수정
  api/                  # REST: baby, meals, fridge(+[id]), allergy, growth, ingredients
components/Nav.tsx      # 사이드바(PC) + 하단탭(모바일)
components/ui.tsx       # Chip, api() fetch 헬퍼, ymd(), DAY_NAMES
lib/db.ts               # getSql() — DATABASE_URL 지연 초기화 (빌드타임 크래시 방지)
lib/types.ts            # 공유 타입 (MealIngredient.type: grain|veggie|protein|fruit|test|etc)
scripts/init-db.mjs     # ★ 스키마 생성 + 시드 (멱등, 빈 테이블일 때만 시드)
```

### DB 스키마 (scripts/init-db.mjs가 생성)

| 테이블 | 내용 | 비고 |
|---|---|---|
| `baby` | 아기 정보 단일 행 (id=1 고정) | |
| `meal_plans` | PK (date, slot), slot='morning'\|'evening', ingredients JSONB | ingredients = `[{name, amount?, type, test?}]` |
| `fridge_stock` | UNIQUE (ingredient, size), count | POST는 count 증가(upsert), PATCH는 절대값 |
| `allergy_tests` | status: in_progress/queued/completed, queue_order | 완료 시 tested_ingredients에 자동 insert |
| `tested_ingredients` | name UNIQUE, category, excluded | |
| `growth_records` | date, weight, height? | POST 시 baby.weight도 갱신 |

## 4. 현재 상태 (2026-07-24 기준)

| 항목 | 상태 |
|---|---|
| 코드 (v2 전체) | ✅ 완료, `main` 푸시됨 (`97c22fd`) |
| 프로덕션 빌드 (`npm run build`) | ✅ 통과 |
| 캘린더 3개 탭 동작 | ✅ 로컬 브라우저에서 클릭 검증 완료 |
| Vercel 프로젝트 링크 | ✅ `baby-meal-planner` 생성·링크됨 (`.vercel/`은 gitignore) |
| **Neon DB 프로비저닝** | ⛔ **차단됨 — 사용자의 마켓플레이스 약관 동의 대기** |
| DB 시드 | ⏳ DB 생성 후 실행 필요 |
| Vercel 프로덕션 배포 | ⏳ DB 연결 후 진행 |
| GitHub Pages (v1) 정리 | ⏳ 미처리 |

## 5. ★ 잔여 작업 (이 순서대로)

**전제**: 사용자가 브라우저에서 Neon 약관 동의를 완료해야 함:
https://vercel.com/jaywapp16-2281s-projects/~/integrations/accept-terms/neon?source=cli

동의 확인 후, `D:\aina\ina\babymeal`에서:

```bash
# 1. Neon 설치 재시도 (동의 전이면 action_required JSON이 다시 나옴)
vercel integration add neon
#    → 대화형 프롬프트가 나오면 기본값/무료 플랜 선택, 리전은 가까운 곳(예: ap-southeast-1 또는 iad1)
#    → 설치 후 프로젝트에 연결됐는지 확인: vercel env ls (DATABASE_URL 있어야 함)
#    → 연결 안 됐으면 Vercel 대시보드 Storage 탭에서 baby-meal-planner 프로젝트에 connect

# 2. env 받기 + DB 초기화(스키마+시드, 멱등이라 재실행 안전)
vercel env pull .env.local --yes
npm run init-db          # "DB init complete." 확인

# 3. 로컬 검증 (선택이지만 권장)
npm run dev              # 대시보드에 오늘 식단(참깨 테스트 등) 표시되는지 확인

# 4. 프로덕션 배포 + 검증
vercel --prod
#    → 배포 URL 열어서: 대시보드 데이터 로드, 캘린더 3개 탭, 식단 편집 저장까지 확인

# 5. 낡은 v1 GitHub Pages 비활성화 (v2는 Vercel URL 사용)
gh api repos/jaywapp/baby-meal-planner/pages -X DELETE
```

### 후속(선택) 작업 아이디어
- `vercel git connect`로 GitHub 연동 → main 푸시 시 자동 배포 (현재는 Vercel GitHub App 미설치라 실패함 — 사용자가 https://vercel.com/dashboard 에서 GitHub App 설치 필요. 그 전까지는 `vercel --prod` 수동 배포)
- 식단 자동 생성 기능 (설계 문서의 금지 조합·단백질 규칙 엔진) — v1에서도 "개발 중" 알림만 있었음
- 인증 없음 상태 — URL 아는 사람은 누구나 수정 가능. 가족용이라 일단 공개로 두었으나 필요 시 Basic Auth/미들웨어 추가

## 6. 주의사항 / 함정

- **라이브 DB는 Neon(원격)뿐** — Aina의 `D:\aina\data\aina.db`(SQLite)와는 완전히 별개. 혼동 금지.
  단, Aina 쪽 `hyerim-rules.md`/`meal_plans`와 데이터가 **이중화**됨 — 아직 동기화 없음. 장기적으로 어느 쪽을 SSOT로 할지 사용자와 합의 필요.
- `lib/db.ts`의 `getSql()`은 지연 초기화 — 모듈 최상위에서 `neon()` 호출하면 빌드가 깨짐 (DATABASE_URL 없는 빌드 환경).
- `@neondatabase/serverless`는 HTTP 기반이라 **로컬 일반 Postgres로는 테스트 불가**.
- Neon CLI를 쓸 일이 있으면: Vercel-managed Neon은 Neon API 키 필요 (브라우저 로그인만으로 안 됨).
- 날짜 처리: DB는 `date::text`(YYYY-MM-DD)로 반환, 프론트는 `ymd()` 헬퍼 사용. UTC/로컬 혼용 주의 (`new Date('YYYY-MM-DD' + 'T00:00:00')` 패턴 사용 중).
- 식단 편집에서 재료를 전부 비우고 저장하면 해당 슬롯 **행이 삭제**됨 (의도된 동작).
- 알러지 테스트 "완료" 처리 시 `tested_ingredients`에 카테고리 '기타'로 들어감 — 카테고리 정정은 `/api/ingredients` POST(upsert)로.
- 사용자 전역 규칙: 대화·문서는 한국어, 코드·커밋은 영어(conventional commits), **push는 명시 요청 시에만** (이 레포는 main 직접 푸시가 사용자 지시로 허용됨).
- 실수 지적받으면 `D:\aina\mistakes\{YYYY-MM-DD}.jsonl`에 기록 (Aina 프로젝트 규칙).

## 7. 검증 방법 요약

- 로컬: `D:\aina\.claude\launch.json`의 `babymeal-dev` 설정으로 dev 서버 실행 (autoPort 사용, 3000이 다른 프로세스에 점유돼 있음)
- 캘린더 탭: /calendar에서 주간→일간→월간 클릭, 월간에서 날짜 클릭 시 일간으로 전환되는지
- E2E: 식단 편집 저장 → 새로고침 후 유지 → 다른 기기/브라우저에서도 보이는지 (DB 저장 확인)
