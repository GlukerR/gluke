/*
 * IndexNow ping: сообщает Bing, Seznam, Naver (и другим участникам протокола),
 * что URL-адреса сайта изменились, чтобы они переобошли их без ожидания
 * естественного обхода. В Vercel-деплое вызывается из GitHub Actions на push
 * в master (см. .github/workflows/ci.yml) или вручную: `pnpm indexnow`.
 *
 * Ключ: файл `public/<ключ>.txt`, имя которого и есть ключ (см. протокол IndexNow).
 * URL берутся из `NUXT_SITE_URL` (или дефолт https://gluke.ru) + статические
 * маршруты и слаги кейсов из `content/projects/en`.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const KEY_FILE_RE = /^[0-9a-f]{32}\.txt$/

function findKey() {
  const pub = join(process.cwd(), 'public')
  const f = readdirSync(pub).find(name => KEY_FILE_RE.test(name))
  if (!f) {
    throw new Error('IndexNow key file not found in public/. Run `node scripts/indexnow.mjs` after creating public/<key>.txt')
  }
  const key = f.replace(/\.txt$/, '')
  const body = readFileSync(join(pub, f), 'utf8').trim()
  if (body !== key) {
    throw new Error(`IndexNow key file content (${body}) must equal its filename (${key}).`)
  }
  return key
}

function collectUrls(base) {
  const urls = [
    base,
    `${base}/ru`,
    `${base}/projects`,
    `${base}/ru/projects`,
    `${base}/sitemap.xml`,
  ]
  const dir = join(process.cwd(), 'content', 'projects', 'en')
  if (existsSync(dir)) {
    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.md')) continue
      const slug = file.replace(/\.md$/, '')
      urls.push(`${base}/projects/${slug}`, `${base}/ru/projects/${slug}`)
    }
  }
  return [...new Set(urls)]
}

async function main() {
  const base = String(process.env.NUXT_SITE_URL || 'https://gluke.ru').replace(/\/+$/, '')
  const key = findKey()
  const urls = collectUrls(base)
  console.log(`IndexNow key: ${key}`)
  console.log(`Pinging ${urls.length} URLs on ${base}...`)

  let ok = 0
  let failed = 0
  for (const url of urls) {
    const endpoint = `https://api.indexnow.org/indexnow?url=${encodeURIComponent(url)}&key=${key}`
    let res
    try {
      res = await fetch(endpoint, { method: 'GET' })
    }
    catch (err) {
      console.error(`  FAIL ${url}: ${err.message}`)
      failed++
      continue
    }
    if (res.ok) {
      ok++
      console.log(`  ok   ${url}`)
    }
    else {
      failed++
      console.error(`  FAIL ${url}: HTTP ${res.status}`)
    }
  }

  console.log(`Done: ${ok} ok, ${failed} failed.`)
  if (failed > 0) process.exitCode = 1
}

main()
