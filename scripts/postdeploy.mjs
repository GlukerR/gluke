/*
 * Post-deploy: автономное обновление кастомного домена после каждого пуша.
 *
 * 1. Ждёт, пока на Vercel станет READY production-деплой для текущего коммита
 *    (meta.githubCommitSha == GITHUB_SHA). Vercel собирает параллельно с CI,
 *    поэтому сюда попадаем уже после CI-сборки, но деплой обычно ещё идёт.
 * 2. Направляет gluke.ru на этот свежий релиз через `vercel alias set`.
 * 3. Пингует IndexNow (scripts/indexnow.mjs), чтобы поисковики переобошли сайт.
 *
 * Параметры берутся из env: VERCEL_TOKEN, VERCEL_PROJECT_ID, TEAM_ID,
 * GITHUB_SHA, DOMAIN (по умолчанию gluke.ru), NUXT_SITE_URL.
 */
import { spawn } from 'node:child_process'

const run = async (cmd, args, opts = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, opts)
    let out = ''
    child.stdout.on('data', (d) => {
      out += d
    })
    child.stderr.on('data', (d) => {
      out += d
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve(out.trim())
      }
      else {
        reject(new Error(`command failed (${code}): ${out}`))
      }
    })
  })

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/* Ожидание production-деплоя. Таймаут 20 минут: с ростом числа кейсов сборка
   на Vercel (обработка ~235 медиафайлов через sharp + prerender) перестала
   укладываться в прежние 10 и шаг стабильно падал по таймауту.

   `teamId` обязателен: проект командный, и без него API отвечает по личному
   scope — деплои команды в выдачу не попадают. Alias ниже scope уже передаёт,
   здесь его не хватало. */
const WAIT_MINUTES = 20

async function waitForCommitDeployment() {
  const sha = process.env.GITHUB_SHA
  const projectId = process.env.VERCEL_PROJECT_ID
  const token = process.env.VERCEL_TOKEN
  const teamId = process.env.TEAM_ID
  const deadline = Date.now() + WAIT_MINUTES * 60 * 1000
  const endpoint
    = `https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&limit=30`
      + (teamId ? `&teamId=${encodeURIComponent(teamId)}` : '')

  /* Цикл раньше молчал: и ошибка авторизации, и просто незаконченная сборка
     выглядели одинаково — «не дождались». Поэтому состояние логируется. */
  let lastReport = ''
  while (Date.now() < deadline) {
    const res = await fetch(endpoint, { headers: { authorization: `Bearer ${token}` } })
    if (!res.ok) {
      console.log(`Vercel API responded ${res.status} ${res.statusText}`)
    }
    else {
      const data = await res.json()
      const deployments = data.deployments || []
      const hit = deployments.find(
        deployment =>
          deployment.target === 'production'
          && deployment.readyState === 'READY'
          && (deployment.meta || {}).githubCommitSha === sha,
      )
      if (hit) return hit

      const mine = deployments.filter(deployment => (deployment.meta || {}).githubCommitSha === sha)
      const report = mine.length
        ? `commit build state: ${mine.map(deployment => deployment.readyState).join(', ')}`
        : `no production deployment for this commit yet (${deployments.length} seen)`
      if (report !== lastReport) {
        console.log(report)
        lastReport = report
      }
    }
    await sleep(15 * 1000)
  }
  throw new Error(`Deployment for commit ${sha} did not become READY within ${WAIT_MINUTES} min`)
}

async function main() {
  const domain = process.env.DOMAIN || 'gluke.ru'
  const teamId = process.env.TEAM_ID
  const base = process.env.NUXT_SITE_URL || `https://${domain}`

  console.log('Waiting for Vercel to finish the commit build...')
  const dep = await waitForCommitDeployment()
  const url = `https://${dep.url}`
  console.log(`Deployment ready: ${url} (${dep.readySubstate})`)

  console.log(`Pointing ${domain} -> ${url}`)
  await run(
    'npx',
    ['vercel', 'alias', 'set', url, domain, `--token=${process.env.VERCEL_TOKEN}`, `--scope=${teamId}`],
  )
  console.log(`Done: ${domain} now on ${url}`)

  console.log('Pinging IndexNow...')
  await run('node', ['scripts/indexnow.mjs'], {
    env: { ...process.env, NUXT_SITE_URL: base },
  })
  console.log('Post-deploy finished.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
