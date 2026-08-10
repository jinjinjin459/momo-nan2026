# MOMO: Life-Bonded AI

> 키우다 보면, 나를 가장 잘 아는 AI가 된다.

플레이어와의 대화와 현실 퀘스트를 기억하며 성격·외형·능력이 달라지는 AI 생명체 육성 게임입니다. NAN 2026 Game × AI Hackathon 사전 과제용 플레이 가능 프로토타입입니다.

## Play

- 게임: https://jinjinjin459.github.io/momo-nan2026/
- AI 장애 대비 강제 Demo Safe: https://jinjinjin459.github.io/momo-nan2026/?demo=1
- 40초 실제 플레이 MP4: `submission/MOMO_플레이영상_40초.mp4` (검증 완료)
- YouTube: 업로드 후 링크 반영 예정

## Core loop

```text
대화 → Memory 발견 → Character DNA 성장 → 진화
    → Quest Keeper 해금 → 현실 Quest 생성 → 완료 보상
```

심사용 권장 입력:

1. `나는 개발자고 밤에 코딩하는 걸 좋아해.`
2. `오늘도 늦게까지 새로운 걸 만들 거야.`
3. `밤에 집중해서 코딩하면 아이디어가 더 잘 떠올라.`
4. 두 번 더 대화해 Bond Lv.3을 달성합니다.
5. DNA 탭에서 해금된 진화를 직접 선택합니다.
6. `오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.`
7. Quests 탭에서 생성된 퀘스트를 완료합니다.

진화 조건은 `Bond Lv.3 + 해당 DNA 30 + 관련 대화/퀘스트 공명 3회`입니다. 첫 진화 선택, Quest Keeper 해금, 현실 퀘스트 완료 후 `QUEST COMPLETE`가 나타나면 핵심 여정을 완주한 것입니다.

Character DNA는 Night Owl, Creator, Artist, Explorer 네 성장 트랙을 계산하며 네 진화 모두 해금·선택할 수 있습니다. 전용 이미지 외형은 Night Owl에 적용되고, 나머지 형태는 컬러 공명과 성격 라벨로 표현됩니다.

## Screens

| Home | Evolution | Quest |
|---|---|---|
| ![Home](docs/images/home.png) | ![Evolution](docs/images/evolution.png) | ![Quest](docs/images/quest.png) |

## AI architecture

공개 Live AI는 Google Gemini API의 `gemini-3.6-flash`를 호출합니다. 일반 대화와 Memory는 한 번의 전체 Structured Output으로 처리합니다. Quest 요청은 축소된 `{ reply }` 스키마로 Momo의 답변을 만들고, 클라이언트의 결정론적 intent parser가 title과 time을 보완합니다. 실제 DNA 점수·Bond·진화·보상은 항상 `src/engine.ts`의 규칙이 계산합니다.

```text
Browser → Cloudflare Worker → Gemini API / Gemini 3.6 Flash
        ← full structured JSON (Chat / Memory)
        ← { reply } + deterministic intent parser (Quest)
        → deterministic game engine → localStorage
```

API 키는 브라우저 번들에 포함하지 않습니다. Worker는 `GEMINI_API_KEYS` secret의 여러 키를 순환하며 일시적인 429·5xx·타임아웃 또는 잘못된 JSON을 최대 3회 재시도합니다. 각 upstream 시도는 12초, 브라우저 요청은 32초로 제한됩니다. 실패한 답변은 `Offline Fallback`으로 명확히 표시하고 다음 메시지에서 자동 재연결합니다. `?demo=1`은 강제 Demo Safe 경로입니다.

제출용 MP4는 공개 기본 URL의 Live AI만 사용한 실제 플레이를 녹화한 40.000초 영상입니다. H.264, 720×1280, 30fps, 1,200프레임이며 AI 영상 합성이나 Demo fallback 장면을 포함하지 않습니다.

## Run locally

요구사항: Node.js 20.19+ 또는 22.12+

```bash
npm ci
npm run dev
```

Gemini 3.6 Flash Live Mode(Gemini API):

```powershell
Copy-Item .env.example .env.local
# .env.local의 GEMINI_API_KEYS를 쉼표로 구분한 서버 전용 키 묶음으로 설정합니다.
```

첫 번째 터미널:

```bash
npm run ai:server
```

두 번째 터미널:

```bash
npm run dev -- --host 127.0.0.1 --port 4627
```

`GEMINI_API_KEY`를 `VITE_*` 변수에 넣지 마세요. Vite의 `VITE_*` 값은 공개 브라우저 번들에 포함됩니다.

## Verify

```bash
npm run build
npm run lint
npm test
npm run check:play
npm run check:fallback
node scripts/live-ai-check.mjs
node scripts/public-live-check.mjs
```

`check:play`은 Chrome 모바일 뷰포트에서 시작 → 기억 → 복합 진화 조건 → 진화 선택 → 퀘스트 → 완료 보상을 실제로 클릭해 검증합니다. `live-ai-check`는 로컬 프록시의 Gemini 3.6 Flash 응답을 확인합니다. `public-live-check`는 공개 URL에서 기억 회상 → 진화 선택 → Quest 완료 → 새로고침 후 상태 유지와 요청 진단 헤더까지 확인합니다.

## Documentation

- [게임 소개 및 설명 문서](docs/game-introduction.md)
- [AI 활용 기술 문서](docs/ai-technical-document.md)
- [최종 제출 체크리스트](docs/submission-checklist.md)
- PDF 제출본은 `submission/`에 생성됩니다.

## Stack

React 19 · TypeScript 6 · Vite 8 · Framer Motion · Zod · Lucide React · Gemini 3.6 Flash · Gemini API · Cloudflare Workers · Playwright · Vitest

## Data and safety

- 게임 상태·대화·기억·퀘스트는 현재 브라우저 `localStorage`에 저장됩니다.
- Live AI 요청에는 현재 메시지, 캐릭터 상태, 최근 기억 최대 6개가 전달됩니다.
- 프록시는 응답에 `Cache-Control: no-store`를 적용하며 API 키를 클라이언트에 반환하지 않습니다.
- 우측 상단 초기화 버튼으로 브라우저에 저장된 게임 데이터를 삭제할 수 있습니다.

## Assets and licenses

Momo 기본형과 Night Owl 진화형 이미지는 이 프로젝트를 위해 OpenAI ImageGen으로 생성했습니다. 외부 에셋과 오픈소스 출처·라이선스 전체 목록은 [AI 활용 기술 문서](docs/ai-technical-document.md)에 기록되어 있습니다.
