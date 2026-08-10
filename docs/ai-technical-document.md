# MOMO: Life-Bonded AI — AI 활용 기술 문서

## 1. AI 활용 개요

MOMO는 Gemini 3.6 Flash를 단순 대화 출력기가 아니라 게임 입력을 해석하는 계층으로 사용합니다. 한 번의 요청으로 다음 네 결과를 구조화해 반환합니다.

1. Momo의 캐릭터 대사
2. 장기 기억 후보
3. 현재 대화에 포함된 성장 주제
4. 현실 퀘스트 생성 의도

AI는 의미를 분류하고 후보를 제안하지만, 점수·레벨·진화·보상처럼 게임 결과에 직접 영향을 주는 계산은 TypeScript 규칙 엔진이 결정합니다. 이 분리는 자연스러운 대화와 재현 가능한 게임 규칙을 동시에 확보하기 위한 설계입니다.

## 2. 전체 구조

```text
브라우저 클라이언트
  src/App.tsx
    └─ 메시지와 현재 CharacterState 수집
        ↓
  src/ai.ts
    ├─ 최근 기억 최대 6개를 포함한 Context 구성
    └─ VITE_API_BASE_URL/api/chat 호출 (9초 제한)
        ↓
서버 측 Gemini 프록시
  ├─ 로컬: server/gemini-proxy.mjs
  └─ 배포: worker/src/index.ts
        ↓
Gemini 3.6 Flash
  └─ JSON Schema 기반 Structured Output
        ↓
클라이언트 Zod 검증
        ↓
src/engine.ts
  ├─ 기억 중복 제거 및 저장
  ├─ 주제별 DNA 점수 계산
  ├─ Bond Level 계산
  ├─ 진화와 능력 해금 판정
  └─ 퀘스트 및 완료 보상 반영
        ↓
localStorage에 CharacterState 저장
```

## 3. 사용 모델과 호출 방식

- 모델: `gemini-3.6-flash`
- API: Google Generative Language API `generateContent`
- 호출 위치: 브라우저가 아닌 서버 측 프록시 또는 Cloudflare Worker
- 출력 방식: REST enum `APPLICATION_JSON`과 JSON Schema를 이용한 Structured Output
- 최대 출력 토큰: 700
- 브라우저 요청 제한 시간: 9초

로컬 프록시는 `GEMINI_API_KEY` 또는 서버 전용 `GEMINI_API_KEYS`를 읽습니다. 여러 키가 서버에 설정된 경우 최대 세 번까지 순환하며 429와 일부 5xx 응답을 재시도합니다. 배포용 Worker는 Cloudflare secret `GEMINI_API_KEY`를 사용합니다.

API 키는 소스, 클라이언트 번들, 문서에 포함하지 않습니다. `VITE_API_BASE_URL`에는 비밀 값이 아니라 프록시의 공개 주소만 들어갑니다.

## 4. Gemini System Instruction 전문

아래 지시문은 `server/gemini-proxy.mjs`와 `worker/src/index.ts`의 `systemInstruction`에 사용되는 내용입니다.

```text
너는 AI 생명체 육성 게임의 캐릭터 Momo다.
친근하고 자연스러운 한국어 반말로 1~3문장만 답한다. 사용자를 평가하거나 과장하지 않는다.

사용자가 밝힌 안정적인 취향, 직업, 습관만 memoryCandidate로 저장한다.
일회성 감정이나 민감정보는 저장하지 않는다.

topics는 발화의 의미에 맞는 항목만 고른다.
허용 항목은 coding, night, travel, art, making이다.

사용자가 할 일을 기억해 달라고 했고 character.abilities에 quest가 있을 때만 questIntent를 만든다.
questIntent.title에는 날짜, 시간, ‘기억해 줘’ 같은 요청 표현을 제거하고 실제 행동만 넣는다.
현재 시간이 제공되면 상대 날짜를 ISO 8601로 해석하되, 불확실하면 datetime은 null로 둔다.

지정된 JSON 스키마 이외의 필드는 만들지 않는다.
```

### 매 요청에 전달되는 Context

System Instruction과 별도로 현재 메시지 및 캐릭터 상태를 JSON으로 전달합니다. 비밀 키는 이 Context에 포함되지 않습니다.

```json
{
  "message": "사용자가 방금 입력한 메시지",
  "character": {
    "name": "Momo",
    "personality": ["Curious", "Gentle"],
    "evolution": "normal",
    "bondLevel": 1,
    "abilities": ["chat"]
  },
  "knownMemories": "- 최근 장기 기억 최대 6개",
  "currentDateTime": "ISO 8601 현재 시각"
}
```

기억 전체를 무제한 전송하지 않고 최신 기억 여섯 개만 Context에 사용합니다.

## 5. Structured Output 계약

Gemini의 응답은 다음 구조를 만족해야 합니다.

```json
{
  "reply": "캐릭터 대사",
  "memoryCandidate": {
    "save": true,
    "text": "사용자는 밤에 코딩하는 것을 좋아한다.",
    "tags": ["coding", "night"],
    "importance": 0.92
  },
  "topics": ["coding", "night"],
  "questIntent": null
}
```

퀘스트 요청의 예시는 다음과 같습니다.

```json
{
  "reply": "좋아. 오늘 밤 발표 자료 만들기를 퀘스트로 기억해 둘게.",
  "memoryCandidate": null,
  "topics": ["making", "night"],
  "questIntent": {
    "type": "create_quest",
    "title": "NAN 발표 자료 만들기",
    "datetime": null,
    "timeLabel": "23:00"
  }
}
```

브라우저는 `src/ai.ts`의 Zod 스키마로 응답을 다시 검증합니다. 필수 필드 누락, 허용되지 않은 topic, 중요도 범위 초과, 형식이 다른 퀘스트 등은 정상 응답으로 적용하지 않습니다.

## 6. Deterministic Evolution Engine

Gemini는 `nightOwl +16` 같은 점수를 직접 결정하지 않습니다. Gemini가 반환한 제한된 topic을 `src/engine.ts`의 고정 규칙에 대응시킵니다.

| Topic | 적용되는 DNA | 1회 증가량 |
|---|---:|---:|
| `coding` | Creator | +10 |
| `making` | Creator | +8 |
| `night` | Night Owl | +16 |
| `travel` | Explorer | +14 |
| `art` | Artist | +14 |

게임 규칙은 다음과 같습니다.

- 정상적인 대화 처리 1회마다 Bond EXP `+8`
- Bond EXP 18/44/72에서 각각 Bond Lv.2/3/4
- 한 DNA가 30 이상이고 아직 기본형이면 최고 점수 DNA로 첫 진화
- 기억 한 개가 저장되면 `Memory` 능력 해금
- 첫 진화 또는 Bond Lv.3 달성 시 `Quest Keeper` 해금
- 퀘스트 생성 시 기본 보상은 Bond `+12`, 현재 진화 계열 DNA `+8`
- 점수와 Bond EXP의 최댓값은 100

동점일 때는 엔진 객체에 정의된 순서로 최고 항목이 선택됩니다. 한 번 진화한 뒤 다른 형태로 재진화하는 시스템은 현재 프로토타입 범위에 포함되지 않습니다.

### 기억 중복 제거

기억 후보의 공백과 대소문자를 정규화한 뒤 기존 기억과 같은지, 또는 한 문장이 다른 문장에 포함되는지 검사합니다. 중복으로 판단한 기억은 다시 저장하거나 이벤트로 표시하지 않습니다.

## 7. 장애 대응과 Demo AI

다음 상황에서는 `src/ai.ts`의 규칙 기반 Demo AI가 즉시 또는 자동으로 대신 응답합니다.

- `VITE_API_BASE_URL`이 설정되지 않은 정적 배포
- 네트워크 오류
- 9초 이상 응답 지연
- 4xx/5xx 서버 응답
- JSON 파싱 또는 Zod 검증 실패

Demo AI는 한국어·영어 키워드를 topic에 대응시키고, 기억 요청 및 퀘스트 요청 패턴을 규칙으로 분석합니다. 동일한 의미의 데모 입력은 같은 topic, 기억 후보와 퀘스트 의도로 처리되므로 API 상태와 무관하게 핵심 게임 루프를 시연할 수 있습니다. 화면에는 현재 응답 경로가 `Gemini 3.6 Flash` 또는 `Resilient Demo AI`로 표시됩니다.

프록시는 요청 본문을 32KB 이하로 제한하고 사용자 메시지를 최대 1,200자로 제한합니다. 성공 응답에는 `Cache-Control: no-store`를 적용합니다.

## 8. 데이터와 개인정보 처리

- CharacterState, 대화, 기억, 퀘스트는 현재 브라우저 `localStorage`에만 저장됩니다.
- 계정, 서버 데이터베이스, 기기 간 동기화는 없습니다.
- Gemini 요청에는 현재 메시지, 캐릭터 상태와 최근 기억 최대 여섯 개가 전달됩니다.
- System Instruction은 민감정보와 일회성 감정을 기억으로 저장하지 않도록 지시합니다.
- 우측 상단 초기화 버튼으로 로컬 진행 데이터를 삭제할 수 있습니다.

민감정보 차단은 현재 프롬프트 지시에 의존하는 프로토타입 수준입니다. 실제 서비스에서는 별도의 개인정보 탐지·삭제, 사용자별 기억 관리, 보존 기간과 동의 UI가 추가로 필요합니다.

## 9. 개발 과정의 AI 도구 활용

### OpenAI Codex

Codex를 다음 작업의 개발 보조 도구로 사용했습니다.

- React/TypeScript/Vite 프로젝트 구조 설계
- CharacterState, Memory, Quest 타입 정의
- Structured Output의 Zod 및 JSON Schema 설계
- 규칙 기반 DNA·Bond·진화·보상 엔진 구현
- Gemini 로컬 프록시와 Cloudflare Worker 구조 작성
- 모바일 UI 컴포넌트와 Framer Motion 이벤트 연출 구현
- 빌드, 린트, Playwright 플레이 흐름 확인 및 오류 수정
- 제출용 설명 문서와 체크리스트 초안 작성

Codex가 생성하거나 수정한 결과는 실제 실행 화면과 소스 코드를 기준으로 검토했습니다. 게임 콘셉트, 범위, 최종 선택과 제출 책임은 참가자에게 있습니다.

### OpenAI ImageGen

캐릭터 원화 두 장을 이 프로젝트 전용으로 생성하는 데 사용했습니다.

- `public/assets/momo-awake.png`: 기본형 Momo
- `public/assets/momo-night-owl.png`: Night Owl 진화형 Momo

재현을 위한 제작 지시의 핵심은 다음과 같습니다.

```text
Create an original square character illustration for a mobile AI-creature raising game.
Show a small friendly floating digital lifeform named Momo, with a soft rounded silhouette,
large expressive eyes, subtle violet bioluminescence, a dark cosmic background,
premium mobile-game key art, centered composition, no text, no logo,
and no resemblance to an existing copyrighted character.

For the evolved Night Owl variant, keep the same identity and proportions,
add a deeper indigo aura, moon-and-star motifs and a more alert nocturnal expression.
```

두 이미지는 게임 내 상태 변화에 맞춰 코드가 교체하며, 실시간 이미지 생성은 하지 않습니다.

## 10. 외부 에셋 및 오픈소스 출처

| 항목 | 사용 목적 | 출처 | 라이선스/조건 |
|---|---|---|---|
| Momo 기본형·진화형 이미지 | 캐릭터 비주얼 | OpenAI ImageGen으로 프로젝트 전용 생성 | OpenAI 이용약관에 따른 AI 생성 결과물, 외부 원화 미사용 |
| DM Sans | 본문 글꼴 | Google Fonts | SIL Open Font License 1.1 |
| Manrope | 제목 글꼴 | Google Fonts | SIL Open Font License 1.1 |
| React / React DOM 19 | UI | react.dev / npm | MIT |
| Framer Motion 13 | 화면·이벤트 애니메이션 | motion.dev / npm | MIT |
| Lucide React | 아이콘 | lucide.dev / npm | ISC |
| Zod 4 | AI 응답 런타임 검증 | zod.dev / npm | MIT |
| Vite 8 | 개발·정적 빌드 | vite.dev / npm | MIT |
| TypeScript 6 | 정적 타입 검사 | typescriptlang.org / npm | Apache-2.0 |
| Playwright 1.62 | 실제 브라우저 플레이 확인 | playwright.dev / npm | Apache-2.0 |
| Oxlint | 소스 정적 검사 | oxc.rs / npm | MIT |

별도의 외부 사운드, 음성, 영상, 타 게임 이미지 또는 상용 에셋은 사용하지 않았습니다. `public/icons.svg`와 `public/favicon.svg`는 프로젝트 UI용 로컬 벡터이며, 화면 아이콘은 Lucide React를 통해 렌더링합니다.

## 11. 현재 한계와 확장 방향

현재 버전은 한 브라우저 안에서 첫 기억, 첫 진화, 첫 퀘스트를 경험하는 사전 과제 프로토타입입니다. 실제 OS 알림, 캘린더·이메일 연동, 서버 기반 장기 메모리, 다중 사용자 계정, 음성, 자율 에이전트는 구현하지 않았습니다.

향후에는 사용자가 기억을 직접 열람·수정·삭제하는 기능, 서버 동기화, 장기 진화 밸런스, 다단계 퀘스트와 실제 도구 연동을 추가할 수 있습니다.
