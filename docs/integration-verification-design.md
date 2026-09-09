# 브라우저 통합 검증 설계

orchestrator: Codex

Next.js 스킬과 Browser 스킬을 적용한다. 테스트 전용 Node HTTP 서버가 loopback에서 모든 /api 요청을 가로채고 나머지는 기존 production Next request handler로 전달한다. fixture 아기 정보와 빈 목록을 사용하며 저장 성공/실패/지연은 테스트 제어 endpoint로 설정한다. 실제 Neon 연결은 사용하지 않는다.

브라우저는 실제 페이지 링크/버튼/입력만 조작한다. 서버 로그에 개인정보나 시크릿을 남기지 않는다. 발견한 예외/중복 저장 문제만 기존 스타일대로 최소 수정한다. API handler 정확성은 기존 단위 테스트와 분리하고 하네스 성공을 실제 DB 통합 성공으로 보고하지 않는다.

검증 전략: 9개 화면 메뉴 이동, 빈 데이터, Settings/Growth 저장 실패·입력 보존·재시도·재조회, 지연 중 중복 저장 검증. npm test/typecheck/build와 diff 검사를 수행한다.

확정 수정: Growth 저장 진입 직후 ref를 설정해 동일 렌더 내 재진입까지 차단한다. saving 상태는 버튼을 비활성화하고 진행 문구를 표시한다. finally는 실패/성공 모두 ref와 상태를 해제한다. 입력 초기화와 모달 닫기는 성공 이후에만 수행한다.
