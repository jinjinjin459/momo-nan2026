interface Env {
  GEMINI_API_KEY: string
  GEMINI_MODEL?: string
  ALLOWED_ORIGIN?: string
}

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

function cors(origin: string, allowed: string) {
  return {
    'Access-Control-Allow-Origin': allowed === '*' ? '*' : origin === allowed ? origin : allowed,
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin') ?? ''
    const headers = cors(origin, env.ALLOWED_ORIGIN ?? '*')
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    const url = new URL(request.url)
    if (request.method !== 'POST' || url.pathname !== '/api/chat') {
      return Response.json({ error: 'Not found' }, { status: 404, headers })
    }
    try {
      const contentLength = Number(request.headers.get('Content-Length') ?? 0)
      if (contentLength > 32_000) return Response.json({ error: 'Payload too large' }, { status: 413, headers })
      const payload = await request.json() as { message?: unknown }
      if (typeof payload.message !== 'string' || payload.message.length > 1200) {
        return Response.json({ error: 'Invalid message' }, { status: 400, headers })
      }
      const model = env.GEMINI_MODEL ?? 'gemini-3.6-flash'
      const gemini = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: JSON.stringify(payload) }] }],
          generationConfig: {
            responseFormat: { text: { mimeType: 'APPLICATION_JSON', schema: responseSchema } },
            maxOutputTokens: 700,
          },
        }),
      })
      if (!gemini.ok) throw new Error(`Gemini ${gemini.status}`)
      const data = await gemini.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('')
      if (!text) throw new Error('Gemini returned no text')
      return new Response(JSON.stringify(JSON.parse(text)), {
        headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      })
    } catch {
      return Response.json({ error: 'AI service unavailable' }, { status: 502, headers })
    }
  },
}
