export type Screen = 'home' | 'chat' | 'dna' | 'quests'

export type EvolutionType = 'normal' | 'nightOwl' | 'creator' | 'artist' | 'explorer'

export type Topic = 'coding' | 'night' | 'travel' | 'art' | 'making'

export type Ability = 'chat' | 'memory' | 'quest'

export interface Memory {
  id: string
  text: string
  tags: string[]
  importance: number
  createdAt: string
}

export interface Quest {
  id: string
  title: string
  timeLabel: string
  datetime?: string
  completed: boolean
  rewardBond: number
  rewardDna: number
  rewardType: Exclude<EvolutionType, 'normal'>
  createdAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  text: string
  createdAt: string
}

export interface CharacterState {
  name: string
  bornAt: string
  mood: string
  bondLevel: number
  bondExp: number
  personality: string[]
  memories: Memory[]
  evolution: {
    current: EvolutionType
    scores: Record<Exclude<EvolutionType, 'normal'>, number>
  }
  abilities: Ability[]
  quests: Quest[]
  messages: Message[]
  hasStarted: boolean
  demoStep: number
}

export interface AiResult {
  reply: string
  memoryCandidate: {
    save: boolean
    text: string
    tags: string[]
    importance: number
  } | null
  topics: Topic[]
  questIntent: {
    type: 'create_quest'
    title: string
    datetime: string | null
    timeLabel: string
  } | null
}

export interface GameEvent {
  type: 'memory' | 'evolution' | 'ability' | 'quest' | 'reward'
  title: string
  detail: string
}
