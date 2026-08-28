/**
 * Перезапуск dev-сервера: останавливает процесс, слушающий порт (по умолчанию
 * 3000), и запускает новый отвязанным процессом — ровно по рецепту из
 * .freebuff/run.md («Run the server»). Нужен, потому что долгоживущий Nuxt
 * dev-сервер копит память (см. секцию «Dev server memory bloat» в docs/run.md)
 * и единственный надёжный сброс — перезапуск.
 *
 * Использование: pnpm restart:dev   (порт можно переопределить: PORT=3001 pnpm restart:dev)
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, openSync, closeSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
/* PORT=0/пустое из окружения (терминал иногда ставит PORT=0) — не порт,
   а плейсхолдер: игнорируем и берём дефолт. */
const PORT = process.env.PORT && process.env.PORT !== '0' ? process.env.PORT : '3000'
const HOST = process.env.HOST || '127.0.0.1'
const isWin = process.platform === 'win32'

const nuxtBin = join(root, 'node_modules', 'nuxt', 'bin', 'nuxt.mjs')
const logDir = join(root, '.freebuff')
const logOut = join(logDir, 'dev.log')
const logErr = join(logDir, 'dev.log.err')
const START_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 1_500

function run(cmd, args) {
  const res = spawnSync(cmd, args, { encoding: 'utf8' })
  return { code: res.status, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

/* PID'ы процессов, слушающих порт. Windows — netstat, POSIX — lsof.
   netstat парсим строго по колонке локального адреса (TCP 127.0.0.1:3000 /
   TCP [::]:3000), иначе `:0`-подобные подстроки цепляют чужие строки. */
function pidsOnPort(port) {
  if (isWin) {
    const { stdout } = run('netstat', ['-ano'])
    const pids = new Set()
    /* Только слушающие сокеты: локальный адрес :port + состояние LISTENING.
       Колонки netstat: TCP | локальный | foreign | LISTENING | PID.
       TIME_WAIT/ESTABLISHED с PID 0 (якорные сокеты) отсекаем. */
    const re = new RegExp(`^\\s*(TCP|UDP)\\s+(\\[[0-9a-f:]+\\]|[0-9.]+):${port}\\s+\\S+\\s+LISTENING\\s+(\\d+)\\s*$`, 'i')
    for (const line of stdout.split(/\r?\n/)) {
      const m = line.match(re)
      if (m && m[3] && m[3] !== '0') pids.add(m[3])
    }
    return [...pids]
  }
  const { stdout } = run('lsof', ['-ti', `tcp:${port}`])
  return stdout.split(/\r?\n/).filter(Boolean)
}

function killPid(pid) {
  if (isWin) {
    return run('powershell', ['-NoProfile', '-Command', `Stop-Process -Id ${pid} -Force`]).code === 0
  }
  return run('kill', ['-9', pid]).code === 0
}

function waitPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (pidsOnPort(port).length === 0) return true
    /* Небольшая пауза без блокировки цикла: setTimeout в while нет смысла,
       используем Atomics.wait для реальной задержки. */
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300)
  }
  return pidsOnPort(port).length === 0
}

/* Отвязанный старт: Node detached-spawn на обеих ОС (stdout и stderr в РАЗНЫЕ
   файлы). На Windows detached создаёт отдельную группу процессов без консоли;
   ребёнок переживает выход родителя. PowerShell Start-Process из run-дока
   годится для интерактивного запуска, но при вызове из другого процесса его
   обёртка держит хендл перенаправления и «висит» — поэтому здесь он не нужен. */
function startDetached() {
  mkdirSync(logDir, { recursive: true })
  const out = openSync(logOut, 'a')
  const err = openSync(logErr, 'a')
  const child = spawn(process.execPath, [nuxtBin, 'dev', '--port', PORT, '--host', HOST], {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, err],
  })
  child.unref()
  closeSync(out)
  closeSync(err)
  return child.pid ?? null
}

async function waitHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5_000) })
      if (res.ok) return true
    }
    catch {
      /* Сервер ещё не поднялся — пробуем снова. */
    }
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
  }
  return false
}

/* ── 1. Остановить старый dev-сервер на порту ─────────────────────────── */
const oldPids = pidsOnPort(PORT)
if (oldPids.length > 0) {
  console.log(`[restart:dev] stopping old dev server on :${PORT} (pid${oldPids.length > 1 ? 's' : ''} ${oldPids.join(', ')})`)
  for (const pid of oldPids) {
    if (!killPid(pid)) {
      console.error(`[restart:dev] failed to kill pid ${pid}`)
      process.exit(1)
    }
  }
  if (!waitPortFree(PORT, 10_000)) {
    console.error(`[restart:dev] port :${PORT} still busy after stop`)
    process.exit(1)
  }
}
else {
  console.log(`[restart:dev] nothing listening on :${PORT}, starting fresh`)
}

/* ── 2. Запустить новый отвязанным ────────────────────────────────────── */
const pid = startDetached()
if (!pid) {
  console.error('[restart:dev] failed to start the dev server')
  process.exit(1)
}
console.log(`[restart:dev] started dev server, pid ${pid} → http://${HOST}:${PORT}/`)

/* ── 3. Дождаться ответа (первая компиляция долгая) ───────────────────── */
const ok = await waitHttp(`http://${HOST}:${PORT}/`, START_TIMEOUT_MS)
if (!ok) {
  console.error(`[restart:dev] server did not answer within ${START_TIMEOUT_MS / 1000}s — see ${logErr}`)
  process.exit(1)
}
console.log(`[restart:dev] server is up (pid ${pid}). Logs: ${logOut}`)
