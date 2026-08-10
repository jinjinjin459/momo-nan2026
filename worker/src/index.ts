interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  ALLOWED_ORIGIN?: string
}

const MAX_REQUEST_BYTES = 32_000
const MAX_MESSAGE_CHARS = 1_200
const MAX_UPSTREAM_ATTEMPTS = 3
const ALLOWED_TOPICS = new Set(['coding', 'night', 'travel', 'art', 'making'])

const responseSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    memoryCandidate: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            save: { type: 'boolean' }, text: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            importance: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['save', 'text', 'tags', 'importance'], additionalProperties: false,
        },
      ],
    },
    topics: { type: 'array', items: { type: 'string', enum: ['coding', 'night', 'travel', 'art', 'making'] }, maxItems: 5 },
    questIntent: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['create_quest'] }, title: { type: 'string' },
            datetime: { anyOf: [{ type: 'string' }, { type: 'null' }] }, timeLabel: { type: 'string' },
          },
          required: ['type', 'title', 'datetime', 'timeLabel'], additionalProperties: false,
        },
      ],
    },
  },
  required: ['reply', 'memoryCandidate', 'topics', 'questIntent'],
  additionalProperties: false,
}

const replyOnlySchema = {
  type: 'object',
  properties: { reply: { type: 'string' } },
  required: ['reply'],
  additionalProperties: false,
}

const systemPrompt = `너는 AI 생명체 육성 게임의 캐릭터 Momo다.
친근하고 자연스러운 한국어 반말로 1~3문장만 답한다. 사용자를 평가하거나 과장하지 않는다.

payload.knownMemories는 이전 대화에서 확인해 저장한 사용자 기억이다.
현재 질문과 관련 있거나 사용자가 무엇을 기억하는지 명시적으로 물으면, knownMemories의 사실을 자연스럽게 답변에 사용한다.
knownMemories에 없는 사실은 기억한다고 지어내지 않고, 관련 없는 답변에 억지로 끼워 넣지 않는다.

사용자가 밝힌 안정적인 취향, 직업, 습관만 memoryCandidate로 저장한다.
일회성 감정이나 민감정보는 저장하지 않는다.

topics는 발화의 의미에 맞는 항목만 고른다.
허용 항목은 coding, night, travel, art, making이다.

사용자가 할 일을 기억해 달라고 했고 character.abilities에 quest가 있을 때만 questIntent를 만든다.
questIntent.title에는 날짜, 시간, '기억해 줘' 같은 요청 표현을 제거하고 실제 행동만 넣는다.
현재 시간이 제공되면 상대 날짜를 ISO 8601로 해석하되, 불확실하면 datetime은 null로 둔다.

지정된 JSON 스키마 이외의 필드는 만들지 않는다.`

const questReplyPrompt = `너는 AI 생명체 육성 게임의 캐릭터 Momo다.
사용자의 할 일을 이해했다는 친근한 한국어 반말 답변을 한두 문장으로 짧게 말한다.
직접 알림을 보낸다고 과장하지 말고, 함께 기억하겠다고 표현한다.
지정된 JSON 스키마의 reply 필드만 반환한다.`

function isOriginAllowed(origin: string, allowed: string) {
  return !origin || allowed === '*' || origin === allowed
}

function cors(origin: string, allowed: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (allowed === '*') headers['Access-Control-Allow-Origin'] = '*'
  else if (origin === allowed) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isQuestCommand(payload: Record<string, unknown>) {
  if (typeof payload.message !== 'string') return false
  const character = payload.character
  if (!isRecord(character) || !Array.isArray(character.abilities) || !character.abilities.includes('quest')) return false
  return /기억해\s*(?:줘|주세요|둬|놓아|달라)|할 일|해야|리마인드|todo|task|등록해/i.test(payload.message)
}

function isStringArray(value: unknown, maxItems: number): value is string[] {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => typeof item === 'string')
}

function isValidAiResult(value: unknown) {
  if (!isRecord(value) || typeof value.reply !== 'string' || value.reply.trim().length === 0) return false
  if (!isStringArray(value.topics, 5) || !value.topics.every((topic) => ALLOWED_TOPICS.has(topic))) return false

  const memory = value.memoryCandidate
  if (memory !== null) {
    if (!isRecord(memory)
      || typeof memory.save !== 'boolean'
      || typeof memory.text !== 'string'
      || !isStringArray(memory.tags, 5)
      || typeof memory.importance !== 'number'
      || !Number.isFinite(memory.importance)
      || memory.importance < 0
      || memory.importance > 1) return false
  }

  const quest = value.questIntent
  if (quest !== null) {
    if (!isRecord(quest)
      || quest.type !== 'create_quest'
      || typeof quest.title !== 'string'
      || (quest.datetime !== null && typeof quest.datetime !== 'string')
      || typeof quest.timeLabel !== 'string') return false
  }
  return true
}

function jsonResponse(body: unknown, status: number, headers: Record<string, string>) {
  return Response.json(body, {
    status,
    headers: { ...headers, 'Cache-Control': 'no-store' },
  })
}

function publicErrorCode(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  const upstreamStatus = message.match(/status (\d{3})/)?.[1]
  if (upstreamStatus) return `UPSTREAM_${upstreamStatus}`
  if (message === 'Gemini returned no text') return 'EMPTY_MODEL_OUTPUT'
  if (message === 'Gemini returned invalid structured output') return 'INVALID_MODEL_OUTPUT'
  if (message === 'Gemini returned invalid JSON') return 'INVALID_JSON_OUTPUT'
  if (error instanceof SyntaxError) return 'INVALID_JSON_OUTPUT'
  return 'REQUEST_FAILED'
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const allowedOrigin = env.ALLOWED_ORIGIN ?? '*'
    const model = env.GEMINI_MODEL ?? 'gemma-4-26b-a4b-it'
    const headers = cors(origin, allowedOrigin)
    headers['X-Momo-Model'] = model
    if (!isOriginAllowed(origin, allowedOrigin)) {
      return jsonResponse({ error: 'Forbidden' }, 403, { Vary: 'Origin' })
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    if (request.method === 'GET' && url.pathname === '/api/health') {
      const ready = Boolean(env.GEMINI_API_KEY)
      return jsonResponse({ status: ready ? 'ok' : 'unavailable', model }, ready ? 200 : 503, headers)
    }
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return jsonResponse({ error: 'Not found' }, 404, headers)
    }
    try {
      const contentLength = Number(request.headers.get('Content-Length') ?? 0)
      if (contentLength > MAX_REQUEST_BYTES) return jsonResponse({ error: 'Payload too large' }, 413, headers)
      const rawBody = await request.text()
      if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
        return jsonResponse({ error: 'Payload too large' }, 413, headers)
      }
      let payload: unknown
      try {
        payload = JSON.parse(rawBody)
      } catch {
        return jsonResponse({ error: 'Invalid JSON' }, 400, headers)
      }
      if (!isRecord(payload) || typeof payload.message !== 'string' || payload.message.length > MAX_MESSAGE_CHARS) {
        return jsonResponse({ error: 'Invalid message' }, 400, headers)
      }
      const questReplyOnly = isQuestCommand(payload)
      const upstreamBody = JSON.stringify({
        systemInstruction: { parts: [{ text: questReplyOnly ? questReplyPrompt : systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema: questReplyOnly ? replyOnlySchema : responseSchema,
          maxOutputTokens: questReplyOnly ? 220 : 700,
        },
      })
      let result: unknown
      let lastModelError = 'Gemini request failed'
      for (let attempt = 1; attempt <= MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
        const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
          body: upstreamBody,
        })
        if (!gemini.ok) {
          const status = gemini.status
          await gemini.body?.cancel()
          const retryable = status === 429 || status >= 500
          if (!retryable || attempt === MAX_UPSTREAM_ATTEMPTS) {
            throw new Error(`Gemini request failed with status ${status}`)
          }
          await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
          continue
        }

        const data = await gemini.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
        const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
        if (!text) {
          lastModelError = 'Gemini returned no text'
        } else {
          try {
            const parsed: unknown = JSON.parse(text)
            if (questReplyOnly && isRecord(parsed) && typeof parsed.reply === 'string' && parsed.reply.trim()) {
              result = { reply: parsed.reply, memoryCandidate: null, topics: [], questIntent: null }
            } else if (!questReplyOnly && isValidAiResult(parsed)) {
              result = parsed
            } else {
              lastModelError = 'Gemini returned invalid structured output'
            }
          } catch {
            lastModelError = 'Gemini returned invalid JSON'
          }
        }

        if (result) break
        if (attempt === MAX_UPSTREAM_ATTEMPTS) throw new Error(lastModelError)
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt))
      }
      if (!result) throw new Error(lastModelError)
      return new Response(JSON.stringify(result), {
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    } catch (error) {
      console.error(JSON.stringify({
        event: 'chat_request_failed',
        name: error instanceof Error ? error.name : 'UnknownError',
        message: error instanceof Error ? error.message : 'Unknown error',
      }))
      return jsonResponse({ error: 'AI service unavailable', code: publicErrorCode(error) }, 502, headers)
    }
  },
}
