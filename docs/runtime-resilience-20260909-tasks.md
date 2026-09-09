# 작업 계획

## 검증 결과 (2026-09-09)

- API 7개 경로에 JSON·날짜·숫자·상태·중첩 입력 검증, 실패 응답 및 추적 ID 로그를 추가했다. DB 실패를 성공으로 숨기지 않는다.
- 화면 조회·저장 요청 예외를 처리한다. 월 범위의 훅 의존성을 연·월로 좁혀 같은 달 이동의 중복 조회를 제거하고 영양 통계를 한 번 순회한다.
- `tests/runtime.test.mjs`: 정상 SQL 매개변수, 빈 값, 삭제, 잘못된 JSON·ID·날짜·입력, DB·네트워크 실패, 집계 순서·중복 계약 등 33개 통과.
- `npm test`, `npm run typecheck` 부모 재실행 통과. `npm run build` 프로덕션 빌드 통과. Next.js·React 스킬로 요청 처리와 훅 의존성을 검토했다.
- DB는 대역을 사용했다. 기존 서비스에 인증 기능이 없어 인증 정책을 새로 만들지 않았다. 실제 DB·전체 브라우저 E2E는 미검증이며 모든 코드 경로의 테스트 완료를 뜻하지 않는다.

orchestrator: Codex

| 작업 | owner | model | effort | depends_on | parallel_group | files | verification | status |
|---|---|---|---|---|---|---|---|---|
| 소스 및 경계 조사 | Codex | gpt-6-astra | high | 없음 | web-repos | 소스·기존 테스트 | 기존 동작 근거 확인 | completed |
| 확인된 개선 및 회귀 테스트 | Codex | gpt-6-astra | high | 조사 | web-repos | 아래 기록 | 기존 및 새 테스트 실행 | completed |
| 전체 기능 통합 검증 | Codex | gpt-6-astra | high | 확인된 개선 및 회귀 테스트 | web-repos | 저장소 전체 | 실제 DB·브라우저 검증 미실행 | not_completed |

저장소 간 작업은 루트의 Codex 에이전트와 병렬 수행한다. 이 담당 그룹은 추가 슬롯이 없어 순차 처리하며 같은 소스의 구현과 회귀 검증도 의존성이 있어 순차 진행한다.
