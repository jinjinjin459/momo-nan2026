# MOMO: Life-Bonded AI

> 키우다 보면, 나를 가장 잘 아는 AI가 된다.

플레이어와의 대화와 현실 퀘스트를 기억하며 성격·외형·능력이 달라지는 AI 생명체 육성 게임입니다. NAN 2026 Game × AI Hackathon 사전 과제용 플레이 가능 프로토타입입니다.

## Play

- 게임: https://jinjinjin459.github.io/momo-nan2026/
- AI 장애 대비 강제 Demo Safe: https://jinjinjin459.github.io/momo-nan2026/?demo=1
- 40초 실제 플레이 영상: MP4 및 YouTube 링크 반영 예정

## Core loop

```text
대화 → Memory 발견 → Character DNA 성장 → 진화
    → Quest Keeper 해금 → 현실 Quest 생성 → 완료 보상
```

심사용 권장 입력:

1. `나는 개발자고 밤에 코딩하는 걸 좋아해.`
2. `오늘도 늦게까지 새로운 걸 만들 거야.`
3. `오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.`
4. Quests 탭에서 생성된 퀘스트를 완료합니다.

첫 진화, Quest Keeper 해금, 첫 현실 퀘스트 완료 후 `DEMO COMPLETE`가 나타나면 프로토타입의 핵심 여정을 완주한 것입니다.

Character DNA는 Night Owl, Creator, Artist, Explorer 네 성장 트랙을 계산합니다. 이 제출 빌드에서 전용 외형까지 구현된 핵심 진화는 **Night Owl 1종**이며, 나머지 트랙은 DNA 점수와 성격 라벨로 표현됩니다.

## Screens

| Home | Evolution | Quest |
|---|---|---|
| ![Home](docs/images/home.png) | ![Evolution](docs/images/evolution.png) | ![Quest](docs/images/quest.png) |

## AI architecture

Live AI 경로는 Google Gemini API의 공식 모델 Gemma 4 26B A4B IT(`gemma-4-26b-a4b-it`)를 호출하도록 구성되어 있습니다. 한 번의 Structured Output으로 캐릭터 답변, 기억 후보, 성장 주제, 퀘스트 의도를 반환하도록 설계했으며, 모델은 의미만 분류하고 실제 DNA 점수·Bond·진화·보상은 `src/engine.ts`의 결정론적 규칙이 계산합니다.

```text
Browser → server-side proxy / Cloudflare Worker → Gemini API / Gemma 4 26B A4B IT
        ← schema-validated JSON ←
        → deterministic game engine → localStorage
```

API 키는 브라우저 번들에 포함하지 않습니다. Live endpoint가 설정된 빌드에서는 서버 측 프록시를 통해 Gemma 4를 호출합니다. endpoint가 없거나 9초 내 응답하지 않으면 화면에 `Demo Safe`를 표시하고 규칙 기반 Demo AI가 전체 게임 루프를 이어갑니다. `?demo=1`은 심사 중 네트워크 장애에 대비한 강제 폴백 경로입니다.

## Run locally

요구사항: Node.js 20.19+ 또는 22.12+

```bash
npm ci
npm run dev
```

Gemma 4 Live Mode(Gemini API):

```powershell
Copy-Item .env.example .env.local
# .env.local의 GEMINI_API_KEY를 서버 전용 키로 설정합니다.
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
npm run check:play
node scripts/live-ai-check.mjs
```

`check:play`은 Chrome 모바일 뷰포트에서 시작 → 기억 → 진화 → 능력 해금 → 퀘스트 → 완료 보상을 실제로 클릭해 검증합니다. `live-ai-check`는 로컬 프록시가 실행 중일 때 Gemma 4 응답과 기억/점수 반영을 검증합니다.

## Documentation

- [게임 소개 및 설명 문서](docs/game-introduction.md)
- [AI 활용 기술 문서](docs/ai-technical-document.md)
- [최종 제출 체크리스트](docs/submission-checklist.md)
- PDF 제출본은 `submission/`에 생성됩니다.

## Stack

React 19 · TypeScript 6 · Vite 8 · Framer Motion · Zod · Lucide React · Gemma 4 26B A4B IT · Gemini API · Cloudflare Workers · Playwright

## Data and safety

- 게임 상태·대화·기억·퀘스트는 현재 브라우저 `localStorage`에 저장됩니다.
- Live AI 요청에는 현재 메시지, 캐릭터 상태, 최근 기억 최대 6개가 전달됩니다.
- 프록시는 응답에 `Cache-Control: no-store`를 적용하며 API 키를 클라이언트에 반환하지 않습니다.
- 우측 상단 초기화 버튼으로 브라우저에 저장된 게임 데이터를 삭제할 수 있습니다.

## Assets and licenses

Momo 기본형과 Night Owl 진화형 이미지는 이 프로젝트를 위해 OpenAI ImageGen으로 생성했습니다. 외부 에셋과 오픈소스 출처·라이선스 전체 목록은 [AI 활용 기술 문서](docs/ai-technical-document.md)에 기록되어 있습니다.
