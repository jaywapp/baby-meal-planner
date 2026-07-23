# BabyMeal Planner — 인수인계서 2

작성일: 2026-07-24  
대상 프로젝트: `D:\aina\ina\babymeal`  
운영 URL: https://baby-meal-planner-psi.vercel.app

이 문서는 `docs/HANDOVER.md`의 잔여 작업을 이어서 수행한 결과를 기록한다. 다음 작업자는 기존 인수인계서와 이 문서를 함께 읽어야 한다.

---

## 1. 이번 작업의 목표

기존 인수인계서에 남아 있던 다음 작업을 완료하는 것이 목표였다.

1. Vercel Marketplace의 Neon 약관 동의 확인
2. Neon Postgres 프로비저닝 및 Vercel 프로젝트 연결
3. DB 스키마와 초기 데이터 시드
4. Vercel 프로덕션 배포
5. 실제 브라우저 기반 E2E 검증
6. 기존 GitHub Pages v1 비활성화
7. 검증 중 발견된 오류 수정

## 2. 완료한 작업

### Neon DB

- Vercel Marketplace 약관 동의 후 Neon 설치를 재시도했다.
- 생성된 리소스: `neon-indigo-mountain`
- Vercel 프로젝트 `baby-meal-planner`에 연결했다.
- 다음 환경 모두에 Neon 환경변수가 자동 구성된 것을 확인했다.
  - Development
  - Preview
  - Production
- 앱에서 사용하는 `DATABASE_URL`이 포함된 것을 확인했다.
- 실제 환경변수 값은 출력하거나 문서에 기록하지 않았다.
- 로컬에는 `.env.local`이 생성됐으며 `.gitignore`의 `.env*` 규칙으로 Git 추적에서 제외했다.

### DB 초기화

다음 명령을 실행했다.

```powershell
npm run init-db
```

결과:

```text
Seeding baby / growth / fridge...
Seeding allergy tests...
Seeding tested ingredients...
Seeding meal plans (cycles 1-3)...
DB init complete.
```

생성·시드된 주요 데이터:

- 아기 정보와 성장 기록
- 냉장고 큐브 재고
- 알러지 테스트 큐
- 먹어본 재료
- 식단 사이클 1~3

### Vercel 프로젝트 설정 및 배포

첫 프로덕션 배포는 다음 오류로 실패했다.

```text
No Output Directory named "public" found after the Build completed.
```

원인:

- Vercel 프로젝트의 프레임워크가 지정되지 않았다.
- Vercel이 프로젝트를 일반 정적 프로젝트로 취급해 `public` 출력 디렉터리를 기대했다.

해결:

- Vercel 프로젝트의 프레임워크를 `nextjs`로 설정했다.
- `outputDirectory`는 별도로 지정하지 않았다.
- 이후 프로덕션 배포가 성공했다.

현재 운영 URL:

```text
https://baby-meal-planner-psi.vercel.app
```

최종 확인한 배포:

```text
Deployment ID: dpl_9jj2imPA5Fpe4nmvnLC8GPszcd1V
State: READY
Target: production
Framework: Next.js
```

## 3. 검증 중 발견하고 수정한 오류

### 캘린더 hydration 오류

프로덕션 `/calendar` 접속 시 다음 React 오류가 브라우저 콘솔에 발생했다.

```text
Minified React error #418
```

원인:

- `app/calendar/page.tsx`가 `useState(new Date())`로 초기 날짜를 렌더링했다.
- 캘린더 페이지는 정적으로 생성되므로 빌드 시점의 날짜가 HTML에 포함됐다.
- 실제 접속 시점의 브라우저 날짜와 정적 HTML의 날짜가 다르면 서버 HTML과 첫 클라이언트 렌더가 불일치했다.
- 서버와 브라우저의 시간대 차이뿐 아니라 배포 다음 날 접속할 때도 재현될 수 있는 구조였다.

수정:

- 초기 `anchor` 값을 `null`로 변경했다.
- 서버 HTML과 첫 클라이언트 렌더에서는 고정된 로딩 화면을 표시한다.
- 클라이언트 마운트 후 `useEffect`에서 현재 날짜를 설정한다.
- 날짜가 준비된 후 식단 조회 범위를 계산하고 API를 호출한다.

수정 파일:

```text
app/calendar/page.tsx
```

관련 로컬 커밋:

```text
38a9719 fix: stabilize calendar hydration
```

## 4. 프로덕션 검증 결과

### 대시보드

다음을 실제 운영 URL에서 확인했다.

- 아기 정보 표시
- 오늘 오전·저녁 식단 표시
- 참깨 알러지 테스트 진행 상태 표시
- 냉장고 재고 표시
- 최근 성장 기록 표시
- 브라우저 콘솔 오류 없음

### 캘린더

다음을 실제 브라우저에서 확인했다.

- 주간 보기 표시
- 일간 탭 전환
- 월간 탭 전환
- 월간에서 7월 24일 선택
- 선택 후 일간 보기로 전환
- 오전·저녁 식단과 메모 표시
- 수정 후 hydration 오류 없음

### UI → API → Neon 저장 흐름

기존 2026-07-24 오전 식단을 편집 화면에서 내용 변경 없이 다시 저장했다.

검증 순서:

1. 오전 식단 편집 모달 열기
2. 기존 재료와 메모가 채워져 있는지 확인
3. 내용을 변경하지 않고 저장
4. 페이지 새로고침
5. Neon에서 같은 식단이 다시 조회되는지 확인

재조회된 내용:

- 쌀 75g
- 참깨 테스트
- 단호박
- 오트밀
- 양파
- 메모: `사이클 1 · 참깨 테스트`

저장 전후 데이터 내용은 동일하다.

### 오류 확인

- 최종 브라우저 콘솔 오류·경고: 없음
- Vercel 최근 1시간 런타임 오류: 없음
- 로컬 `npm run build`: 통과
- Vercel 프로덕션 빌드: 통과

## 5. GitHub Pages 정리

비활성화 전 확인한 대상:

```text
Repository: jaywapp/baby-meal-planner
URL: https://jaywapp.github.io/baby-meal-planner/
Source: main /
Status: built
```

기존 v1 GitHub Pages를 비활성화했다.

비활성화 후 Pages API가 HTTP 404를 반환하는 것을 확인했다. 현재 운영 서비스는 Vercel v2만 사용한다.

## 6. 현재 Git 상태

현재 브랜치:

```text
fix/calendar-hydration
```

현재 주요 커밋:

```text
38a9719 fix: stabilize calendar hydration
```

`38a9719`에 포함된 파일:

- `.gitignore`
- `app/calendar/page.tsx`
- `docs/HANDOVER.md`

주의:

- Vercel 배포는 위 변경 내용을 포함한 로컬 작업 트리에서 실행했다.
- 그 후 동일한 내용을 `38a9719`로 로컬 커밋했다.
- 브랜치는 아직 원격에 push하지 않았다.
- PR도 만들지 않았다.
- 명시적인 사용자 요청 전에는 push하지 않는다.

## 7. 다음 작업

### 필수

1. 현재 브랜치의 변경사항과 커밋을 검토한다.
2. 사용자 요청을 받은 후에만 `fix/calendar-hydration`을 push한다.
3. PR을 생성해 `main`에 병합한다.
4. 병합 후 Vercel 운영 URL이 계속 정상인지 확인한다.

### 선택

- Vercel GitHub App을 설치하고 Git 기반 자동 배포 연결
- 접근 제한 또는 인증 추가
- Aina SQLite와 BabyMeal Neon 중 장기 SSOT 결정
- 두 저장소 사이의 동기화 정책 설계
- 이유식 식단 자동 생성 규칙 엔진 구현

## 8. 운영 주의사항

- 라이브 BabyMeal 데이터는 Neon Postgres에 있다.
- `D:\aina\data\aina.db`는 Aina 비서의 별도 SQLite DB이며 BabyMeal DB가 아니다.
- `.env.local`이나 실제 DB 연결 문자열을 커밋·출력하지 않는다.
- Vercel 프로젝트의 프레임워크 설정을 `nextjs`에서 제거하지 않는다.
- `outputDirectory`를 `public`으로 설정하지 않는다.
- 캘린더 초기 날짜를 렌더 단계에서 다시 `new Date()`로 고정하지 않는다. 정적 HTML과 접속 시점이 달라져 hydration 오류가 재발할 수 있다.
- 기존 GitHub Pages는 비활성화됐으므로 다시 활성화하지 않는 한 Vercel URL을 공식 운영 주소로 사용한다.

## 9. 롤백

### 캘린더 코드 롤백

`38a9719`의 변경을 되돌려야 한다면 별도 브랜치에서 revert한다. 다만 기존 구현으로 돌아가면 날짜가 바뀔 때 hydration 오류가 재발할 수 있다.

### Vercel 배포 롤백

Vercel 대시보드나 CLI에서 이전 정상 배포를 지정해 롤백할 수 있다.

```powershell
vercel rollback <deployment-url-or-id>
```

### GitHub Pages

기존 Pages v1은 비활성화됐다. 복구가 꼭 필요할 때만 GitHub 저장소의 Pages 설정에서 `main` 루트를 다시 연결한다.
