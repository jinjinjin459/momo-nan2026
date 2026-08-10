import { EVOLUTION_LABELS, EVOLUTION_REQUIREMENTS } from './data'
import type { AiResult, CharacterState, EvolutionPath, GameEvent, Topic } from './types'

const TOPIC_SCORES: Record<Topic, Partial<CharacterState['evolution']['scores']>> = {
  coding: { creator: 10 },
  making: { creator: 8 },
  night: { nightOwl: 16 },
  travel: { explorer: 14 },
  art: { artist: 14 },
}

const TOPIC_EVOLUTION: Record<Topic, EvolutionPath> = {
  coding: 'creator',
  making: 'creator',
  night: 'nightOwl',
  travel: 'explorer',
  art: 'artist',
}

const EVOLUTION_MOODS: Record<EvolutionPath, string> = {
  nightOwl: 'Wide awake',
  creator: 'Full of ideas',
  artist: 'Inspired',
  explorer: 'Ready to explore',
}

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const normalize = (value: string) => value.toLocaleLowerCase().replace(/\s+/g, ' ').trim()

export function calculateBond(exp: number) {
  if (exp >= 72) return 4
  if (exp >= 44) return 3
  if (exp >= 18) return 2
  return 1
}

export function getEvolutionProgress(state: CharacterState, type: EvolutionPath) {
  const { bondLevel, dna, signals } = EVOLUTION_REQUIREMENTS
  return {
    bond: {
      current: state.bondLevel,
      required: bondLevel,
      complete: state.bondLevel >= bondLevel,
    },
    dna: {
      current: state.evolution.scores[type],
      required: dna,
      complete: state.evolution.scores[type] >= dna,
    },
    signals: {
      current: state.evolution.signals[type],
      required: signals,
      complete: state.evolution.signals[type] >= signals,
    },
  }
}

function qualifiesForEvolution(state: CharacterState, type: EvolutionPath) {
  const progress = getEvolutionProgress(state, type)
  return progress.bond.complete && progress.dna.complete && progress.signals.complete
}

function unlockEvolutionCandidates(state: CharacterState, events: GameEvent[]) {
  const paths = Object.keys(state.evolution.scores) as EvolutionPath[]
  for (const type of paths) {
    if (state.evolution.unlocked.includes(type) || !qualifiesForEvolution(state, type)) continue
    state.evolution.unlocked.push(type)
    events.push({
      type: 'evolutionReady',
      title: 'EVOLUTION READY',
      detail: `${EVOLUTION_LABELS[type]} 진화 조건을 달성했어요.`,
    })
  }
}

function rewardTypeForResult(result: AiResult, state: CharacterState): EvolutionPath {
  const topicType = result.topics.map((topic) => TOPIC_EVOLUTION[topic])[0]
  if (topicType) return topicType

  const paths = Object.entries(state.evolution.scores) as Array<[EvolutionPath, number]>
  return paths.reduce((best, current) => current[1] > best[1] ? current : best)[0]
}

export function chooseEvolution(
  state: CharacterState,
  type: EvolutionPath,
): { state: CharacterState; event: GameEvent | null } {
  if (state.evolution.current !== 'normal' || !state.evolution.unlocked.includes(type)) {
    return { state, event: null }
  }

  const next = structuredClone(state)
  next.evolution.current = type
  next.mood = EVOLUTION_MOODS[type]
  const trait = EVOLUTION_LABELS[type]
  if (!next.personality.includes(trait)) next.personality.push(trait)

  return {
    state: next,
    event: { type: 'evolution', title: 'MOMO EVOLVED', detail: trait },
  }
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
      const scoreKey = key as EvolutionPath
      next.evolution.scores[scoreKey] = Math.min(100, next.evolution.scores[scoreKey] + (value ?? 0))
    }
  }

  const resonatingPaths = new Set(result.topics.map((topic) => TOPIC_EVOLUTION[topic]))
  for (const type of resonatingPaths) {
    next.evolution.signals[type] = Math.min(99, next.evolution.signals[type] + 1)
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
  unlockEvolutionCandidates(next, events)

  const shouldUnlockQuest = next.evolution.unlocked.length > 0
    || next.evolution.current !== 'normal'
    || next.bondLevel >= 3
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
      rewardType: next.evolution.current === 'normal'
        ? rewardTypeForResult(result, next)
        : next.evolution.current,
      createdAt: new Date().toISOString(),
    }
    next.quests.unshift(quest)
    events.push({
      type: 'quest',
      title: 'REAL-WORLD QUEST ADDED',
      detail: `${quest.timeLabel} · ${quest.title}`,
    })
  }

  if (previousLevel !== next.bondLevel) next.mood = 'Closer to you'

  if (options.advanceDemoStep !== false) {
    next.demoStep = Math.min(5, next.demoStep + 1)
  }
  return { state: next, events }
}

export function completeQuest(
  state: CharacterState,
  questId: string,
): { state: CharacterState; events: GameEvent[] } {
  const next = structuredClone(state)
  const quest = next.quests.find((item) => item.id === questId)
  if (!quest || quest.completed) return { state, events: [] }

  quest.completed = true
  next.bondExp = Math.min(100, next.bondExp + quest.rewardBond)
  next.bondLevel = calculateBond(next.bondExp)
  next.evolution.scores[quest.rewardType] = Math.min(
    100,
    next.evolution.scores[quest.rewardType] + quest.rewardDna,
  )
  next.evolution.signals[quest.rewardType] = Math.min(
    99,
    next.evolution.signals[quest.rewardType] + 1,
  )
  next.mood = 'Proud of you'

  const events: GameEvent[] = [{
    type: 'reward',
    title: 'QUEST COMPLETE',
    detail: `+${quest.rewardBond} Bond · +${quest.rewardDna} ${EVOLUTION_LABELS[quest.rewardType]} DNA`,
  }]
  unlockEvolutionCandidates(next, events)

  return { state: next, events }
}
