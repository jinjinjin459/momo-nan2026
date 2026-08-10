import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const playUrl = process.env.MOMO_PLAY_URL
if (!playUrl) throw new Error('MOMO_PLAY_URL is required')

const outputDir = fileURLToPath(new URL('../artifacts/public-live-check/', import.meta.url))
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const apiResponses = []
const failedRequests = []
const requestDiagnostics = []
page.on('response', (response) => {
  if (!response.url().endsWith('/api/chat')) return
  apiResponses.push(response.status())
  requestDiagnostics.push({
    status: response.status(),
    attempts: response.headers()['x-momo-attempts'] ?? null,
    timing: response.headers()['server-timing'] ?? null,
    requestId: response.headers()['x-momo-request-id'] ?? null,
  })
})
page.on('requestfailed', (request) => {
  if (request.url().endsWith('/api/chat')) failedRequests.push(request.failure()?.errorText ?? 'unknown failure')
})

const dismissEvents = async () => {
  const titles = []
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const overlay = page.locator('.event-overlay')
    if (!await overlay.isVisible().catch(() => false)) break
    const title = await page.locator('.event-card .micro-label').textContent({ timeout: 1_500 }).catch(() => null)
    if (!title) {
      await page.waitForTimeout(250)
      continue
    }
    titles.push(title.trim())
    await page.locator('.event-card .primary-button').click({ timeout: 2_000 })
    await page.waitForTimeout(200)
  }
  return titles
}

const send = async (message) => {
  await page.getByRole('textbox', { name: '메시지' }).fill(message)
  await page.getByRole('button', { name: '전송' }).click()
  await page.locator('.typing').waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {})
  await page.locator('.typing').waitFor({ state: 'hidden', timeout: 40_000 })
  return dismissEvents()
}

try {
  await page.goto(playUrl, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Momo 깨우기/ }).click()
  await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()

  const firstEvents = await send('나는 개발자고 밤에 코딩하는 걸 좋아해.')
  await page.getByText('Gemini 3.6 Flash').waitFor({ timeout: 3_000 })
  if (!firstEvents.includes('MEMORY DISCOVERED')) throw new Error('Live memory event was not created')

  await send('내가 좋아한다고 말한 활동과 시간대를 기억해?')
  const recallReply = await page.locator('.message.assistant .message-bubble').last().textContent()
  if (!/코딩|개발|밤|야간/.test(recallReply ?? '')) throw new Error(`Memory recall was not grounded: ${recallReply}`)

  await send('오늘도 늦게까지 새로운 것을 만들 거야.')
  await send('밤에 집중해서 코딩하면 아이디어가 더 잘 떠올라.')
  const growthEvents = await send('오늘 하루도 같이 이야기해서 좋다.')
  if (!growthEvents.includes('EVOLUTION READY')) throw new Error('Evolution choice was not unlocked')
  if (!growthEvents.includes('NEW ABILITY UNLOCKED')) throw new Error('Quest ability was not unlocked')

  await page.getByRole('button', { name: 'DNA' }).click()
  await page.getByRole('button', { name: /Night Owl로 진화하기/ }).click()
  await page.getByText('MOMO EVOLVED').waitFor({ timeout: 3_000 })
  await dismissEvents()
  await page.getByRole('button', { name: 'Talk' }).click()

  const questEvents = await send('오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.')
  if (!questEvents.includes('REAL-WORLD QUEST ADDED')) throw new Error('Quest event was not shown')
  await page.getByRole('button', { name: 'Quests' }).click()
  await page.locator('.quest-check').first().click()
  await page.getByText('QUEST COMPLETE').waitFor({ timeout: 3_000 })
  await page.screenshot({ path: `${outputDir}complete.png`, fullPage: false })
  await dismissEvents()

  const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  await page.reload({ waitUntil: 'networkidle' })
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  if (afterReload.evolution?.current !== 'nightOwl' || !afterReload.quests?.[0]?.completed || afterReload.memories?.length < 1) {
    throw new Error('Core progress did not survive reload')
  }
  if (!beforeReload.quests?.[0]?.completed) throw new Error('Quest was not completed')
  if (apiResponses.length < 6 || apiResponses.some((status) => status !== 200)) {
    throw new Error(`Expected six successful live API calls, got ${JSON.stringify(apiResponses)}`)
  }
  if (failedRequests.length) throw new Error(`Live requests failed: ${JSON.stringify(failedRequests)}`)

  console.log(JSON.stringify({
    playUrl,
    apiResponses,
    requestDiagnostics,
    recallReply,
    evolution: afterReload.evolution.current,
    unlocked: afterReload.evolution.unlocked,
    quest: {
      title: afterReload.quests[0].title,
      timeLabel: afterReload.quests[0].timeLabel,
      completed: afterReload.quests[0].completed,
    },
    persistedAfterReload: true,
  }, null, 2))
} finally {
  await browser.close()
}
