# NAN 2026 사전 과제 최종 제출 체크

마감: **2026년 8월 10일 23:00 (KST)**  
프로젝트: **MOMO: Life-Bonded AI**  
프로젝트 산출물 확인: **2026년 8월 10일 17:21 KST**

## 제출 링크

```text
웹 플레이: https://jinjinjin459.github.io/momo-nan2026/
안정적 심사용 데모: https://jinjinjin459.github.io/momo-nan2026/?demo=1
전체 소스: https://github.com/jinjinjin459/momo-nan2026
플레이 영상: 사용자 직접 촬영·업로드 후 입력
게임 소개 PDF: submission/MOMO_게임소개및설명서.pdf
AI 활용 기술 PDF: submission/MOMO_AI활용기술문서.pdf
팀원 롤 PDF: 개인 참가 — 제출 대상 아님
```

## 완료된 항목

- [x] 공개 GitHub 저장소에 전체 소스와 커밋 기록을 push했다.
- [x] GitHub Pages를 배포했고 공개 URL에서 HTTP 200을 확인했다.
- [x] 공개 Pages 모바일 뷰포트에서 시작 → 기억 → 진화 → 능력 해금 → 퀘스트 생성 → 완료를 자동 완주했다.
- [x] `npm run build`와 `npm run lint`가 성공했다.
- [x] 로컬 서버 프록시를 통해 실제 Gemini 3.6 Flash Structured Output 호출을 검증했다.
- [x] Gemini 연결 실패 시 9초 안에 Demo Safe 모드로 전환되는 경로를 구현했다.
- [x] 배포 번들·Git 추적 파일에 API 키 패턴이 없음을 검색했다.
- [x] `.env.local`과 테스트 산출물은 Git에서 제외했다.
- [x] 게임 상태는 새로고침 후 유지되며 초기화 버튼으로 삭제할 수 있다.
- [x] 게임 소개 PDF의 제목, 개요, 목표, 조작, 종료 조건, 실행법, 플레이·소스 링크를 확인했다.
- [x] AI 기술 PDF의 구조, 전체 System Instruction, JSON Schema, 점수 규칙, 폴백, 도구 활용, 에셋·오픈소스 출처를 확인했다.
- [x] 두 PDF가 A4로 생성되고 한글·표·코드·스크린샷·URL이 렌더링되는지 확인했다.
- [x] 캐릭터 이미지는 이 프로젝트용 AI 생성 결과이며 타 게임 이미지·영상·사운드를 사용하지 않았다.
- [x] 개인 참가 기준으로 팀원 롤 기술서는 제출 대상이 아니다.

## 사용자가 제출 전에 해야 하는 외부 작업

- [ ] 실제 플레이 화면을 30~60초로 녹화한다.
- [ ] YouTube에 공개 또는 일부 공개로 업로드하고 링크를 문서/접수 폼에 입력한다.
- [ ] 대화에 노출한 Gemini API 키는 Google AI Studio에서 폐기·재발급한다.
- [ ] 새 키가 필요하면 서버 전용 환경 변수 또는 Worker secret에만 설정한다.
- [ ] 제출 폼의 개인정보 수집·이용 및 저작권 동의를 직접 확인한다.
- [ ] GitHub·Pages·YouTube 링크를 로그아웃 상태에서 열고 최종 제출한다.

영상은 사용자 요청에 따라 이번 자동 산출물 범위에서 제외했습니다. 공개 GitHub Pages는 심사 안정성을 위해 키가 필요 없는 `Demo Safe` 경로로 완주 가능하며, 실제 Gemini 호출 코드는 서버 프록시/Cloudflare Worker 형태로 저장소에 포함되어 있습니다.
