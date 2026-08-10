import { chromium } from 'playwright'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const outputDir = fileURLToPath(new URL('../artifacts/visual-check/', import.meta.url))
await mkdir(outputDir, { recursive: true })

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.goto('http://127.0.0.1:4627/?demo=1', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })

const capture = async (name) => {
  await page.waitForTimeout(650)
  await page.screenshot({ path: `${outputDir}${name}.png`, fullPage: false })
}

await capture('01-start')
await page.getByRole('button', { name: /Momo 깨우기/ }).click()
await capture('02-home')
await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()
await page.getByRole('textbox', { name: '메시지' }).fill('나는 개발자고 밤에 코딩하는 걸 좋아해.')
await page.getByRole('button', { name: '전송' }).click()
await page.getByText('MEMORY DISCOVERED').waitFor()
await capture('03-memory-event')
await page.getByRole('button', { name: /계속하기/ }).click()
await page.getByText('NEW ABILITY').waitFor()
await page.getByRole('button', { name: /계속하기/ }).click()

await page.getByRole('textbox', { name: '메시지' }).fill('오늘도 늦게까지 새로운 걸 만들 거야.')
await page.getByRole('button', { name: '전송' }).click()
await page.getByText('MOMO EVOLVED').waitFor()
await capture('04-evolution')
await page.getByRole('button', { name: /새로운 Momo/ }).click()
await page.getByText('NEW ABILITY UNLOCKED').waitFor()
await page.getByRole('button', { name: /계속하기/ }).click()

await page.getByRole('textbox', { name: '메시지' }).fill('오늘 밤 11시에 NAN 발표 자료 만들기 기억해줘.')
await page.getByRole('button', { name: '전송' }).click()
await page.getByText('REAL-WORLD QUEST ADDED').waitFor()
await page.getByRole('button', { name: /계속하기/ }).click()
await page.getByRole('button', { name: 'Quests' }).click()
await page.getByText('Momo와 현실을 모험하세요').waitFor()
await capture('05-quest')
await page.locator('.quest-check').first().click()
await page.getByText('DEMO COMPLETE').waitFor()
await capture('06-reward')

const report = await page.evaluate(() => ({
  viewport: { width: innerWidth, height: innerHeight },
  document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  state: JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'),
}))

console.log(JSON.stringify(report, null, 2))
await browser.close()
