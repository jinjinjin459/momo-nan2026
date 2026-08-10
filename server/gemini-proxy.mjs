import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 8787)
const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'
const keys = (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:4627'
let keyCursor = 0
const MAX_REQUEST_BYTES = 32_000
const MAX_MESSAGE_CHARS = 1_200
const MAX_UPSTREAM_ATTEMPTS = 3
const UPSTREAM_TIMEOUT_MS = 12_000
const ALLOWED_TOPICS = new Set(['coding', 'night', 'travel', 'art', 'making'])

const jsonSchema = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    memoryCandidate: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            save: { type: 'boolean' },
            text: { type: 'string' },
            tags: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            importance: { type: 'number', minimum: 0, maximum: 1 },
          },
          required: ['save', 'text', 'tags', 'importance'],
          additionalProperties: false,
        },
      ],
    },
    topics: {
      type: 'array',
      items: { type: 'string', enum: ['coding', 'night', 'travel', 'art', 'making'] },
      maxItems: 5,
    },
    questIntent: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['create_quest'] },
            title: { type: 'string' },
            datetime: { anyOf: [{ type: 'string' }, { type: 'null' }] },
            timeLabel: { type: 'string' },
          },
          required: ['type', 'title', 'datetime', 'timeLabel'],
          additionalProperties: false,
        },
      ],
    },
  },
  required: ['reply', 'memoryCandidate', 'topics', 'questIntent'],
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

function isOriginAllowed(origin) {
  return !origin || allowedOrigin === '*' || origin === allowedOrigin
}

function corsHeaders(origin) {
  const headers = {
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    Vary: 'Origin',
  }
  if (allowedOrigin === '*') headers['Access-Control-Allow-Origin'] = '*'
  else if (origin === allowedOrigin) headers['Access-Control-Allow-Origin'] = origin
  return headers
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value, maxItems) {
  return Array.isArray(value) && value.length <= maxItems && value.every((item) => typeof item === 'string')
}

function isValidAiResult(value) {
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

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    ...headers,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(body))
}

async function readJson(request) {
  const contentLength = Number(request.headers['content-length'] ?? 0)
  if (contentLength > MAX_REQUEST_BYTES) throw new HttpError(413, 'Payload too large')
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > MAX_REQUEST_BYTES) throw new HttpError(413, 'Payload too large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

async function callGemini(payload) {
  if (!keys.length) throw new Error('GEMINI_API_KEY is not configured')
  let lastError

  for (let attempt = 0; attempt < MAX_UPSTREAM_ATTEMPTS; attempt += 1) {
    const key = keys[keyCursor++ % keys.length]
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)
    let response
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            maxOutputTokens: 700,
          },
        }),
        signal: controller.signal,
      })
    } catch (error) {
      lastError = error instanceof DOMException && error.name === 'AbortError'
        ? new Error('Gemini request timed out')
        : error
      if (attempt + 1 < MAX_UPSTREAM_ATTEMPTS) continue
      throw lastError
    } finally {
      clearTimeout(timeout)
    }

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
      if (!text) throw new Error('Gemini returned no text')
      const result = JSON.parse(text)
      if (!isValidAiResult(result)) throw new Error('Gemini returned invalid structured output')
      return result
    }

    await response.body?.cancel()
    lastError = new Error(`Gemini request failed with status ${response.status}`)
    if (![429, 500, 502, 503, 504].includes(response.status)) break
    await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)))
  }
  throw lastError ?? new Error('Gemini request failed')
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin ?? ''
  if (!isOriginAllowed(origin)) {
    sendJson(response, 403, { error: 'Forbidden' }, { Vary: 'Origin' })
    return
  }
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers)
    response.end()
    return
  }
  const pathname = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
  if (request.method === 'GET' && pathname === '/api/health') {
    const ready = keys.length > 0
    sendJson(response, ready ? 200 : 503, { status: ready ? 'ok' : 'unavailable', model }, headers)
    return
  }
  if (request.method !== 'POST' || pathname !== '/api/chat') {
    sendJson(response, 404, { error: 'Not found' }, headers)
    return
  }

  try {
    const payload = await readJson(request)
    if (!isRecord(payload) || typeof payload.message !== 'string' || payload.message.length > MAX_MESSAGE_CHARS) {
      throw new HttpError(400, 'Invalid message')
    }
    const result = await callGemini(payload)
    sendJson(response, 200, result, headers)
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(response, error.status, { error: error.message }, headers)
      return
    }
    console.error(error instanceof Error ? error.message : 'Unknown proxy error')
    sendJson(response, 502, { error: 'AI service unavailable' }, headers)
  }
})

server.listen(port, '127.0.0.1', () => console.log(`Momo Gemini proxy listening on http://127.0.0.1:${port}`))
