# Aina → Neon 동기화 테스트 요청서

작성일: 2026-07-24 | 대상: `scripts/sync_to_neon.py` + Aina Stop hook
관련: [SYNC-REQUIREMENTS.md](./SYNC-REQUIREMENTS.md)

이 문서는 **다른 사람/세션이 동기화 기능을 직접 검증**할 수 있도록 만든 테스트 케이스 모음이다.
각 케이스는 `전제 → 실행 → 기대결과 → 판정`으로 구성. 판정 컬럼에 ✅/❌를 채운다.

---

## 0. 환경 준비 (사전 점검)

| # | 확인 | 명령 / 방법 | 기대 |
|---|---|---|---|
| 0-1 | psycopg2 설치 | `python -c "import psycopg2"` | 에러 없음 ✅ |
| 0-2 | 연결 문자열 존재 | `.env.local`에 `DATABASE_URL_UNPOOLED` 또는 `DATABASE_URL` | 존재 ✅ |
| 0-3 | Stop hook 등록 | `D:\aina\.claude\settings.json`의 `hooks.Stop` | sync 명령 존재 ✅ |
| 0-4 | 마이그레이션 완료 | `PRAGMA table_info(meal_plans)`에 `ingredients_json` | 컬럼 존재 ✅ |
| 0-5 | 운영 사이트 | https://baby-meal-planner-psi.vercel.app | 200 ✅ |

**공통 실행 명령** (Aina 루트 `D:\aina`에서):
```bash
# 전량 동기화(수동)
python ina/babymeal/scripts/sync_to_neon.py --all
# 변경감지 무시하고 강제
python ina/babymeal/scripts/sync_to_neon.py --all --force
# 실제 반영 없이 미리보기
python ina/babymeal/scripts/sync_to_neon.py --all --dry-run --force
# 특정 도메인만
python ina/babymeal/scripts/sync_to_neon.py --fridge   # --growth / --meals
```
**웹 데이터 조회**: `curl -s "https://baby-meal-planner-psi.vercel.app/api/{fridge|growth|baby}"`,
식단은 `.../api/meals?start=YYYY-MM-DD&end=YYYY-MM-DD`.

---

## 1. 냉장고 재고 (fridge_stock)

| # | 케이스 | 실행 | 기대결과 | 판정 |
|---|---|---|---|---|
| F-1 | 초기 전량 반영 | hyerim-rules.md 큐브 표 그대로 두고 `--fridge --force` | `/api/fridge` 행 수 = 마크다운 표 행 수, 재료·크기·수량·제작일 일치 | ✅ |
| F-2 | 차감 반영 | Aina에 "소고기 2개 먹였어" → 표에서 4→2 수정 후 sync | 웹 소고기 count 2 | ✅ |
| F-3 | 큐브 추가 | "당근 20g 6개 만들었어" → 표 0→6 후 sync | 웹 당근20g count 6 | ✅ |
| F-4 | 재고 삭제 반영 | 표에서 한 행 삭제 후 sync | 웹에서도 그 재료 사라짐(전량 reconcile) | ✅ |
| F-5 | 0개 유지 | 수량 0 행 | 웹에 count 0으로 표시(행 유지) | ✅ |

## 2. 성장 기록 (growth_records / baby.weight)

| # | 케이스 | 실행 | 기대결과 | 판정 |
|---|---|---|---|---|
| G-1 | 기존 기록 반영 | `--growth --force` | `child_records`의 몸무게/키가 `/api/growth`에 날짜별로 존재 | ✅ |
| G-2 | 신규 몸무게 추가 | Aina `child_records`에 오늘 날짜 몸무게 insert 후 sync | 웹 growth에 새 날짜 추가 | ✅ |
| G-3 | **역행 방지** | 과거 날짜 몸무게가 최신보다 작아도 | `/api/baby` weight = **가장 최근 날짜** 기록값 (과거값으로 안 내려감) | ✅ |
| G-4 | 키 병합 | 같은 날짜에 몸무게+키 각각 있으면 | 한 growth 행에 weight·height 모두 | ✅ |
| G-5 | 삭제 안 함 | 원본에 없는 웹 growth 행 | sync가 지우지 않음(성장은 append) | ✅ |

## 3. 식단 (meal_plans) — 핵심

| # | 케이스 | 실행 | 기대결과 | 판정 |
|---|---|---|---|---|
| M-1 | 백필 무손실 | 마이그레이션 후 `--meals --force` | Neon 식단이 마이그레이션 전과 동일(사이클 1~3 유지) + 7/1 추가 | ✅ |
| M-2 | 재료 추가 반영 | Aina 특정 날짜 `ingredients_json`에 재료 1개 추가 후 sync | 웹 해당 끼니에 그 재료 칩 표시 | ✅ |
| M-3 | 재료 삭제 반영 | 같은 날짜에서 재료 제거 후 sync | 웹에서도 사라짐 | ✅ |
| M-4 | 슬롯 삭제 반영 | Aina에서 한 끼(행) 삭제 후 sync (Aina 계획 범위 내) | 웹 해당 끼니 사라짐 | ✅ |
| M-5 | **범위 밖 보호** | Aina 계획 범위(min~max) **밖** 날짜에 웹에서 식단 추가 → 이후 sync | 그 웹 식단이 **삭제되지 않고 유지** | ✅ |
| M-6 | meal_type 매핑 | Aina meal_type '오전'/'아침' | 웹 slot=morning, '저녁'→evening | ✅ |
| M-7 | type 매핑 | ingredients_json의 type(grain/veggie/protein/fruit/test) | 웹 칩 색상·(테스트) 뱃지 정확 | ✅ |
| M-8 | ingredients_json 누락 | 구조화 없이 description만 있는 행 | 웹에 description 기반 단일 칩(etc)로라도 표시, 크래시 없음 | ✅ |

## 4. 자동 트리거 (Stop hook) & 안정성

| # | 케이스 | 실행 | 기대결과 | 판정 |
|---|---|---|---|---|
| H-1 | 무변경 no-op | 소스 변경 없이 hook 명령 재실행 | 출력 없이 exit 0, Neon 접속 안 함(빠름) | ✅ |
| H-2 | 변경 감지 | aina.db 또는 hyerim-rules.md 수정 후 hook 명령 | 실제 sync 수행 + 로그 기록 | ✅ |
| H-3 | **세션 종료 자동 실행** | Aina에서 식단/재고를 실제로 바꾸는 대화 후 세션 종료 | 별도 명령 없이 웹에 반영(hook 자동) | ⚠️ |
| H-4 | 오프라인 무해 | 네트워크 차단/DATABASE_URL 제거 후 hook | `SKIP ...` 로그 + exit 0 (봇 안 막음) | ✅ |
| H-5 | 로그 적재 | `data/logs/neon-sync.log` | 각 실행 타임스탬프+요약 남음 | ✅ |
| H-6 | 멱등성 | `--all --force` 연속 2회 | 두 번째도 결과 동일, 오류 없음 | ✅ |

## 5. 회귀 (기존 Aina 기능 무손상)

| # | 케이스 | 기대결과 | 판정 |
|---|---|---|---|
| R-1 | cube-ops 조회 | "오늘 이유식 뭐야" 정상 응답(ingredients_json 추가가 조회 안 깨뜨림) | ✅ |
| R-2 | mealplan 저장 | 식단 확정 저장 시 description + ingredients_json 둘 다 기록 | ✅* |
| R-3 | 웹 직접 편집 | 웹 SlotEditor로 편집한 값이 Aina 범위 밖이면 유지(M-5와 동일 맥락) | ✅ |

---

## 판정 기준 / 주의

- **위험 케이스는 F-4·M-3·M-4·M-5**(삭제/범위). 특히 M-5는 "웹 전용 데이터가 sync로 지워지지 않는가"를 반드시 확인.
- 테스트로 **실제 SSOT(hyerim-rules.md / aina.db)를 수정했다면 원복**하고 재-sync해 원상태로 되돌린다(이번 구현 중 브로콜리 테스트도 그렇게 원복함).
- 실패 시 `data/logs/neon-sync.log`와 psycopg2 예외 메시지를 첨부해 보고.
- 방향은 단방향(Aina→Neon). 웹→Aina 역방향 반영은 이 테스트 범위 밖(미구현).

## 2026-07-24 실행 결과

- 실행 환경: Windows, Python 3.12, psycopg2 2.9.12
- 백업: `D:\aina\backups\sync-test-20260724-065830`
- 최종 운영 데이터:
  - 냉장고 13행
  - 성장 기록 2행
  - 식단 19행 (`2026-07-01`~`2026-08-01`)
  - `baby.weight` 10kg
- 원복 검증:
  - SQLite 전체 테이블이 테스트 전 백업과 일치
  - Neon `fridge_stock`, `growth_records`, `baby`, `meal_plans`가 테스트 전 스냅샷과 일치
  - `hyerim-rules.md` SHA-256이 테스트 전 백업과 일치
- H-1: 무변경 실행 56ms, 출력 없음, exit 0
- H-3: Stop hook 등록과 동일 명령의 변경 감지 실행은 검증했으나, 이 테스트 세션 안에서는 실제 Claude 세션 종료 이벤트를 관찰할 수 없어 부분 검증(⚠️)으로 남겼다.
- M-4: 계획 범위의 경계 행을 삭제하면 min/max 자체가 이동하므로, 테스트 전제에 맞게 범위를 유지하는 내부 날짜(2026-07-24 오전)로 검증했다.
- M-7: 운영 사이트 DOM에서 `chip-grain`, `chip-veggie`, `chip-protein`, `chip-test`와 `(테스트)` 표시를 확인했다.
- R-2*: Aina가 실제로 사용하는 `D:\aina\.claude\skills\mealplan\SKILL.md`에는 `description`과 `ingredients_json` 동시 저장 규칙이 있어 통과했다. 다만 Codex용 `D:\aina\.agents\skills\mealplan\SKILL.md` 사본에는 `ingredients_json` 규칙이 빠져 있어 동기화 누락 위험이 있었다.
  - **해결(2026-07-24)**: `.agents/skills/`의 mealplan·cube-ops 사본에 `.claude` 원본과 동일한 `ingredients_json` 규칙 반영. 두 사본 모두 원본과 diff 0(완전 일치) 확인. → Codex가 식단을 저장해도 구조화 데이터가 함께 기록되어 동기화 무손실 유지.

## 자동화 여지 (후속)
- 위 케이스 중 F/G/M의 데이터 검증은 `pytest` + 임시 Neon 스키마(또는 트랜잭션 롤백)로 스크립트화 가능. 현재는 수동 체크리스트.
