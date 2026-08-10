import { describe, expect, it } from 'vitest'
import { INITIAL_STATE } from './data'
import { applyAiResult, chooseEvolution, completeQuest } from './engine'
import type { AiResult, CharacterState, EvolutionPath, Topic } from './types'

const emptyResult = (topics: Topic[] = []): AiResult => ({
  reply: 'ok',
  memoryCandidate: null,
  topics,
  questIntent: null,
})

const freshState = (): CharacterState => structuredClone(INITIAL_STATE)

function grow(state: CharacterState, topics: Topic[]) {
  return applyAiResult(state, emptyResult(topics)).state
}

describe('evolution progression', () => {
  it.each([
    ['nightOwl', 'night'],
    ['creator', 'coding'],
    ['artist', 'art'],
    ['explorer', 'travel'],
  ] as Array<[EvolutionPath, Topic]>)('unlocks %s only after DNA, Bond, and resonance are all met', (path, topic) => {
    let state = freshState()

    state = grow(state, [topic])
    state = grow(state, [topic])
    state = grow(state, [topic])
    expect(state.bondLevel).toBe(2)
    expect(state.evolution.signals[path]).toBe(3)
    expect(state.evolution.unlocked).not.toContain(path)

    state = grow(state, [])
    const finalGrowth = applyAiResult(state, emptyResult([]))
    expect(finalGrowth.state.bondLevel).toBe(3)
    expect(finalGrowth.state.evolution.unlocked).toContain(path)
    expect(finalGrowth.events).toContainEqual(expect.objectContaining({ type: 'evolutionReady' }))
  })

  it('lets the player choose an unlocked form and prevents a second first evolution', () => {
    const state = freshState()
    state.evolution.unlocked = ['creator', 'artist']

    const creator = chooseEvolution(state, 'creator')
    expect(creator.state.evolution.current).toBe('creator')
    expect(creator.event?.type).toBe('evolution')

    const secondChoice = chooseEvolution(creator.state, 'artist')
    expect(secondChoice.state.evolution.current).toBe('creator')
    expect(secondChoice.event).toBeNull()
  })

  it('uses the quest topic for its DNA reward and prevents duplicate completion rewards', () => {
    const state = freshState()
    state.abilities.push('quest')
    const withQuest = applyAiResult(state, {
      ...emptyResult(['art']),
      questIntent: {
        type: 'create_quest',
        title: '스케치 완성하기',
        datetime: null,
        timeLabel: '오늘',
      },
    }).state
    const quest = withQuest.quests[0]
    expect(quest.rewardType).toBe('artist')

    const completed = completeQuest(withQuest, quest.id)
    expect(completed.state.evolution.scores.artist).toBe(withQuest.evolution.scores.artist + 8)
    expect(completed.events[0]?.type).toBe('reward')

    const duplicate = completeQuest(completed.state, quest.id)
    expect(duplicate.events).toEqual([])
    expect(duplicate.state.evolution.scores.artist).toBe(completed.state.evolution.scores.artist)
  })
})
