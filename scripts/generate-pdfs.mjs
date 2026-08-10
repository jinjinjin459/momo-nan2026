import { readFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { marked } from 'marked'

const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const docsRoot = join(projectRoot, 'docs')
const outputRoot = join(projectRoot, 'submission')
await mkdir(outputRoot, { recursive: true })

marked.use({ gfm: true, breaks: false })

const documents = [
  {
    source: join(docsRoot, 'game-introduction.md'),
    output: join(outputRoot, 'MOMO_게임소개및설명서.pdf'),
    label: 'GAME INTRODUCTION · NAN 2026',
  },
  {
    source: join(docsRoot, 'ai-technical-document.md'),
    output: join(outputRoot, 'MOMO_AI활용기술문서.pdf'),
    label: 'AI TECHNICAL DOCUMENT · NAN 2026',
  },
]

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
})

for (const document of documents) {
  const markdown = await readFile(document.source, 'utf8')
  const body = await marked.parse(markdown)
  let resolvedBody = body
  for (const match of body.matchAll(/src="images\/([^"]+)"/g)) {
    const imageData = await readFile(join(dirname(document.source), 'images', match[1]))
    resolvedBody = resolvedBody.replaceAll(
      match[0],
      `src="data:image/png;base64,${imageData.toString('base64')}"`,
    )
  }
  const baseHref = pathToFileURL(dirname(document.source)).href
  const html = `<!doctype html>
  <html lang="ko">
    <head>
      <meta charset="utf-8">
      <base href="${baseHref}">
      <style>
        :root { color: #19172a; font-family: "Malgun Gothic", "Apple SD Gothic Neo", Arial, sans-serif; }
        * { box-sizing: border-box; }
        body { margin: 0; font-size: 10.2pt; line-height: 1.72; word-break: keep-all; overflow-wrap: anywhere; }
        body::before { content: "MOMO ✦"; display: block; color: #7659df; font: 800 11pt Arial; letter-spacing: .18em; padding-bottom: 17mm; }
        h1 { color: #17142a; font-size: 28pt; line-height: 1.15; letter-spacing: -.04em; margin: 0 0 18mm; padding: 0 0 9mm; border-bottom: 2px solid #7e61e8; }
        h1::after { content: "키우다 보면, 나를 가장 잘 아는 AI가 된다."; display: block; color: #766f8c; font-size: 10.5pt; font-weight: 400; letter-spacing: 0; margin-top: 6mm; }
        h2 { break-after: avoid; color: #4f38a9; font-size: 16pt; line-height: 1.3; letter-spacing: -.025em; margin: 11mm 0 4mm; padding-top: 2mm; }
        h3 { break-after: avoid; color: #29233f; font-size: 12pt; margin: 7mm 0 2mm; }
        p { margin: 0 0 3.2mm; }
        li { margin: 1.2mm 0; }
        ul, ol { padding-left: 6mm; margin: 2mm 0 4mm; }
        blockquote { margin: 6mm 0; padding: 5mm 7mm; border-left: 3px solid #8669ed; border-radius: 0 4mm 4mm 0; color: #4f4380; background: #f3f0ff; font-size: 12pt; font-weight: 700; }
        blockquote p { margin: 0; }
        code { font-family: Consolas, "Malgun Gothic", monospace; color: #553aaf; background: #f1eef9; border-radius: 1.5mm; padding: .3mm 1.2mm; font-size: 8.8pt; }
        pre { break-inside: avoid; white-space: pre-wrap; overflow-wrap: anywhere; padding: 4.5mm; border: 1px solid #ddd6f5; border-radius: 3mm; color: #eeeaff; background: #17142c; font-size: 8.3pt; line-height: 1.55; }
        pre code { color: inherit; background: transparent; padding: 0; }
        table { width: 100%; border-collapse: collapse; margin: 4mm 0 6mm; font-size: 8.8pt; break-inside: avoid; }
        th { color: #fff; background: #55409f; }
        th, td { border: 1px solid #dcd7ec; padding: 2.6mm; text-align: left; vertical-align: top; }
        tr:nth-child(even) td { background: #f8f7fc; }
        table img { display: block; width: 100%; max-height: 75mm; object-fit: contain; border-radius: 3mm; }
        a { color: #5137bd; text-decoration: none; word-break: break-all; }
        strong { color: #242039; }
        hr { border: 0; border-top: 1px solid #ddd8eb; margin: 8mm 0; }
        @page { size: A4; margin: 19mm 18mm 20mm; }
      </style>
    </head>
    <body>${resolvedBody}</body>
  </html>`

  const page = await browser.newPage()
  await page.setContent(html, { waitUntil: 'networkidle' })
  await page.emulateMedia({ media: 'print' })
  await page.pdf({
    path: document.output,
    format: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: `<div style="width:100%;padding:0 18mm;color:#88829a;font:7pt Arial;display:flex;justify-content:space-between"><span>${document.label}</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    margin: { top: '19mm', right: '18mm', bottom: '20mm', left: '18mm' },
    preferCSSPageSize: true,
  })
  await page.close()
  console.log(document.output)
}

await browser.close()
