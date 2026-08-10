import { spawn, spawnSync } from 'node:child_process'
import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

async function exists(path) {
  if (!path) return false
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

export async function resolveMediaTool(name) {
  const envName = `${name.toUpperCase()}_PATH`
  const configured = process.env[envName]
  if (await exists(configured)) return configured

  const locator = process.platform === 'win32' ? 'where.exe' : 'which'
  const located = spawnSync(locator, [name], { encoding: 'utf8', windowsHide: true })
  const first = located.status === 0 ? located.stdout.trim().split(/\r?\n/)[0] : ''
  if (await exists(first)) return first

  if (process.platform === 'win32') {
    const packageRoot = join(tmpdir(), 'momo-video-tools', 'node_modules')
    const bundled = name === 'ffmpeg'
      ? join(packageRoot, 'ffmpeg-static', 'ffmpeg.exe')
      : join(packageRoot, 'ffprobe-static', 'bin', 'win32', process.arch === 'ia32' ? 'ia32' : 'x64', 'ffprobe.exe')
    if (await exists(bundled)) return bundled
  }

  throw new Error(`${name} was not found. Set ${envName} to the executable path.`)
}

export function run(command, args, { echo = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (echo) process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      if (echo) process.stderr.write(chunk)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} exited with ${code}\n${stderr.slice(-4000)}`))
    })
  })
}

export async function probeJson(path, extraArgs = []) {
  const ffprobe = await resolveMediaTool('ffprobe')
  const { stdout } = await run(ffprobe, [
    '-v', 'error',
    ...extraArgs,
    '-of', 'json',
    path,
  ])
  return JSON.parse(stdout)
}
