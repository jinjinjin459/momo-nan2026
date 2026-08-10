import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.goto('http://127.0.0.1:4627', { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
await page.getByRole('button', { name: /Momo 깨우기/ }).click()
await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()
await page.getByRole('textbox', { name: '메시지' }).fill('나는 개발자고 밤에 코딩하는 것을 좋아해.')
await page.getByRole('button', { name: '전송' }).click()
await page.getByText('Gemma 4 · 26B').waitFor({ timeout: 20_000 })
await page.getByText('MEMORY DISCOVERED').waitFor({ timeout: 20_000 })

const state = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
if (state.memories?.length !== 1) throw new Error(`Expected one live memory, got ${state.memories?.length ?? 0}`)
if (state.messages?.length !== 3) throw new Error(`Expected three messages, got ${state.messages?.length ?? 0}`)

console.log(JSON.stringify({
  mode: 'Gemma 4 26B A4B IT',
  memory: state.memories[0].text,
  topicsScore: state.evolution.scores,
  reply: state.messages.at(-1).text,
}, null, 2))
await browser.close()
