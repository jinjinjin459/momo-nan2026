import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Dna,
  Home,
  LockKeyhole,
  MessageCircle,
  MoonStar,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'
import { getAiResponse } from './ai'
import {
  DNA_LABELS,
  EVOLUTION_LABELS,
  FUTURE_ABILITIES,
  INITIAL_STATE,
  STORAGE_KEY,
  SUGGESTED_MESSAGES,
} from './data'
import { applyAiResult, completeQuest } from './engine'
import type { CharacterState, GameEvent, Message, Screen } from './types'

const cloneInitialState = (): CharacterState => structuredClone(INITIAL_STATE)

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return cloneInitialState()
    const initial = cloneInitialState()
    const parsed = JSON.parse(saved) as Partial<CharacterState>
    return {
      ...initial,
      ...parsed,
      personality: Array.isArray(parsed.personality) ? parsed.personality : initial.personality,
      memories: Array.isArray(parsed.memories) ? parsed.memories : [],
      abilities: Array.isArray(parsed.abilities) ? parsed.abilities : initial.abilities,
      quests: Array.isArray(parsed.quests) ? parsed.quests : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages : initial.messages,
      evolution: {
        ...initial.evolution,
        ...(parsed.evolution ?? {}),
        scores: {
          ...initial.evolution.scores,
          ...(parsed.evolution?.scores ?? {}),
        },
      },
    }
  } catch {
    return cloneInitialState()
  }
}

const makeMessage = (role: Message['role'], text: string): Message => ({
  id: `${Date.now()}-${role}-${Math.random().toString(36).slice(2, 7)}`,
  role,
  text,
  createdAt: new Date().toISOString(),
})

function CharacterPortrait({ state, compact = false }: { state: CharacterState; compact?: boolean }) {
  const evolved = state.evolution.current === 'nightOwl'
  const src = evolved ? './assets/momo-night-owl.png' : './assets/momo-awake.png'

  return (
    <motion.div
      className={`character-portrait ${compact ? 'compact' : ''} ${evolved ? 'evolved' : ''}`}
      animate={{ y: compact ? [0, -3, 0] : [0, -8, 0], rotate: [0, -0.7, 0.7, 0] }}
      transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <img src={src} alt={`${state.name} ${EVOLUTION_LABELS[state.evolution.current]} 모습`} />
      <div className="portrait-shine" />
    </motion.div>
  )
}

function StartScreen({ onStart }: { onStart: () => void }) {
  return (
    <motion.main className="start-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="stars" aria-hidden="true" />
      <div className="eyebrow"><Sparkles size={14} /> A LIFE-BONDED AI</div>
      <CharacterPortrait state={INITIAL_STATE} />
      <motion.div
        className="start-copy"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
      >
        <p className="micro-label">DIGITAL SEED 01</p>
        <h1>작은 별이<br />당신을 기다리고 있어요.</h1>
        <p>대화하고, 기억을 발견하고,<br />당신만의 AI Companion을 진화시키세요.</p>
      </motion.div>
      <motion.button className="primary-button" onClick={onStart} whileTap={{ scale: 0.97 }}>
        Momo 깨우기 <ChevronRight size={18} />
      </motion.button>
      <p className="start-footnote">게임 상태는 이 브라우저에 저장됩니다. Live AI 사용 시 대화가 Gemini 서버로 전송됩니다.</p>
    </motion.main>
  )
}

function Header({ onReset, aiMode }: { onReset: () => void; aiMode: 'live' | 'demo' | 'ready' }) {
  return (
    <header className="app-header">
      <div>
        <p className="brand-mark">MOMO <span>✦</span></p>
        <p className="brand-sub">LIFEFORM · DAY 1</p>
      </div>
      <div className="header-actions">
        <span className={`mode-pill ${aiMode}`}><span className="live-dot" /> {aiMode === 'live' ? 'Gemini Live' : aiMode === 'ready' ? 'AI Ready' : 'Demo Safe'}</span>
        <button className="icon-button" onClick={onReset} aria-label="내 데이터 삭제 및 데모 초기화" title="내 데이터 삭제 및 데모 초기화">
          <RotateCcw size={16} />
        </button>
      </div>
    </header>
  )
}

function HomeScreen({ state, goChat }: { state: CharacterState; goChat: () => void }) {
  const evolved = state.evolution.current !== 'normal'
  const nextPrompt = SUGGESTED_MESSAGES[Math.min(state.demoStep, SUGGESTED_MESSAGES.length - 1)]
  const bondProgress = state.bondLevel >= 4 ? 100 : state.bondExp % 26

  return (
    <motion.section className="screen home-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="ambient-label"><MoonStar size={14} /> {evolved ? 'NIGHT RESONANCE DETECTED' : 'A NEW SIGNAL IS GROWING'}</div>
      <CharacterPortrait state={state} />
      <div className="character-title">
        <p className="micro-label">{state.mood}</p>
        <h2>{state.name}</h2>
        <span className={`evolution-chip ${evolved ? 'active' : ''}`}>
          <Sparkles size={13} /> {EVOLUTION_LABELS[state.evolution.current]}
        </span>
      </div>

      <div className="speech-card">
        <span className="quote-mark">“</span>
        <p>{evolved ? '너와 계속 늦게까지 이야기하다 보니, 나도 밤이 좋아진 것 같아.' : '아직 너에 대해 잘 모르지만, 네 이야기를 오래 기억하고 싶어.'}</p>
      </div>

      <button className="talk-button" onClick={goChat}>
        <MessageCircle size={20} />
        <span><b>Momo와 이야기하기</b><small>추천: {nextPrompt}</small></span>
        <ChevronRight size={19} />
      </button>

      <div className="bond-card">
        <div className="bond-row">
          <span><Star size={15} fill="currentColor" /> BOND LEVEL</span>
          <strong>Lv.{state.bondLevel}</strong>
        </div>
        <div className="progress-track"><motion.div animate={{ width: `${Math.max(14, bondProgress * 3.5)}%` }} /></div>
        <p>{state.bondLevel < 3 ? '서로를 알아가는 중' : '마음이 깊게 연결되었어요'} · {state.bondExp} XP</p>
      </div>
    </motion.section>
  )
}

function ChatScreen({
  state,
  onSend,
  sending,
  aiMode,
}: {
  state: CharacterState
  onSend: (message: string) => Promise<void>
  sending: boolean
  aiMode: 'live' | 'demo' | 'ready'
}) {
  const [input, setInput] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const suggestion = SUGGESTED_MESSAGES[Math.min(state.demoStep, SUGGESTED_MESSAGES.length - 1)]

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.messages.length, sending])

  const submit = async (event?: FormEvent) => {
    event?.preventDefault()
    const value = input.trim()
    if (!value || sending) return
    setInput('')
    await onSend(value)
  }

  return (
    <section className="screen chat-screen">
      <div className="chat-profile">
        <CharacterPortrait state={state} compact />
        <div><b>{state.name}</b><span><span className="live-dot" /> {aiMode === 'live' ? 'Gemini 3.6 Flash' : 'Resilient Demo AI'}</span></div>
        <span className="bond-mini">Bond {state.bondLevel}</span>
      </div>

      <div className="message-list">
        <div className="day-divider"><span>TODAY · FIRST CONTACT</span></div>
        {state.messages.map((message) => (
          <motion.div
            key={message.id}
            className={`message ${message.role}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {message.role === 'assistant' && <div className="momo-avatar"><Sparkles size={14} /></div>}
            <div className="message-bubble">{message.text}</div>
          </motion.div>
        ))}
        {sending && (
          <div className="message assistant">
            <div className="momo-avatar"><Sparkles size={14} /></div>
            <div className="message-bubble typing"><i /><i /><i /></div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="chat-composer-wrap">
        {aiMode === 'demo' && <p className="demo-notice">안전한 Demo AI가 플레이 흐름을 이어가고 있어요.</p>}
        {!sending && (
          <button className="suggestion-chip" onClick={() => setInput(suggestion)}>
            <Sparkles size={13} /> {suggestion}
          </button>
        )}
        <form className="chat-composer" onSubmit={submit}>
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Momo에게 나를 알려주세요..."
            aria-label="메시지"
          />
          <button type="submit" disabled={!input.trim() || sending} aria-label="전송"><Send size={18} /></button>
        </form>
        <p className="composer-note">대화 속 중요한 기억만 Character DNA에 남아요.</p>
      </div>
    </section>
  )
}

function DnaScreen({ state }: { state: CharacterState }) {
  const scoreEntries = Object.entries(state.evolution.scores) as Array<[
    keyof typeof state.evolution.scores,
    number,
  ]>
  return (
    <motion.section className="screen dna-screen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="section-heading">
        <p className="micro-label">CHARACTER DNA</p>
        <h2>당신이 만든 Momo</h2>
        <p>함께한 말과 행동이 이 생명체의 고유한 흔적이 됩니다.</p>
      </div>

      <div className="dna-identity-card">
        <CharacterPortrait state={state} compact />
        <div>
          <h3>{state.name}</h3>
          <span>{EVOLUTION_LABELS[state.evolution.current]}</span>
          <p>Bond Lv.{state.bondLevel} · {state.memories.length} Memories</p>
        </div>
        <Dna size={24} />
      </div>

      <article className="panel">
        <div className="panel-title"><span>DNA RESONANCE</span><small>Evolution at 30</small></div>
        <div className="score-list">
          {scoreEntries.map(([key, value]) => (
            <div className="score-row" key={key}>
              <div><span>{DNA_LABELS[key]}</span><b>{value}</b></div>
              <div className="score-track"><motion.i animate={{ width: `${value}%` }} /></div>
            </div>
          ))}
        </div>
      </article>

      <article className="panel">
        <div className="panel-title"><span>PERSONALITY</span><small>{state.personality.length} traits</small></div>
        <div className="trait-list">
          {state.personality.map((trait) => <span key={trait}><Sparkles size={12} /> {trait}</span>)}
        </div>
      </article>

      <article className="panel memory-panel">
        <div className="panel-title"><span>MEMORY FRAGMENTS</span><small>{state.memories.length} found</small></div>
        {state.memories.length ? state.memories.map((memory) => (
          <div className="memory-item" key={memory.id}>
            <span className="memory-star"><Star size={14} /></span>
            <div><p>{memory.text}</p><small>{memory.tags.map((tag) => `#${tag}`).join(' ')}</small></div>
          </div>
        )) : (
          <div className="empty-state"><Sparkles size={20} /><p>대화를 나누면 기억 조각이 이곳에 빛나요.</p></div>
        )}
      </article>

      <article className="panel">
        <div className="panel-title"><span>ABILITIES</span><small>Grow to unlock</small></div>
        <div className="ability-grid">
          {['chat', 'memory', 'quest'].map((ability) => {
            const unlocked = state.abilities.includes(ability as 'chat' | 'memory' | 'quest')
            return <div className={unlocked ? 'unlocked' : ''} key={ability}>{unlocked ? <Check size={16} /> : <LockKeyhole size={15} />}<span>{ability === 'quest' ? 'Quest' : ability[0].toUpperCase() + ability.slice(1)}</span></div>
          })}
          {FUTURE_ABILITIES.map((ability) => <div key={ability.name}><LockKeyhole size={15} /><span>{ability.name}</span><small>Lv.{ability.level}</small></div>)}
        </div>
      </article>
    </motion.section>
  )
}

function QuestsScreen({ state, onComplete, goChat }: { state: CharacterState; onComplete: (id: string) => void; goChat: () => void }) {
  const unlocked = state.abilities.includes('quest')
  const open = state.quests.filter((quest) => !quest.completed)
  const done = state.quests.filter((quest) => quest.completed)

  return (
    <motion.section className="screen quests-screen" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="section-heading">
        <p className="micro-label">REAL-WORLD QUESTS</p>
        <h2>Momo와 현실을 모험하세요</h2>
        <p>당신의 할 일이 Momo를 성장시키는 퀘스트가 됩니다.</p>
      </div>

      {!unlocked ? (
        <div className="locked-quest-card">
          <div className="lock-orbit"><LockKeyhole size={28} /></div>
          <p className="micro-label">ABILITY LOCKED</p>
          <h3>Quest Keeper</h3>
          <p>Momo와 대화해 첫 번째 진화를 발견하면<br />현실 퀘스트를 함께할 수 있어요.</p>
          <button className="primary-button compact-button" onClick={goChat}>대화로 성장하기 <ChevronRight size={17} /></button>
        </div>
      ) : (
        <>
          <div className="quest-status-card">
            <div><Trophy size={22} /><span><b>QUEST KEEPER</b><small>Ability active</small></span></div>
            <span>{open.length} active</span>
          </div>
          {open.length === 0 && done.length === 0 ? (
            <div className="empty-quest-card">
              <Clock3 size={27} />
              <h3>첫 현실 퀘스트를 만들어볼까요?</h3>
              <p>“오늘 밤 11시에 발표 자료 만들기 기억해줘”처럼 자연스럽게 말해보세요.</p>
              <button className="primary-button compact-button" onClick={goChat}>Momo에게 말하기 <MessageCircle size={17} /></button>
            </div>
          ) : (
            <div className="quest-list">
              {open.length > 0 && <p className="list-label">TODAY</p>}
              {open.map((quest) => (
                <motion.article className="quest-card" key={quest.id} layout>
                  <button className="quest-check" onClick={() => onComplete(quest.id)} aria-label={`${quest.title} 완료`}><Check size={17} /></button>
                  <div className="quest-main"><span>{quest.timeLabel}</span><h3>{quest.title}</h3><p>+{quest.rewardBond} Bond · +{quest.rewardDna} DNA</p></div>
                  <ChevronRight size={18} />
                </motion.article>
              ))}
              {done.length > 0 && <p className="list-label complete-label">COMPLETED</p>}
              {done.map((quest) => (
                <article className="quest-card completed" key={quest.id}>
                  <span className="quest-check"><Check size={17} /></span>
                  <div className="quest-main"><span>완료</span><h3>{quest.title}</h3><p>Bond와 DNA에 새 흔적이 남았어요.</p></div>
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </motion.section>
  )
}

function BottomNav({ screen, onChange, questCount }: { screen: Screen; onChange: (screen: Screen) => void; questCount: number }) {
  const items = [
    { id: 'home' as const, label: 'Home', icon: Home },
    { id: 'chat' as const, label: 'Talk', icon: MessageCircle },
    { id: 'dna' as const, label: 'DNA', icon: Dna },
    { id: 'quests' as const, label: 'Quests', icon: Star },
  ]
  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button key={item.id} className={screen === item.id ? 'active' : ''} onClick={() => onChange(item.id)}>
            <span><Icon size={20} />{item.id === 'quests' && questCount > 0 && <i>{questCount}</i>}</span>
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function EventOverlay({ event, state, onClose }: { event: GameEvent; state: CharacterState; onClose: () => void }) {
  const isEvolution = event.type === 'evolution'
  const icon = event.type === 'memory' ? <CircleUserRound size={28} /> : event.type === 'quest' ? <Clock3 size={28} /> : event.type === 'reward' ? <Trophy size={28} /> : <Sparkles size={30} />
  return (
    <motion.div className={`event-overlay ${isEvolution ? 'evolution-event' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="event-card" initial={{ scale: 0.82, y: 22 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }}>
        {isEvolution && <p className="event-prelude">SOMETHING CHANGED...</p>}
        {isEvolution ? <CharacterPortrait state={state} /> : <div className="event-icon">{icon}</div>}
        <p className="micro-label">{event.title}</p>
        <h2>{event.detail}</h2>
        <p className="event-copy">
          {event.type === 'memory' && 'Momo의 DNA에 당신의 기억이 새겨졌어요.'}
          {event.type === 'evolution' && '당신과 보낸 시간이 Momo를 새로운 모습으로 변화시켰어요.'}
          {event.type === 'ability' && '관계가 깊어져 Momo가 새로운 방식으로 도울 수 있어요.'}
          {event.type === 'quest' && '완료하면 Bond와 Character DNA가 함께 성장해요.'}
          {event.type === 'reward' && '데모의 핵심 여정을 완주했어요. Momo와의 모험은 계속 이어집니다.'}
        </p>
        <button className="primary-button" onClick={onClose}>{isEvolution ? '새로운 Momo 만나기' : '계속하기'} <ChevronRight size={18} /></button>
      </motion.div>
    </motion.div>
  )
}

function App() {
  const [state, setState] = useState<CharacterState>(loadState)
  const [screen, setScreen] = useState<Screen>('home')
  const [sending, setSending] = useState(false)
  const [events, setEvents] = useState<GameEvent[]>([])
  const [aiMode, setAiMode] = useState<'live' | 'demo' | 'ready'>(
    import.meta.env.VITE_API_BASE_URL && new URLSearchParams(window.location.search).get('demo') !== '1'
      ? 'ready'
      : 'demo',
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const activeQuestCount = useMemo(() => state.quests.filter((quest) => !quest.completed).length, [state.quests])

  const sendMessage = async (text: string) => {
    if (sending) return
    setSending(true)
    const userMessage = makeMessage('user', text)
    const snapshot = { ...state, messages: [...state.messages, userMessage] }
    setState(snapshot)

    const { result, mode } = await getAiResponse(text, snapshot)
    setAiMode(mode)
    const applied = applyAiResult(snapshot, result)
    const assistantMessage = makeMessage('assistant', result.reply)
    setState({ ...applied.state, messages: [...applied.state.messages, assistantMessage] })
    setEvents((current) => [...current, ...applied.events])
    setSending(false)
  }

  const finishQuest = (id: string) => {
    const result = completeQuest(state, id)
    setState(result.state)
    if (result.event) setEvents((current) => [...current, result.event!])
  }

  const resetDemo = () => {
    if (!window.confirm('Momo와의 모든 기억을 지우고 데모를 처음부터 시작할까요?')) return
    localStorage.removeItem(STORAGE_KEY)
    setState(cloneInitialState())
    setScreen('home')
    setEvents([])
  }

  if (!state.hasStarted) {
    return <StartScreen onStart={() => setState((current) => ({ ...current, hasStarted: true }))} />
  }

  return (
    <div className={`app-shell evolution-${state.evolution.current}`}>
      <Header onReset={resetDemo} aiMode={aiMode} />
      <main className="content-shell">
        <motion.div key={screen} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
          {screen === 'home' && <HomeScreen state={state} goChat={() => setScreen('chat')} />}
          {screen === 'chat' && <ChatScreen state={state} onSend={sendMessage} sending={sending} aiMode={aiMode} />}
          {screen === 'dna' && <DnaScreen state={state} />}
          {screen === 'quests' && <QuestsScreen state={state} onComplete={finishQuest} goChat={() => setScreen('chat')} />}
        </motion.div>
      </main>
      <BottomNav screen={screen} onChange={setScreen} questCount={activeQuestCount} />
      <AnimatePresence>
        {events[0] && <EventOverlay event={events[0]} state={state} onClose={() => setEvents((current) => current.slice(1))} />}
      </AnimatePresence>
    </div>
  )
}

export default App
