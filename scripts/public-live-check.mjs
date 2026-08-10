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
page.on('response', (response) => {
  if (response.url().endsWith('/api/chat')) apiResponses.push(response.status())
})

const dismissEvents = async () => {
  const titles = []
  while (await page.locator('.event-overlay').isVisible().catch(() => false)) {
    titles.push((await page.locator('.event-card .micro-label').textContent())?.trim() ?? '')
    await page.locator('.event-card .primary-button').click()
    await page.waitForTimeout(180)
  }
  return titles
}

const send = async (message) => {
  await page.getByRole('textbox', { name: '메시지' }).fill(message)
  await page.getByRole('button', { name: '전송' }).click()
  await page.locator('.typing').waitFor({ state: 'visible', timeout: 3_000 }).catch(() => {})
  await page.locator('.typing').waitFor({ state: 'hidden', timeout: 20_000 })
  return dismissEvents()
}

try {
  await page.goto(playUrl, { waitUntil: 'networkidle', timeout: 30_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Momo 깨우기/ }).click()
  await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()

  const firstEvents = await send('나는 개발자고 밤에 코딩하는 걸 좋아해.')
  await page.getByText('Gemma 4 · 26B').waitFor({ timeout: 3_000 })
  if (!firstEvents.includes('MEMORY DISCOVERED')) throw new Error('Live memory event was not created')

  await send('내가 좋아한다고 말한 활동과 시간대를 기억해?')
  const recallReply = await page.locator('.message.assistant .message-bubble').last().textContent()
  if (!/코딩|개발|밤|야간/.test(recallReply ?? '')) throw new Error(`Memory recall was not grounded: ${recallReply}`)

  const growthEvents = await send('오늘도 늦게까지 새로운 것을 만들 거야.')
  const afterGrowth = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  if (afterGrowth.evolution?.current !== 'nightOwl') {
    throw new Error(`Expected Night Owl evolution, got ${afterGrowth.evolution?.current}`)
  }
  if (!afterGrowth.abilities?.includes('quest')) throw new Error('Quest ability was not unlocked')
  if (!growthEvents.includes('MOMO EVOLVED')) throw new Error('Evolution event was not shown')

  const questEvents = await send('오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.')
  if (!questEvents.includes('REAL-WORLD QUEST ADDED')) throw new Error('Quest event was not shown')
  await page.getByRole('button', { name: 'Quests' }).click()
  await page.locator('.quest-check').first().click()
  await page.getByText('DEMO COMPLETE').waitFor({ timeout: 3_000 })
  await page.screenshot({ path: `${outputDir}complete.png`, fullPage: false })
  await dismissEvents()

  const beforeReload = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  if (!beforeReload.quests?.[0]?.completed) throw new Error('Quest was not completed')
  await page.reload({ waitUntil: 'networkidle' })
  const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  if (afterReload.evolution?.current !== 'nightOwl' || !afterReload.quests?.[0]?.completed || afterReload.memories?.length < 1) {
    throw new Error('Core progress did not survive reload')
  }
  if (apiResponses.length < 4 || apiResponses.some((status) => status !== 200)) {
    throw new Error(`Expected four successful live API calls, got ${JSON.stringify(apiResponses)}`)
  }

  console.log(JSON.stringify({
    playUrl,
    apiResponses,
    recallReply,
    memory: afterReload.memories[0].text,
    evolution: afterReload.evolution.current,
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
