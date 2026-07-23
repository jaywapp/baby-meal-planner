# BabyMeal Planner 🍼

이나의 이유식 식단·알러지 테스트·냉장고 큐브·성장 기록을 관리하는 웹앱.

## 스택

- **Next.js** (App Router, TypeScript) — 프론트 + API 라우트
- **Neon Postgres** (Vercel Marketplace) — 데이터 저장
- **Vercel** — 호스팅

## 개발

```bash
npm install
vercel env pull .env.local   # DATABASE_URL 받기
npm run init-db              # 스키마 생성 + 초기 데이터 시드 (멱등)
npm run dev
```

## 배포

```bash
vercel --prod
```

## 구조

- `app/` — 페이지 (대시보드, 식단 캘린더(주간/일간/월간), 알러지, 냉장고, 재료, 성장, 영양, 장보기, 설정)
- `app/api/` — REST API (baby, meals, fridge, allergy, growth, ingredients)
- `scripts/init-db.mjs` — DB 스키마 + 시드
- `docs/` — 이유식 규칙 등 설계 문서는 `D:\aina\docs\superpowers\specs\2026-07-23-babymeal-planner-design.md` 참조
