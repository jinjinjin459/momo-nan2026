# NAN 2026 사전 과제 최종 제출 체크

마감: **2026년 8월 10일 23:00 (KST)**

프로젝트: **MOMO: Life-Bonded AI**

프로젝트 산출물 확인: **2026년 8월 10일 19:10 KST**

## 제출 링크

```text
웹 플레이: https://jinjinjin459.github.io/momo-nan2026/
AI 장애 대비 강제 Demo Safe: https://jinjinjin459.github.io/momo-nan2026/?demo=1
전체 소스: https://github.com/jinjinjin459/momo-nan2026
플레이 영상 MP4: submission/MOMO_플레이영상_40초.mp4 — 검증 완료
플레이 영상 YouTube: 업로드 후 URL 반영 대기
게임 소개 PDF: submission/MOMO_게임소개및설명서.pdf
AI 활용 기술 PDF: submission/MOMO_AI활용기술문서.pdf
팀원 롤 PDF: 개인 참가 — 제출 대상 아님
```

## 완료된 항목

- [x] 공개 GitHub 저장소에 전체 소스와 커밋 기록을 push했다.
- [x] GitHub Pages를 배포했고 공개 URL에서 HTTP 200을 확인했다.
- [x] 공개 Pages 모바일 뷰포트에서 시작 → 기억 → 진화 → 능력 해금 → 퀘스트 생성 → 완료를 자동 완주했다.
- [x] `npm run build`와 `npm run lint`가 성공했다.
- [x] 공개 서버 프록시를 통해 Gemma 4 26B A4B IT(`gemma-4-26b-a4b-it`) 실호출을 검증했다.
- [x] 공개 Live 전체 흐름을 두 번 연속 실행했고 매회 API 상태 `[200, 200, 200, 200]`을 확인했다.
- [x] 일반 대화·Memory는 전체 Structured Output, Quest 답변은 축소 `{reply}` 스키마와 결정론적 intent parser로 처리한다.
- [x] 일시적 429·5xx와 잘못된 JSON을 최대 3회까지만 재시도한다.
- [x] Live AI 연결 실패 또는 45초 제한 초과 시 Demo Safe로 전환되는 경로를 구현했다.
- [x] 배포 번들·Git 추적 파일에 API 키 패턴이 없음을 검색했다.
- [x] `.env.local`과 테스트 산출물은 Git에서 제외했다.
- [x] 게임 상태는 새로고침 후 유지되며 초기화 버튼으로 삭제할 수 있다.
- [x] 현재 Markdown에서 게임 소개 PDF를 다시 생성하고 제목, 개요, 목표, 조작, 종료 조건, 실행법, 플레이·소스·영상 링크를 확인했다.
- [x] 현재 Markdown에서 AI 기술 PDF를 다시 생성하고 모델명, 전체 System Instruction, JSON Schema, 점수 규칙, 폴백, 도구 활용, 에셋·오픈소스 출처를 확인했다.
- [x] 게임 소개 PDF 5쪽과 AI 기술 PDF 10쪽이 A4이며 한글·표·코드·스크린샷·URL이 정상 렌더링됨을 확인했다.
- [x] 최종 ZIP에 소스 스냅샷, PDF 2개, 40초 MP4와 제출 링크 문서를 포함하고 압축 내부 파일을 검증했다.
- [x] 캐릭터 이미지는 이 프로젝트용 AI 생성 결과이며 타 게임 이미지·영상·사운드를 사용하지 않았다.
- [x] 개인 참가 기준으로 팀원 롤 기술서는 제출 대상이 아니다.
- [x] 네 DNA 성장 트랙과 Night Owl 1종 전용 진화 외형의 구현 범위를 문서에 구분했다.

## 사용자가 제출 전에 해야 하는 외부 작업

- [x] 40초 실제 플레이 MP4를 `submission/`에 추가하고 재생·대표 프레임을 확인했다.
- [x] 영상 규격이 40.000초, H.264, 720×1280, yuv420p, 30fps, 1,200프레임, 2,744,987바이트임을 확인했다.
- [x] 영상에 공개 Live-only 플레이와 Memory·Gemma 4 회상·Quest·Demo Complete·Night Owl DNA가 있으며 malformed 응답이나 Demo fallback이 없음을 확인했다.
- [ ] YouTube에 공개 또는 일부 공개로 업로드하고 링크를 문서/접수 폼에 입력한다.
- [ ] 대화에 노출한 Gemini API 키는 Google AI Studio에서 폐기·재발급한다.
- [ ] 새 키가 필요하면 서버 전용 환경 변수 또는 Worker secret에만 설정한다.
- [ ] 제출 폼의 개인정보 수집·이용 및 저작권 동의를 직접 확인한다.
- [ ] GitHub·Pages·YouTube 링크를 로그아웃 상태에서 열고 최종 제출한다.

공개 기본 URL의 Live AI 전체 흐름과 40초 MP4 파일은 검증을 완료했습니다. YouTube 공개 또는 일부 공개 업로드와 URL 입력만 사용자 작업으로 남아 있습니다. `?demo=1`은 네트워크 장애에 대비해 전체 흐름을 완주할 수 있는 강제 Demo Safe 경로입니다.
