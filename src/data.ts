import type { CharacterState, EvolutionPath, EvolutionType } from './types'

export const STORAGE_KEY = 'momo-nan2026-state-v1'

export const EVOLUTION_LABELS: Record<EvolutionType, string> = {
  normal: 'Newborn Spark',
  nightOwl: 'Night Owl',
  creator: 'Creator',
  artist: 'Artist',
  explorer: 'Explorer',
}

export const DNA_LABELS = {
  nightOwl: 'Night Owl',
  creator: 'Creator',
  artist: 'Artist',
  explorer: 'Explorer',
} as const

export const EVOLUTION_REQUIREMENTS = {
  bondLevel: 3,
  dna: 30,
  signals: 3,
} as const

export const EVOLUTION_DESCRIPTIONS: Record<EvolutionPath, string> = {
  nightOwl: '밤의 시간과 깊게 공명한 야행성 동반자',
  creator: '아이디어를 현실로 만드는 창작 동반자',
  artist: '감정과 아름다움을 발견하는 예술 동반자',
  explorer: '새로운 장소와 경험을 찾는 탐험 동반자',
}

export const INITIAL_STATE: CharacterState = {
  name: 'Momo',
  bornAt: new Date().toISOString(),
  mood: 'Curious',
  bondLevel: 1,
  bondExp: 4,
  personality: ['Curious', 'Gentle'],
  memories: [],
  evolution: {
    current: 'normal',
    scores: {
      nightOwl: 0,
      creator: 0,
      artist: 0,
      explorer: 0,
    },
    signals: {
      nightOwl: 0,
      creator: 0,
      artist: 0,
      explorer: 0,
    },
    unlocked: [],
  },
  abilities: ['chat'],
  quests: [],
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      text: '안녕! 나는 Momo야. 아직 너에 대해 아무것도 모르지만, 함께한 순간들을 하나씩 기억하고 싶어.',
      createdAt: new Date().toISOString(),
    },
  ],
  hasStarted: false,
  demoStep: 0,
}

export const SUGGESTED_MESSAGES = [
  '나는 개발자고 밤에 코딩하는 걸 좋아해.',
  '오늘도 늦게까지 새로운 걸 만들 거야.',
  '밤에 집중해서 코딩하면 아이디어가 더 잘 떠올라.',
  '오늘 하루도 같이 이야기해서 좋다.',
  '우리 조금 더 가까워진 것 같아.',
  '오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.',
]

export const FUTURE_ABILITIES = [
  { name: 'Reminder', level: 4 },
  { name: 'Calendar', level: 5 },
  { name: 'Search', level: 6 },
  { name: 'Personal Agent', level: 8 },
]
