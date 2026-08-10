import { chromium } from 'playwright'
import { copyFile, mkdir, mkdtemp, rm, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { parseLeadingBlackEnd, probeJson, resolveMediaTool, run } from './video-tools.mjs'
import { verifyVideo } from './video-verify.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(scriptDir, '..')
const gameUrl = process.env.MOMO_PLAY_URL ?? 'http://127.0.0.1:4627/'
const outputPath = resolve(process.env.MOMO_VIDEO_OUTPUT ?? join(repositoryRoot, 'submission/MOMO_플레이영상_40초.mp4'))
const requireLive = process.env.MOMO_REQUIRE_LIVE !== '0'
const chromePath = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const targetSeconds = 40

const parsedUrl = new URL(gameUrl)
if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error('MOMO_PLAY_URL must be an HTTP(S) URL')
if (requireLive && parsedUrl.searchParams.get('demo') === '1') {
  throw new Error('Live capture refuses a ?demo=1 URL. Set MOMO_PLAY_URL to the public Live build.')
}

const wait = (page, milliseconds) => page.waitForTimeout(milliseconds)
const readState = (page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}'),
)

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

async function sendCurrentMessage(page) {
  const before = (await readState(page)).messages?.length ?? 0
  await page.locator('.chat-composer button').click()
  await page.waitForFunction(
    ({ expected }) => {
      const state = JSON.parse(localStorage.getItem('momo-nan2026-state-v1') ?? '{}')
      return (state.messages?.length ?? 0) >= expected
    },
    { expected: before + 2 },
    { timeout: 60_000 },
  )
  await wait(page, 350)

  if (requireLive) {
    const mode = await page.locator('.mode-pill').innerText()
    assert(/Live/i.test(mode), `Live AI fell back during capture: ${mode}`)
  }
}

async function chooseSuggestionAndSend(page) {
  await page.locator('.suggestion-chip').click()
  await wait(page, 850)
  await sendCurrentMessage(page)
}

async function typeAndSend(page, text) {
  await page.locator('.chat-composer input').fill(text)
  await wait(page, 850)
  await sendCurrentMessage(page)
}

async function showAndCloseEvent(page, title, holdMilliseconds) {
  await page.getByText(title, { exact: true }).waitFor({ timeout: 10_000 })
  await wait(page, holdMilliseconds)
  await page.locator('.event-overlay button').click()
  await wait(page, 550)
}

const tempDir = await mkdtemp(join(tmpdir(), 'momo-video-record-'))
let browser

try {
  await mkdir(dirname(outputPath), { recursive: true })
  browser = await chromium.launch({
    headless: true,
    executablePath: existsSync(chromePath) ? chromePath : undefined,
  })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    locale: 'ko-KR',
    colorScheme: 'dark',
    recordVideo: { dir: tempDir, size: { width: 390, height: 844 } },
  })
  const page = await context.newPage()
  await page.goto(gameUrl, { waitUntil: 'networkidle', timeout: 45_000 })
  await page.evaluate(() => localStorage.clear())
  await page.reload({ waitUntil: 'networkidle', timeout: 45_000 })
  await wait(page, 2_400)

  await page.locator('.start-screen .primary-button').click()
  await wait(page, 2_200)
  if (requireLive) {
    const initialMode = await page.locator('.mode-pill').innerText()
    assert(!/Demo/i.test(initialMode), `Public build is not Live-ready: ${initialMode}`)
  }

  await page.locator('.talk-button').click()
  await wait(page, 1_100)

  await chooseSuggestionAndSend(page)
  await showAndCloseEvent(page, 'MEMORY DISCOVERED', 2_100)
  await showAndCloseEvent(page, 'NEW ABILITY', 1_200)
  const remembered = await readState(page)
  assert(remembered.memories?.length === 1, 'First Live exchange did not create one memory')

  await typeAndSend(page, '내가 뭐 좋아한다고 했지?')
  await wait(page, 1_700)
  const recalled = await readState(page)
  assert(recalled.memories?.length === 1, 'Recall exchange changed the memory count')
  assert(recalled.demoStep === 1, 'Recall exchange skipped the guided Night Owl prompt')

  await chooseSuggestionAndSend(page)
  await showAndCloseEvent(page, 'MOMO EVOLVED', 3_000)
  await showAndCloseEvent(page, 'NEW ABILITY UNLOCKED', 1_500)
  const evolved = await readState(page)
  assert(evolved.evolution?.current === 'nightOwl', 'Live run did not reach Night Owl')
  assert(evolved.abilities?.includes('quest'), 'Live run did not unlock Quest Keeper')

  await chooseSuggestionAndSend(page)
  await showAndCloseEvent(page, 'REAL-WORLD QUEST ADDED', 1_700)
  await page.getByRole('button', { name: 'Quests' }).click()
  await wait(page, 2_200)
  await page.locator('button.quest-check').first().click()
  await page.getByText('DEMO COMPLETE', { exact: true }).waitFor({ timeout: 10_000 })
  await wait(page, 3_000)
  await page.locator('.event-overlay button').click()
  await wait(page, 650)
  await page.getByRole('button', { name: 'DNA' }).click()
  await wait(page, 2_400)

  const completed = await readState(page)
  assert(completed.quests?.[0]?.completed === true, 'Recorded quest was not completed')
  assert(completed.evolution?.current === 'nightOwl', 'Recorded final state lost Night Owl')

  const video = page.video()
  await context.close()
  const rawVideo = await video.path()
  await browser.close()
  browser = undefined

  const rawMetadata = await probeJson(rawVideo, ['-show_entries', 'format=duration'])
  const rawDuration = Number(rawMetadata.format?.duration)
  assert(Number.isFinite(rawDuration) && rawDuration >= 15 && rawDuration <= 180, `Unexpected raw duration: ${rawDuration}`)

  const ffmpeg = await resolveMediaTool('ffmpeg')
  const normalizedVideo = join(tempDir, 'momo-40s.mp4')
  const timeScale = targetSeconds / rawDuration
  const filter = [
    `setpts=${timeScale.toFixed(9)}*PTS`,
    'fps=30',
    'tpad=stop_mode=clone:stop_duration=1',
    `trim=duration=${targetSeconds}`,
    'setpts=PTS-STARTPTS',
    'scale=720:1280:force_original_aspect_ratio=decrease:flags=lanczos',
    'pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=0x070818',
    'format=yuv420p',
  ].join(',')

  await run(ffmpeg, [
    '-y', '-i', rawVideo,
    '-an', '-vf', filter,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-r', '30', '-frames:v', '1200', '-video_track_timescale', '30000',
    '-movflags', '+faststart',
    '-metadata', 'comment=MOMO actual Playwright gameplay capture; no generated or synthetic UI',
    normalizedVideo,
  ], { echo: true })

  const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null'
  const blackScan = await run(ffmpeg, [
    '-hide_banner', '-i', normalizedVideo,
    '-vf', 'blackdetect=d=0.10:pix_th=0.10:pic_th=0.98',
    '-an', '-f', 'null', nullOutput,
  ])
  const leadingBlackEnd = parseLeadingBlackEnd(blackScan.stderr)
  let submissionCandidate = normalizedVideo

  if (leadingBlackEnd > 0.5) {
    const cutStart = Math.min(leadingBlackEnd + 0.1, 10)
    const remainingSeconds = targetSeconds - cutStart
    assert(remainingSeconds >= 25, `Initial blank capture is too long: ${leadingBlackEnd}`)
    const cleanedVideo = join(tempDir, 'momo-40s-no-leading-black.mp4')
    const cleanedFilter = [
      `trim=start=${cutStart.toFixed(6)}:duration=${remainingSeconds.toFixed(6)}`,
      'setpts=PTS-STARTPTS',
      `setpts=${(targetSeconds / remainingSeconds).toFixed(9)}*PTS`,
      'fps=30',
      'tpad=stop_mode=clone:stop_duration=1',
      `trim=duration=${targetSeconds}`,
      'setpts=PTS-STARTPTS',
      'format=yuv420p',
    ].join(',')
    await run(ffmpeg, [
      '-y', '-i', normalizedVideo,
      '-an', '-vf', cleanedFilter,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '19',
      '-r', '30', '-frames:v', '1200', '-video_track_timescale', '30000',
      '-movflags', '+faststart',
      '-metadata', 'comment=MOMO actual Playwright gameplay capture; initial navigation blank removed',
      cleanedVideo,
    ], { echo: true })
    submissionCandidate = cleanedVideo
  }

  await verifyVideo(submissionCandidate, { extractFrames: false })
  await copyFile(submissionCandidate, outputPath)
  const report = await verifyVideo(outputPath, { extractFrames: true })
  const outputStat = await stat(outputPath)
  console.log(JSON.stringify({
    sourceUrl: gameUrl,
    liveRequired: requireLive,
    rawDuration,
    outputBytes: outputStat.size,
    ...report,
  }, null, 2))
} finally {
  if (browser) await browser.close().catch(() => {})
  await rm(tempDir, { recursive: true, force: true })
}
