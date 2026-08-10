import { pathToFileURL, fileURLToPath } from 'node:url'
import { mkdir, stat } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { parseLeadingBlackEnd, probeJson, resolveMediaTool, run } from './video-tools.mjs'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const defaultVideo = resolve(scriptDir, '../submission/MOMO_플레이영상_40초.mp4')

export async function verifyVideo(videoPath, { extractFrames = true } = {}) {
  const absoluteVideo = resolve(videoPath)
  const metadata = await probeJson(absoluteVideo, [
    '-count_frames',
    '-show_entries', 'format=duration,size:stream=codec_name,width,height,pix_fmt,avg_frame_rate,nb_read_frames',
    '-select_streams', 'v:0',
  ])
  const stream = metadata.streams?.[0]
  const duration = Number(metadata.format?.duration)
  const size = Number(metadata.format?.size)
  const frameCount = Number(stream?.nb_read_frames)

  if (!stream) throw new Error('No video stream found')
  if (stream.codec_name !== 'h264') throw new Error(`Expected h264, received ${stream.codec_name}`)
  if (stream.width !== 720 || stream.height !== 1280) {
    throw new Error(`Expected 720x1280, received ${stream.width}x${stream.height}`)
  }
  if (Math.abs(duration - 40) > 0.05) throw new Error(`Expected ~40.0 seconds, received ${duration}`)
  if (frameCount !== 1200) throw new Error(`Expected 1200 frames, received ${frameCount}`)
  if (size < 500_000) throw new Error(`Video is unexpectedly small: ${size} bytes`)

  const report = {
    video: absoluteVideo,
    duration,
    codec: stream.codec_name,
    dimensions: `${stream.width}x${stream.height}`,
    pixelFormat: stream.pix_fmt,
    frameRate: stream.avg_frame_rate,
    frameCount,
    bytes: size,
  }

  const ffmpeg = await resolveMediaTool('ffmpeg')
  const nullOutput = process.platform === 'win32' ? 'NUL' : '/dev/null'
  const blackScan = await run(ffmpeg, [
    '-hide_banner', '-i', absoluteVideo,
    '-vf', 'blackdetect=d=0.10:pix_th=0.10:pic_th=0.98',
    '-an', '-f', 'null', nullOutput,
  ])
  const leadingBlackSeconds = parseLeadingBlackEnd(blackScan.stderr)
  if (leadingBlackSeconds > 0.5) {
    throw new Error(`Video starts with ${leadingBlackSeconds.toFixed(3)} seconds of black frames`)
  }
  report.leadingBlackSeconds = leadingBlackSeconds

  if (extractFrames) {
    const frameDir = join(tmpdir(), `momo-video-frames-${Date.now()}`)
    await mkdir(frameDir, { recursive: true })
    const frames = []

    for (const second of [3, 12, 22, 32, 38]) {
      const framePath = join(frameDir, `frame-${String(second).padStart(2, '0')}s.jpg`)
      await run(ffmpeg, ['-y', '-ss', String(second), '-i', absoluteVideo, '-frames:v', '1', '-q:v', '2', framePath])
      const frameStat = await stat(framePath)
      const frameProbe = await probeJson(framePath, [
        '-show_entries', 'stream=codec_name,width,height',
        '-select_streams', 'v:0',
      ])
      const frameStream = frameProbe.streams?.[0]
      if (frameStat.size < 5_000 || frameStream?.width !== 720 || frameStream?.height !== 1280) {
        throw new Error(`Representative frame failed validation at ${second}s`)
      }
      frames.push({ second, path: framePath, bytes: frameStat.size })
    }
    report.representativeFrames = frames
  }

  return report
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = await verifyVideo(process.argv[2] ?? defaultVideo)
  console.log(JSON.stringify(report, null, 2))
}
