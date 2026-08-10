import { createServer } from 'node:http'

const port = Number(process.env.PORT ?? 8787)
const model = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash'
const keys = (process.env.GEMINI_API_KEYS ?? process.env.GEMINI_API_KEY ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean)
const allowedOrigin = process.env.ALLOWED_ORIGIN ?? 'http://127.0.0.1:4627'
let keyCursor = 0

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

사용자가 밝힌 안정적인 취향, 직업, 습관만 memoryCandidate로 저장한다.
일회성 감정이나 민감정보는 저장하지 않는다.

topics는 발화의 의미에 맞는 항목만 고른다.
허용 항목은 coding, night, travel, art, making이다.

사용자가 할 일을 기억해 달라고 했고 character.abilities에 quest가 있을 때만 questIntent를 만든다.
questIntent.title에는 날짜, 시간, '기억해 줘' 같은 요청 표현을 제거하고 실제 행동만 넣는다.
현재 시간이 제공되면 상대 날짜를 ISO 8601로 해석하되, 불확실하면 datetime은 null로 둔다.

지정된 JSON 스키마 이외의 필드는 만들지 않는다.`

function corsHeaders(origin) {
  const accepted = allowedOrigin === '*' || origin === allowedOrigin ? origin || '*' : allowedOrigin
  return {
    'Access-Control-Allow-Origin': accepted,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 32_000) throw new Error('Payload too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

async function callGemini(payload) {
  if (!keys.length) throw new Error('GEMINI_API_KEY is not configured')
  const attempts = Math.min(keys.length, 3)
  let lastError

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const key = keys[keyCursor++ % keys.length]
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
        generationConfig: {
          responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: jsonSchema } },
          maxOutputTokens: 700,
        },
      }),
    })

    if (response.ok) {
      const data = await response.json()
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
      if (!text) throw new Error('Gemini returned no text')
      return JSON.parse(text)
    }

    const errorText = await response.text()
    lastError = new Error(`Gemini error ${response.status}: ${errorText.slice(0, 600)}`)
    if (![429, 500, 502, 503, 504].includes(response.status)) break
  }
  throw lastError ?? new Error('Gemini request failed')
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin ?? ''
  const headers = corsHeaders(origin)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, headers)
    response.end()
    return
  }
  if (request.method !== 'POST' || request.url !== '/api/chat') {
    response.writeHead(404, { ...headers, 'Content-Type': 'application/json' })
    response.end(JSON.stringify({ error: 'Not found' }))
    return
  }

  try {
    const payload = await readJson(request)
    if (typeof payload.message !== 'string' || payload.message.length > 1200) throw new Error('Invalid message')
    const result = await callGemini(payload)
    response.writeHead(200, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify(result))
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown proxy error')
    response.writeHead(502, { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(JSON.stringify({ error: 'AI service unavailable' }))
  }
})

server.listen(port, '127.0.0.1', () => console.log(`Momo Gemini proxy listening on http://127.0.0.1:${port}`))
