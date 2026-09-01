/*
 * Post-deploy: сообщает поисковикам, что страницы обновились.
 *
 * 1. Ждёт, пока деплой текущего коммита станет успешным.
 * 2. Пингует IndexNow (scripts/indexnow.mjs).
 *
 * Готовность деплоя читается из GitHub Deployments API, а не из API Vercel:
 * git-интеграция Vercel сама заводит в GitHub deployment на каждый коммит и
 * проставляет ему статус. Хватает встроенного GITHUB_TOKEN — отдельный токен
 * Vercel не нужен, а значит нечему протухать и ронять шаг.
 *
 * Домен здесь намеренно не переставляется: production-алиас Vercel назначает
 * сам при деплое из master. Прежняя реализация делала это через `vercel alias
 * set`, требовала токен и, когда токен перестал действовать, забирала с собой
 * и пинг IndexNow — полезное действие оказывалось заложником лишнего.
 *
 * Параметры из env: GITHUB_TOKEN, GITHUB_REPOSITORY, GITHUB_SHA, NUXT_SITE_URL.
 */
import { spawn } from 'node:child_process'

const WAIT_MINUTES = 20
const POLL_SECONDS = 15
const ENVIRONMENT = 'Production'

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

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      'authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
      'accept': 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
    },
  })
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} on ${path}`)
  }
  return res.json()
}

/* Возвращает состояние деплоя коммита: 'success', 'failure' или null, если
   деплой ещё не заведён или не досчитан. */
async function deploymentState(repo, sha) {
  const deployments = await api(
    `/repos/${repo}/deployments?sha=${encodeURIComponent(sha)}&environment=${ENVIRONMENT}`,
  )
  if (!deployments.length) {
    return null
  }

  for (const deployment of deployments) {
    const [latest] = await api(`/repos/${repo}/deployments/${deployment.id}/statuses?per_page=1`)
    if (!latest) {
      continue
    }
    if (latest.state === 'success') {
      return { state: 'success', url: latest.environment_url }
    }
    if (latest.state === 'failure' || latest.state === 'error') {
      return { state: 'failure', url: latest.environment_url }
    }
  }
  return null
}

async function waitForDeployment(repo, sha) {
  const deadline = Date.now() + WAIT_MINUTES * 60 * 1000
  let lastReport = ''

  while (Date.now() < deadline) {
    const result = await deploymentState(repo, sha)

    if (result?.state === 'success') {
      return result
    }
    if (result?.state === 'failure') {
      throw new Error(`Vercel reported a failed deployment for ${sha}`)
    }

    /* Молчащий цикл ожидания уже однажды скрыл настоящую причину падения,
       поэтому состояние проговаривается — но только когда оно меняется. */
    const report = result ? 'deployment in progress' : 'no deployment for this commit yet'
    if (report !== lastReport) {
      console.log(report)
      lastReport = report
    }
    await sleep(POLL_SECONDS * 1000)
  }

  throw new Error(`Deployment for commit ${sha} did not succeed within ${WAIT_MINUTES} min`)
}

async function main() {
  const repo = process.env.GITHUB_REPOSITORY
  const sha = process.env.GITHUB_SHA
  const base = process.env.NUXT_SITE_URL || 'https://gluke.ru'

  console.log(`Waiting for the ${ENVIRONMENT} deployment of ${sha}...`)
  const deployment = await waitForDeployment(repo, sha)
  console.log(`Deployment ready: ${deployment.url ?? '(url not reported)'}`)

  console.log('Pinging IndexNow...')
  const output = await run('node', ['scripts/indexnow.mjs'], {
    env: { ...process.env, NUXT_SITE_URL: base },
  })
  console.log(output)
  console.log('Post-deploy finished.')
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
