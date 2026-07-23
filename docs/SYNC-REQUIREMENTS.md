# Aina → BabyMeal(Neon) 데이터 동기화 요청서

작성일: 2026-07-24 | 상태: **1차 구현 완료 (냉장고·성장) / 식단 동기화는 D1(a) 대기**

## 구현 현황 (2026-07-24)
- ✅ **냉장고 재고**: `hyerim-rules.md` 큐브 표 → Neon `fridge_stock` 전량 동기화 (13행 검증)
- ✅ **성장 기록**: `child_records`(몸무게·키) → Neon `growth_records`(+`baby.weight` 최신값) upsert
- ✅ **자동 트리거**: Aina Stop hook(`D:\aina\.claude\settings.json`) → 세션 종료 시 `scripts/sync_to_neon.py --all` 실행. 소스(aina.db·hyerim-rules.md) 미변경 시 Neon 접속 없이 no-op.
- ✅ 멱등·실패 무해(exit 0)·로그(`D:\aina\data\logs\neon-sync.log`) 검증 완료
- ⏳ **식단 동기화 보류**: SQLite `meal_plans`가 낡은 1행뿐이라 지금 full-state 동기화하면 Neon의 정상 시드 식단을 삭제함. **D1(a)로 Aina 식단을 구조화 저장**한 뒤 활성화 예정. 이때까지 `sync_to_neon.py`는 식단을 건드리지 않음.
- 드라이버: `psycopg2-binary` 설치됨. 연결은 `.env.local`의 `DATABASE_URL_UNPOOLED` 사용.

---

작성일: 2026-07-24 | 원 상태: **요청서**
관련 문서: [HANDOVER.md](./HANDOVER.md), `D:\aina\.claude\skills\cube-ops\SKILL.md`, `D:\aina\.claude\skills\mealplan\SKILL.md`

---

## 1. 배경 / 목적

Aina 봇(디스코드·대화형)으로 이유식 정보를 추가/수정/삭제하면, 그 결과가 BabyMeal Planner 웹앱(https://baby-meal-planner-psi.vercel.app)에도 **자동으로 반영**되게 한다.

- 방향: **단방향 (Aina → Neon)**. 사용자가 채택한 방식은 "Aina가 자기 저장소를 먼저 갱신하고, 그 **후속 처리**로 Neon에 동기화".
- Aina 쪽 저장소가 **SSOT(원본)**, Neon은 웹 표시용 **복제본**.
- 웹앱에서의 직접 편집은 이 요청서의 범위 밖(6장 참조).

### ★ UX 기준 (2026-07-24 사용자 확정)
> **"사용자는 아이나에게 말하기만 한다. Aina가 SQLite에 저장하고, Neon 동기화는 알아서 따라온다."**

- 사용자는 동기화를 **의식하지 않는다** — "동기화해줘" 같은 별도 명령이 없어야 한다.
- 따라서 동기화는 **수동 스킬이 아니라, 데이터가 바뀌면 자동으로 실행되는 백그라운드 후속 처리**여야 한다.
- 이 UX 목표가 아래 D1·D3·D4 결정 방향을 강하게 규정한다(9장 참조).

## 2. ⚠️ 핵심 전제 — "SQLite만 동기화"로는 부족함

사용자 요청은 "SQLite 업데이트 → Neon 동기화"였으나, 조사 결과 **Aina의 이유식 데이터는 3개 저장소에 흩어져 있고 그중 하나는 SQLite가 아니다.**

| 데이터 | Aina 원본 위치 | 형식 | Neon 대상 |
|---|---|---|---|
| 일별 식단 | `aina.db` → `meal_plans` | SQLite 행, **자유 텍스트** `description` | `meal_plans` (구조화 JSONB) |
| **큐브 재고** | `data/memory/hyerim-rules.md` | **마크다운 표** (SQLite 아님) | `fridge_stock` |
| 성장 기록 | `aina.db` → `child_records` | SQLite 행 | `growth_records` + `baby` |

**결론**: 큐브 재고까지 동기화하려면 SQLite 트리거만으로는 안 되고, 마크다운 파일 변경도 감지·파싱해야 한다. 이 부분이 이 기능의 가장 큰 난점이다.

## 3. 데이터 매핑 상세 (변환 규칙)

### 3-1. 식단: `meal_plans`(SQLite) → `meal_plans`(Neon)

| Aina 필드 | Neon 필드 | 변환 |
|---|---|---|
| `plan_date` (DATE) | `date` | 그대로 |
| `meal_type` = '아침'/'오전'/'저녁' | `slot` = 'morning'/'evening' | **값 정규화 필요**: '아침'·'오전'→`morning`, '저녁'→`evening` (현재 데이터에 '아침'·'오전' 혼재) |
| `description` (자유 텍스트, 예: `"게 테스트 3일차 - 쌀죽 80g + 게 20g"`) | `ingredients` (JSONB `[{name, amount?, type, test?}]`) | **파싱 난제**: 자유 텍스트를 구조화 재료 배열로 변환해야 함. 정규식/휴리스틱으로는 손실 위험. → **결정 필요 (5장 D1)** |
| — | `note` | `description` 원문을 note에 보존하는 방안 권장 |

### 3-2. 큐브 재고: `hyerim-rules.md` 표 → `fridge_stock`(Neon)

| 마크다운 열 | Neon 필드 | 변환 |
|---|---|---|
| 재료 | `ingredient` | 그대로 |
| 크기 (`20g`) | `size` | 숫자만 추출 → 20 |
| 수량 (`4개`) | `count` | 숫자만 추출 → 4 |
| 제작일 (`2026-07-08`, `-`) | `made_date` | `-`면 NULL |

- Neon `fridge_stock`은 UNIQUE(ingredient, size) upsert. 동기화는 **표 전체를 읽어 Neon을 표 상태로 맞추는 방식(전량 덮어쓰기)**을 권장 (증분보다 안전).

### 3-3. 성장: `child_records`(SQLite) → `growth_records` + `baby`(Neon)

- `record_type='몸무게'` → `growth_records.weight` (+ `baby.weight` 갱신)
- `record_type='머리둘레'` → Neon엔 대응 필드 없음(height만 있음). **키(신장) 기록이 없고 머리둘레만 있음** → 스키마 확장 여부 **결정 필요 (5장 D2)**
- `recorded_at` → `date`

## 4. 요구사항

### 기능 요구사항
- FR-1. Aina에서 식단을 추가/수정/삭제하면 Neon `meal_plans`에 동일 결과가 반영된다.
- FR-2. Aina에서 큐브 재고(차감·추가·보정)를 변경하면 Neon `fridge_stock`에 반영된다.
- FR-3. Aina에서 성장 기록을 추가하면 Neon `growth_records`/`baby`에 반영된다.
- FR-4. 삭제도 반영된다(식단 행 삭제 시 Neon에서도 삭제).
- FR-5. 동기화 실패 시 Aina 원본은 유지되고, 실패가 로그로 남는다(조용한 no-op 금지 — Aina 공통 규칙).

### 비기능 요구사항
- NFR-1. Aina의 기존 SSOT(SQLite/마크다운) 동작을 깨지 않는다. 동기화는 **후속 처리(부가 단계)**로만 붙인다.
- NFR-2. 동기화가 느리거나 실패해도 사용자 응답을 막지 않는다(비동기/베스트에포트 허용).
- NFR-3. `DATABASE_URL` 등 시크릿은 로그·커밋에 노출하지 않는다.
- NFR-4. 재실행해도 안전(멱등). 같은 변경을 두 번 동기화해도 중복/오류가 없어야 한다.

## 5. 미해결 결정사항 (구현 전 사용자·설계 확정 필요)

- **D1. 식단 텍스트 → 구조화 재료 변환 방식**
  - (a) Aina `meal_plans`를 구조화 스키마로 확장(가장 정확, 그러나 mealplan/cube-ops 스킬 대폭 수정)
  - (b) 동기화 시 자유 텍스트를 파싱(스킬 수정 최소, 그러나 파싱 정확도 한계)
  - (c) 과도기: `description` 원문을 Neon `note`에 넣고 `ingredients`는 최선 파싱 → 웹에서 보정
  - **권장: (c)로 시작 → 장기적으로 (a)**

- **D2. 머리둘레/키**: Neon 스키마에 머리둘레 컬럼 추가할지, 아니면 몸무게만 동기화할지.

- **D3. 동기화 연결 방식**:
  - (a) Aina가 Neon에 **직접 연결**(`DATABASE_URL`을 Aina 환경에 추가, Python `psycopg`/HTTP) — 로컬 봇이라 단순, 권장
  - (b) Aina가 웹앱 **REST API 호출**(`PUT /api/meals` 등) — API에 쓰기 인증 필요(현재 인증 없음)
  - **권장: (a)**. 단 Aina는 로컬 세션에서만 동작하므로 클라우드 세션에서는 동기화 스킵됨을 문서화.

- **D4. 트리거 지점**: cube-ops/mealplan 스킬의 "저장 후 공통 체크" 단계에 동기화 호출을 추가하는 방식 vs. 별도 `sync-neon` 스킬/스크립트로 분리. **권장: 공통 유틸 스크립트(`scripts/sync_to_neon.py`) + 각 스킬 말미에서 호출**.

## 6. 범위

**포함**: Aina → Neon 단방향 동기화(식단·큐브재고·성장), 실패 로깅, 멱등성.
**제외**:
- 웹앱 → Aina 역방향 반영(웹 편집은 당분간 Neon에만 남고 Aina로 안 돌아옴 — 별도 요청)
- 실시간(웹소켓) 반영 — 새로고침 시 반영이면 충분
- 인증/접근 제어(HANDOVER 6장의 별도 과제)

## 7. 제안 구현 단계 (확정 후)

1. `DATABASE_URL`을 Aina 환경(`D:\aina\.env` 등)에 추가 + `scripts/sync_to_neon.py` 공통 유틸 작성 (upsert 함수: meal/fridge/growth)
2. **큐브 재고 우선 적용** (형식 명확, 파싱 리스크 낮음): hyerim-rules.md 표 파서 → `fridge_stock` 전량 동기화. cube-ops 스킬 말미에 호출.
3. 성장 기록 동기화(child_records → growth_records).
4. 식단 동기화(D1 결정 반영).
5. 각 단계마다 웹에서 반영 확인(E2E) 후 다음 단계.

## 9. 구현 형태 — "스킬로 만들까?"에 대한 분석

**결론: 동기화를 하나의 스킬로 만드는 것은 부적합.** 스킬은 "Claude에게 주는 지시문"이라 **호출(트리거)돼야** 작동하고, 실행 여부가 Claude가 그 지시를 기억하는지에 달려 있다. 그러나 1장 UX 기준("사용자는 아이나에게 말하기만, 나머지는 알아서")은 **harness가 강제하는 자동 실행**을 요구한다. 이 목표에는 스킬이 아니라 **hook**이 정답이다.

데이터를 성격별로 나눠 형태를 다르게 가져가야 한다:

| 대상 | 성격 | 적합한 형태 |
|---|---|---|
| 큐브 재고 (마크다운 표 파싱 → upsert) | **결정적** — 규칙 명확, 추론 불필요 | **스크립트** (`scripts/sync_to_neon.py`) |
| 성장 기록 (child_records → growth_records) | **결정적** | **스크립트** |
| 식단 자유텍스트 → 구조화 재료 | **LLM 판단 필요** — `"게 테스트 3일차 - 쌀죽 80g + 게 20g"` 같은 문장 해석 | **추론 단계 or 스킬** (또는 D1(a)로 아예 없앰) |

### 권장 아키텍처 (hook + 멱등 스크립트)

"알아서" UX를 실제로 보장하는 조합은 **① 상태 전량 동기화 스크립트 + ② Aina hook**이다.

1. **핵심 = 멱등·전량(full-state) 동기화 스크립트** `scripts/sync_to_neon.py`
   - 하는 일: "현재 SQLite(`meal_plans`, `child_records`)와 마크다운(큐브 재고 표)을 읽어, Neon을 **그 현재 상태와 똑같이** upsert." 증분 diff가 아니라 **현재 상태를 그대로 밀어넣는** 방식.
   - 이렇게 하면 무엇이 바뀌었는지 추적할 필요가 없다 — 언제 돌려도 결과가 같다(멱등). 삭제도 자연 반영(원본에 없으면 Neon에서 제거).
   - 실행 비용이 작다(upsert 수십 건). 매번 전량 실행해도 부담 없음.

2. **자동 트리거 = Aina의 hook** (settings.json)
   - **Stop hook**(세션 종료 시) 또는 이유식 데이터 변경에 대한 **PostToolUse hook**에서 `python scripts/sync_to_neon.py --all` 실행.
   - hook은 Claude의 기억이 아니라 **harness가 강제**하므로, cube-ops·mealplan·즉석 수정 등 **어떤 경로로 데이터가 바뀌어도** 동기화가 빠짐없이 따라온다 → 1장 UX 기준 충족.
   - Stop hook이 가장 단순·견고(무엇이 바뀌었든 세션 끝에 한 번 전량 동기화). 매 세션 실행이 부담되면 "이유식 데이터 변경 시에만" 게이팅 가능하나, 멱등·저비용이라 초기엔 무조건 실행이 안전.

3. **(선택) 수동 재동기화 스킬** `babymeal-sync`
   - 트리거: "웹에 다시 반영해줘". 하는 일: 같은 스크립트 `--all` 호출.
   - hook이 주 경로이므로 **필수 아님**. 장애 복구·수동 점검용 보조 수단.

### ★ 이 UX가 강제하는 전제 — D1은 (a)로 사실상 확정
hook/스크립트는 **LLM이 아니므로 식단 자유텍스트를 구조화 재료로 파싱할 수 없다.** 따라서 "알아서 동기화"를 이루려면 식단이 **Aina에 저장되는 시점에 이미 구조화**돼 있어야 한다.

- **해결**: `mealplan` 스킬은 식단을 확정할 때 **이미 LLM으로 추론 중**이다. 그 시점에 구조화 재료(JSON)를 SQLite에도 함께 저장한다(예: `meal_plans`에 `ingredients_json` 컬럼 추가, 또는 병렬 테이블).
- 그러면 **LLM 파싱은 "작성 시 1회"**로 끝나고, 이후 동기화 스크립트는 구조화 데이터를 **그대로 복사**만 한다. 파싱 정확도 리스크가 사라진다.
- 즉 **D1(a)**(Aina 식단 구조화)가 이 UX의 필수 선행 작업이다. 이것 없이는 웹의 식단 칩이 부정확해진다.

### D3·D4 갱신
- **D3(연결)**: Aina 스크립트가 **Neon에 직접 연결**(`DATABASE_URL`을 Aina 환경에 추가). REST 경유는 인증이 필요해 hook 자동화엔 불리 → 직접 연결 확정 권장.
- **D4(트리거)**: 위 **Aina hook + 전량 스크립트**로 확정. "기존 스킬 말미 호출"은 보조 안전망으로만 둔다. 신규 대형 스킬 하나로 몰지 않는다.

## 8. 참고 — 현재 검증된 사실

- Neon 스키마/upsert 동작: [HANDOVER.md](./HANDOVER.md) 3장.
- Aina DB 접근법: `D:\aina\data\memory\db-access-howto.md` (전체경로 Python + UTF-8).
- Aina 큐브 재고 SSOT는 hyerim-rules.md 표이며 `fridge_items`/`family_memory`는 낡은 잔재(참조 금지) — cube-ops SKILL.md 명시.
