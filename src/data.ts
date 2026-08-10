import type { CharacterState, EvolutionType } from './types'

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
  '오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.',
]

export const FUTURE_ABILITIES = [
  { name: 'Reminder', level: 4 },
  { name: 'Calendar', level: 5 },
  { name: 'Search', level: 6 },
  { name: 'Personal Agent', level: 8 },
]
