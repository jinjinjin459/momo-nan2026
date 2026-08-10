import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = fileURLToPath(new URL('../artifacts/visual-check/', import.meta.url))
const gameUrl = process.env.MOMO_PLAY_URL ?? 'http://127.0.0.1:4627/?demo=1'
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
const consoleErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(`${message.text()} @ ${message.location().url}`)
})

const capture = async (name) => {
  await page.waitForTimeout(400)
  await page.screenshot({ path: `${outputDir}${name}.png`, fullPage: false })
}

const send = async (message) => {
  await page.getByRole('textbox', { name: '메시지' }).fill(message)
  await page.getByRole('button', { name: '전송' }).click()
  await page.locator('.typing').waitFor({ state: 'hidden', timeout: 10_000 })
}

const dismissEvents = async () => {
  const titles = []
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const overlay = page.locator('.event-overlay')
    if (!await overlay.isVisible().catch(() => false)) return titles
    titles.push((await overlay.locator('.micro-label').textContent())?.trim())
    await overlay.locator('.primary-button').click()
    await page.waitForTimeout(150)
  }
  return titles
}

try {
  await page.goto(gameUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })

  await capture('01-start')
  await page.getByRole('button', { name: /Momo 깨우기/ }).click()
  await capture('02-home')
  await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()

  const guidedMessages = [
    '나는 개발자고 밤에 코딩하는 걸 좋아해.',
    '오늘도 늦게까지 새로운 걸 만들 거야.',
    '밤에 집중해서 코딩하면 아이디어가 더 잘 떠올라.',
    '오늘 하루도 같이 이야기해서 좋다.',
    '우리 조금 더 가까워진 것 같아.',
    '오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.',
  ]

  await send(guidedMessages[0])
  await page.getByText('MEMORY DISCOVERED').waitFor()
  await capture('03-memory-event')
  await dismissEvents()

  for (const message of guidedMessages.slice(1, -1)) {
    await send(message)
    if (message !== guidedMessages.at(-2)) await dismissEvents()
  }

  await page.getByText('EVOLUTION READY').waitFor()
  await capture('04-evolution-ready')
  await dismissEvents()

  await page.getByRole('button', { name: 'DNA' }).click()
  await capture('05-dna-choices')
  await page.getByRole('button', { name: /Night Owl로 진화하기/ }).click()
  await page.getByText('MOMO EVOLVED').waitFor()
  await capture('06-evolution')
  await page.getByRole('button', { name: /새로운 Momo/ }).click()

  await page.getByRole('button', { name: 'Talk' }).click()
  await send(guidedMessages.at(-1))
  const questEvents = await dismissEvents()
  if (!questEvents.includes('REAL-WORLD QUEST ADDED')) throw new Error('Quest event was not shown')

  await page.getByRole('button', { name: 'Quests' }).click()
  await page.getByText('Momo와 현실을 모험하세요').waitFor()
  await capture('07-quest')
  await page.locator('.quest-check').first().click()
  await page.getByText('QUEST COMPLETE').waitFor()
  await capture('08-reward')
  await dismissEvents()

  const report = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    state: JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'),
  }))
  if (report.state.evolution?.current !== 'nightOwl') throw new Error('Night Owl was not selected')
  if (!report.state.quests?.[0]?.completed) throw new Error('Quest was not completed')
  if (consoleErrors.length) throw new Error(`Console errors: ${JSON.stringify(consoleErrors)}`)

  await page.getByRole('button', { name: 'Home' }).click()
  await page.setViewportSize({ width: 1280, height: 900 })
  await capture('09-desktop-home')
  const appWidth = await page.locator('.app-shell').evaluate((element) => element.getBoundingClientRect().width)
  if (appWidth > 480) throw new Error(`Desktop app shell exceeded 480px: ${appWidth}`)

  console.log(JSON.stringify({ ...report, desktopAppWidth: appWidth }, null, 2))
} finally {
  await browser.close()
}
