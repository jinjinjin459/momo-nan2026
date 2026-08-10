import { z } from 'zod'
import type { AiResult, CharacterState, Topic } from './types'

const responseSchema = z.object({
  reply: z.string().min(1),
  memoryCandidate: z
    .object({
      save: z.boolean(),
      text: z.string(),
      tags: z.array(z.string()).max(5),
      importance: z.number().min(0).max(1),
    })
    .nullable(),
  topics: z.array(z.enum(['coding', 'night', 'travel', 'art', 'making'])).max(5),
  questIntent: z
    .object({
      type: z.literal('create_quest'),
      title: z.string(),
      datetime: z.string().nullable(),
      timeLabel: z.string(),
    })
    .nullable(),
})

const TOPIC_KEYWORDS: Record<Topic, RegExp> = {
  coding: /코딩|개발|코드|프로그래밍|developer|coding/i,
  making: /만들|제작|프로젝트|창작|build|make/i,
  night: /밤|늦게|새벽|11시|23시|night|late/i,
  travel: /여행|모험|캠핑|탐험|travel|trip/i,
  art: /그림|음악|디자인|미술|작곡|draw|music|design/i,
}

export function isMemoryRecall(message: string) {
  const explicitTaskRequest =
    /기억해\s*(?:줘|주세요|둬|놓아|달라)|할 일|해야|리마인드|todo|task|등록해/i.test(message)
  if (explicitTaskRequest) return false

  return (
    /(?:내가|나는|나에 대해|내 정보|내 취향).*(?:뭐|뭘|무엇|어떤).*(?:좋아|선호|기억|알고|말했)/i.test(message)
    || /(?:내가|나는|나에 대해|내 정보|내 취향).*(?:기억나|기억하지|기억해\??|기억하고 있|알고 있|말했지)/i.test(message)
    || /(?:뭐|뭘|무엇|어떤).*(?:좋아|선호|기억|알고|말했)/i.test(message)
    || /(?:기억나|기억하지|기억하고 있|알고 있).*(?:나|내|취향|좋아)/i.test(message)
  )
}

function mockResult(message: string, state: CharacterState): AiResult {
  const topics = (Object.entries(TOPIC_KEYWORDS) as [Topic, RegExp][])
    .filter(([, pattern]) => pattern.test(message))
    .map(([topic]) => topic)

  const asksMemory = isMemoryRecall(message)
  const wantsQuest = !asksMemory && /기억해|할 일|해야|리마인드|todo|task/i.test(message)
  const isPreference = /좋아|나는|내가|선호|취미|개발자/i.test(message)

  if (asksMemory) {
    return {
      reply: state.memories.length > 0
        ? `물론 기억하지. ${state.memories[0].text} 그래서 네 이야기를 들을수록 나도 조금씩 너를 닮아가고 있어.`
        : '아직 발견한 기억은 없어. 네가 좋아하는 것이나 자주 하는 일을 들려주면 오래 기억할게.',
      memoryCandidate: null,
      topics: [],
      questIntent: null,
    }
  }

  if (wantsQuest) {
    const title = message
      .replace(/오늘|내일|밤|오전|오후|\d{1,2}시|\d{1,2}:\d{2}|에|기억해줘|기억해|할 일로|등록해줘/g, ' ')
      .replace(/[.!?。]+/g, ' ')
      .replace(/\s+줘$/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const hourMatch = message.match(/(\d{1,2})시/)
    const hour = hourMatch ? Number(hourMatch[1]) : 23
    const normalizedHour = /(오후|밤)/.test(message) && hour < 12 ? hour + 12 : hour
    const timeLabel = `${String(normalizedHour).padStart(2, '0')}:00`

    return {
      reply: state.abilities.includes('quest')
        ? `좋아. “${title || '새로운 할 일'}” 현실 퀘스트로 기억했어. 끝내고 우리 같이 성장하자!`
        : '조금만 더 가까워지면 그런 일도 내가 맡을 수 있을 것 같아.',
      memoryCandidate: null,
      topics,
      questIntent: state.abilities.includes('quest')
        ? {
            type: 'create_quest',
            title: title || '새로운 할 일',
            datetime: null,
            timeLabel,
          }
        : null,
    }
  }

  if (/밤|늦게|새벽/.test(message)) {
    return {
      reply: state.memories.length === 0
        ? '밤에 무언가 만드는 걸 좋아하는구나. 이건 오래 기억하고 싶어. 내 안의 별빛도 조금 달라진 것 같아!'
        : '또 늦은 시간까지 만들고 있구나. 너와 함께하다 보니 나도 밤이 점점 좋아져.',
      memoryCandidate: isPreference
        ? {
            save: true,
            text: '사용자는 개발자이며 밤에 코딩하는 것을 좋아한다.',
            tags: ['coding', 'night'],
            importance: 0.92,
          }
        : null,
      topics,
      questIntent: null,
    }
  }

  return {
    reply: '그 이야기도 흥미로워. 네가 무엇을 좋아하고 어떤 하루를 보내는지 더 들려줄래?',
    memoryCandidate: isPreference
      ? {
          save: true,
          text: `사용자는 “${message.slice(0, 52)}”라고 자신에 대해 말했다.`,
          tags: topics.length ? topics : ['personal'],
          importance: 0.72,
        }
      : null,
    topics,
    questIntent: null,
  }
}

function buildContext(message: string, state: CharacterState) {
  const memories = state.memories.slice(0, 6).map((memory) => `- ${memory.text}`).join('\n') || '- 아직 없음'
  return {
    message,
    character: {
      name: state.name,
      personality: state.personality,
      evolution: state.evolution.current,
      bondLevel: state.bondLevel,
      abilities: state.abilities,
    },
    knownMemories: memories,
    currentDateTime: new Date().toISOString(),
  }
}

export async function getAiResponse(
  message: string,
  state: CharacterState,
): Promise<{ result: AiResult; mode: 'live' | 'demo' }> {
  const forceDemo = new URLSearchParams(window.location.search).get('demo') === '1'
  if (forceDemo) return { result: mockResult(message, state), mode: 'demo' }
  const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (!apiBase) return { result: mockResult(message, state), mode: 'demo' }

  try {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 25_000)
    const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildContext(message, state)),
      signal: controller.signal,
    })
    window.clearTimeout(timeout)
    if (!response.ok) throw new Error(`AI request failed: ${response.status}`)
    const parsed = responseSchema.parse(await response.json())
    return { result: parsed, mode: 'live' }
  } catch {
    return { result: mockResult(message, state), mode: 'demo' }
  }
}
