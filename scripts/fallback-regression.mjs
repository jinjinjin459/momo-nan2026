import { chromium } from 'playwright'

const gameUrl = process.env.MOMO_PLAY_URL ?? 'http://127.0.0.1:4627/?demo=1'
const executablePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'

const browser = await chromium.launch({ headless: true, executablePath })

const readState = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'),
)

const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

async function openFreshGame() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(gameUrl, { waitUntil: 'networkidle' })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.start-screen .primary-button').click()
  await page.locator('.talk-button').click()
  return page
}

async function send(page, text) {
  await page.locator('.chat-composer input').fill(text)
  await page.locator('.chat-composer button').click()
  await page.waitForTimeout(100)
  await page.waitForFunction(() => !document.querySelector('.typing'))
}

async function dismissEvents(page) {
  for (let index = 0; index < 8; index += 1) {
    await page.waitForTimeout(400)
    if (!(await page.locator('.event-overlay').count())) return
    await page.evaluate(() => document.querySelector('.event-overlay button')?.click())
  }
  throw new Error('Event overlay queue did not close')
}

try {
  const page = await openFreshGame()

  await send(page, await page.locator('.suggestion-chip').innerText())
  await dismissEvents(page)

  const beforeRecall = await readState(page)
  assert(beforeRecall.memories.length === 1, 'First preference should create exactly one memory')
  assert(beforeRecall.demoStep === 1, 'First preference should advance the guided demo once')

  await send(page, '내가 뭐 좋아한다고 했지?')
  await dismissEvents(page)

  const afterRecall = await readState(page)
  const recallReply = afterRecall.messages.at(-1)?.text ?? ''
  assert(afterRecall.memories.length === 1, 'A recall question must not be saved as a new memory')
  assert(recallReply.includes(beforeRecall.memories[0].text), 'Recall reply must use the saved preference')
  assert(afterRecall.demoStep === 1, 'A recall question must not skip the next guided suggestion')

  await send(page, '내가 밤에 코딩 좋아하는 거 기억해?')
  await dismissEvents(page)
  const afterRememberQuestion = await readState(page)
  assert(afterRememberQuestion.memories.length === 1, 'A 기억해? question must not create a quest or memory')
  assert(afterRememberQuestion.quests.length === 0, 'A 기억해? question must not be treated as a quest command')
  assert(afterRememberQuestion.demoStep === 1, 'A second recall wording must also preserve the guided step')

  const evolutionSuggestion = await page.locator('.suggestion-chip').innerText()
  assert(evolutionSuggestion.includes('늦게까지'), 'Recall must leave the Night Owl evolution suggestion next')
  await send(page, evolutionSuggestion)
  await dismissEvents(page)

  const evolved = await readState(page)
  assert(evolved.evolution.current === 'nightOwl', 'Recommended second growth message must evolve Night Owl')
  assert(evolved.abilities.includes('quest'), 'Night Owl evolution must unlock Quest Keeper')

  await send(page, await page.locator('.suggestion-chip').innerText())
  await dismissEvents(page)
  await page.getByRole('button', { name: 'Quests' }).click()
  await page.locator('button.quest-check').first().click()
  await page.getByText('DEMO COMPLETE').waitFor()

  const completed = await readState(page)
  await page.reload({ waitUntil: 'networkidle' })
  const reloaded = await readState(page)
  assert(completed.quests[0]?.completed === true, 'Quest must be completed before reload')
  assert(JSON.stringify(reloaded) === JSON.stringify(completed), 'Completed core-loop state must survive reload')
  await page.close()

  const nonNightPage = await openFreshGame()
  for (let index = 0; index < 3; index += 1) {
    await send(nonNightPage, `나는 그림과 음악과 디자인을 좋아해 ${index + 1}`)
    await dismissEvents(nonNightPage)
  }
  const nonNight = await readState(nonNightPage)
  assert(nonNight.evolution.scores.artist >= 30, 'Artist DNA should still accumulate')
  assert(nonNight.evolution.current === 'normal', 'Only Night Owl may trigger the prototype evolution')
  await nonNightPage.close()

  console.log(JSON.stringify({
    recallMemoryCount: afterRecall.memories.length,
    recallDemoStep: afterRecall.demoStep,
    evolution: evolved.evolution.current,
    questCompleted: completed.quests[0].completed,
    reloadPersisted: true,
    artistDna: nonNight.evolution.scores.artist,
    artistDidNotEvolve: true,
  }, null, 2))
} finally {
  await browser.close()
}
