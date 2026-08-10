import { EVOLUTION_LABELS } from './data'
import type { AiResult, CharacterState, GameEvent, Topic } from './types'

const TOPIC_SCORES: Record<Topic, Partial<CharacterState['evolution']['scores']>> = {
  coding: { creator: 10 },
  making: { creator: 8 },
  night: { nightOwl: 16 },
  travel: { explorer: 14 },
  art: { artist: 14 },
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()

export function calculateBond(exp: number) {
  if (exp >= 72) return 4
  if (exp >= 44) return 3
  if (exp >= 18) return 2
  return 1
}

export function applyAiResult(
  state: CharacterState,
  result: AiResult,
  options: { advanceDemoStep?: boolean } = {},
): { state: CharacterState; events: GameEvent[] } {
  const events: GameEvent[] = []
  const next: CharacterState = structuredClone(state)

  next.bondExp = Math.min(100, next.bondExp + 8)

  if (result.memoryCandidate?.save) {
    const incoming = normalize(result.memoryCandidate.text)
    const duplicate = next.memories.some((memory) => {
      const saved = normalize(memory.text)
      return saved === incoming || saved.includes(incoming) || incoming.includes(saved)
    })

    if (!duplicate) {
      next.memories.unshift({
        id: makeId(),
        text: result.memoryCandidate.text,
        tags: result.memoryCandidate.tags,
        importance: result.memoryCandidate.importance,
        createdAt: new Date().toISOString(),
      })
      events.push({
        type: 'memory',
        title: 'MEMORY DISCOVERED',
        detail: result.memoryCandidate.text,
      })
    }
  }

  for (const topic of result.topics) {
    const scores = TOPIC_SCORES[topic]
    for (const [key, value] of Object.entries(scores)) {
      const scoreKey = key as keyof CharacterState['evolution']['scores']
      next.evolution.scores[scoreKey] = Math.min(100, next.evolution.scores[scoreKey] + (value ?? 0))
    }
  }

  if (!next.abilities.includes('memory') && next.memories.length > 0) {
    next.abilities.push('memory')
    events.push({
      type: 'ability',
      title: 'NEW ABILITY',
      detail: 'Memory · Momo can now remember you.',
    })
  }

  const previousLevel = next.bondLevel
  next.bondLevel = calculateBond(next.bondExp)

  if (next.evolution.current === 'normal' && next.evolution.scores.nightOwl >= 30) {
    next.evolution.current = 'nightOwl'
    if (!next.personality.includes(EVOLUTION_LABELS.nightOwl)) {
      next.personality.push(EVOLUTION_LABELS.nightOwl)
    }
    next.mood = 'Wide awake'
    events.push({
      type: 'evolution',
      title: 'MOMO EVOLVED',
      detail: EVOLUTION_LABELS.nightOwl,
    })
  }

  const shouldUnlockQuest = next.evolution.current !== 'normal' || next.bondLevel >= 3
  if (shouldUnlockQuest && !next.abilities.includes('quest')) {
    next.abilities.push('quest')
    events.push({
      type: 'ability',
      title: 'NEW ABILITY UNLOCKED',
      detail: 'Quest Keeper · Real-life tasks become adventures.',
    })
  }

  if (result.questIntent && next.abilities.includes('quest')) {
    const quest = {
      id: makeId(),
      title: result.questIntent.title,
      datetime: result.questIntent.datetime ?? undefined,
      timeLabel: result.questIntent.timeLabel || '오늘',
      completed: false,
      rewardBond: 12,
      rewardDna: 8,
      rewardType: next.evolution.current === 'normal' ? ('creator' as const) : next.evolution.current,
      createdAt: new Date().toISOString(),
    }
    next.quests.unshift(quest)
    events.push({
      type: 'quest',
      title: 'REAL-WORLD QUEST ADDED',
      detail: `${quest.timeLabel} · ${quest.title}`,
    })
  }

  if (previousLevel !== next.bondLevel) {
    next.mood = 'Closer to you'
  }

  if (options.advanceDemoStep !== false) {
    next.demoStep = Math.min(3, next.demoStep + 1)
  }
  return { state: next, events }
}

export function completeQuest(
  state: CharacterState,
  questId: string,
): { state: CharacterState; event: GameEvent | null } {
  const next = structuredClone(state)
  const quest = next.quests.find((item) => item.id === questId)
  if (!quest || quest.completed) return { state, event: null }

  quest.completed = true
  next.bondExp = Math.min(100, next.bondExp + quest.rewardBond)
  next.bondLevel = calculateBond(next.bondExp)
  next.evolution.scores[quest.rewardType] = Math.min(
    100,
    next.evolution.scores[quest.rewardType] + quest.rewardDna,
  )
  next.mood = 'Proud of you'

  if (next.evolution.current === 'normal' && next.evolution.scores.nightOwl >= 30) {
    next.evolution.current = 'nightOwl'
    const trait = EVOLUTION_LABELS.nightOwl
    if (!next.personality.includes(trait)) next.personality.push(trait)
  }

  return {
    state: next,
    event: {
      type: 'reward',
      title: 'DEMO COMPLETE',
      detail: `+${quest.rewardBond} Bond · +${quest.rewardDna} ${EVOLUTION_LABELS[quest.rewardType]} DNA`,
    },
  }
}
