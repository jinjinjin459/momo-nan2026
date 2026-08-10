import { chromium } from 'playwright'

const gameUrl = process.env.MOMO_PLAY_URL ?? 'http://127.0.0.1:4627/'
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
await page.route('**/api/**', (route) => route.abort('connectionrefused'))

try {
  await page.goto(gameUrl, { waitUntil: 'domcontentloaded' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: /Momo 깨우기/ }).click()
  await page.getByText('Offline Fallback').waitFor({ timeout: 10_000 })
  await page.getByRole('button', { name: /Momo와 이야기하기/ }).click()
  await page.getByRole('textbox', { name: '메시지' }).fill('연결 실패 테스트')
  await page.getByRole('button', { name: '전송' }).click()
  await page.getByText(/이번 답변은 오프라인 모드/).waitFor({ timeout: 10_000 })

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'))
  if (state.messages?.length !== 3) throw new Error('Fallback reply was not persisted')

  console.log(JSON.stringify({
    mode: await page.locator('.mode-pill').innerText(),
    notice: await page.locator('.demo-notice.error').innerText(),
    messages: state.messages.length,
  }, null, 2))
} finally {
  await browser.close()
}
