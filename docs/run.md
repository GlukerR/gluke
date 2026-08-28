# Run doc — GLUKE site (Nuxt 4)

Как поднять проект с нуля, запустить сервер и не наступить на грабли.
Канонический док (в git). `.freebuff/run.md` — рабочая копия для превью-харнеса
(только инструкции по запуску dev-сервера); полный текст — здесь.

## Воспроизведение артефактов (fresh checkout)

1. **Зависимости** — pnpm:
   ```bash
   pnpm install
   ```
   `postinstall` сам выполняет `nuxt prepare` (генерирует типы/маршруты).

2. **`.env`** — уже закоммичен и содержит только несекретные dev-значения:
   `NUXT_SITE_URL=http://localhost:3000`, `NUXT_SITE_NAME=GLUKE`, `NUXT_SITE_ENV=development`.
   Править не нужно для локального запуска.
   - `NUXT_SITE_ENV` управляет индексацией (`development`/`staging` — noindex,
     `production` — индексация разрешена). В проде (Vercel) ставится `production`.
   - Для честных замеров (Lighthouse, og/twitter/hreflang с реальным доменом)
     превью-сервер поднимается с `NUXT_SITE_ENV=production NUXT_SITE_URL=http://127.0.0.1:3000`.

3. **Контент** — в `content/projects/{ru,en}/*.md` (кейсы на двух языках), медиа
   в `public/media/`. Отдельной сборки не требует — подхватывается при сборке
   (`nuxt build`) или в dev-режиме.

4. Dev/build выходы (`.nuxt`, `.nuxt-build`, `.nuxt-typecheck`, `.output`, `.data`)
   регенерируются автоматически и в git не идут.

## Запуск сервера

Порт по умолчанию — **3000**.

### Dev-сервер (для разработки)

```bash
pnpm dev
```

Перезапуск раздувшегося dev-сервера (лечит утечку памяти, см. ниже):

```bash
pnpm restart:dev
```

Windows (detached, переживает конец сессии), stdout и stderr в **разные** файлы:

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList 'node_modules/nuxt/bin/nuxt.mjs','dev','--port','3000','--host','127.0.0.1' -WorkingDirectory 'D:\Work\WEB\gluke-master' -RedirectStandardOutput '<log>' -RedirectStandardError '<log>.err' -WindowStyle Hidden -PassThru).Id"
```

Замечания по запуску:
- Использовать `node.exe node_modules/nuxt/bin/nuxt.mjs` напрямую (Start-Process
  не резолвит npm/pnpm-шимы).
- **Обязательно `--host 127.0.0.1`**: без него Nuxt биндится на IPv6 `[::1]`,
  и превью-харнес не достанет сервер.
- Обёртка `Start-Process` держит хендл перенаправления — команда может «висеть»
  в терминале; сервер при этом запущен. Проверка: `Get-Process -Id <pid>` и
  `netstat -ano | grep ":3000 "`.
- Проверка ответа: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/` → `200`.
  Первый запрос после холодного старта долгий (~19 с — компиляция, см. «Cold start»).
- Маршруты: EN — локаль по умолчанию без префикса (`/projects/m1-group`),
  RU — `/ru/projects/m1-group`.

### Прод-сборка (используется для превью и Lighthouse)

```bash
pnpm build
node .output/server/index.mjs
```

Windows (detached):

```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList '.output/server/index.mjs' -WorkingDirectory 'D:\Work\WEB\gluke-master' -RedirectStandardOutput 'D:\Work\WEB\gluke-master\.freebuff\preview.log' -RedirectStandardError 'D:\Work\WEB\gluke-master\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

Проверка: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ru` → `200`.

Замечания по превью:
- Превью-сервер **не сжимает** ответы (gzip/brotli на Vercel добавляет сам хостинг) —
  замеры FCP в превью пессимистичнее прода.
- Контент (кейсы) зашивается в сборку: после правки `content/**` нужен `pnpm build` + рестарт.

## Команды (шпаргалка)

| Команда | Что делает |
| --- | --- |
| `pnpm dev` | Dev-сервер на :3000 |
| `pnpm restart:dev` | Перезапуск dev-сервера: стоп процесса по порту + свежий detached (`scripts/restart-dev.mjs`). Надёжный фикс утечки памяти |
| `pnpm build` | Полная production-сборка (как на Vercel): typecheck + бандл + prerender → `.nuxt-build` и `.output` |
| `pnpm generate` | Статическая генерация: все маршруты в `.output/public`. Та же изоляция `.nuxt-build` |
| `pnpm typecheck` | Изолированный vue-tsc (`scripts/typecheck.mjs`, `.nuxt-typecheck`) — быстрая проверка перед деплоем |
| `pnpm lint` / `pnpm lint:fix` | ESLint (автофикс через `lint:fix`) |
| `pnpm check` | `lint` + `typecheck` + `build` — всё, что гоняет CI |

Заметки:
- Все проверки безопасны при работающем dev-сервере: прод-сборка идёт в
  `.nuxt-build`, typecheck — в `.nuxt-typecheck`, dev их не трогает.
- Не нужно `rm -rf .nuxt` перед сборкой; если удалил — обёртка сама пересоздаст
  через `nuxt prepare`.
- CI гоняет все три проверки на каждый push; Vercel деплоит тот же `pnpm build`.

## Контент

- Текст сайта (hero, услуги, процесс, о студии, цены, цифры, аудитории):
  `content/site/{ru,en}.yml`.
- Кейсы: `content/projects/{ru,en}/*.md` (front-matter по `content.config.ts`).
- UI-подписи/заголовки: `i18n/locales/{ru,en}.ts`.

## Build gotchas (инцидент Vercel 2026-08-28)

### Почему сборка Vercel падала с `proof: string[]` (TS2339)

Коммит `4626957` (у услуг `proof` стал объектами `{ label, slug? }` вместо строк)
локально собирался, но на Vercel падал: встроенный typecheck (`vue-tsc` через
`vite-plugin-checker`) сообщал `Property 'label' does not exist on type 'string'` —
то есть видел СТАРУЮ схему. Закоммиченная схема была верной (тот же коммит чисто
собирается локально).

Цепочка причин:

1. В `package.json` есть `"postinstall": "nuxt prepare"`, а Vercel запускает
   install при каждой сборке. `nuxt prepare` создаёт корневой `.nuxt`.
2. Nuxt 4.5 (`@nuxt/kit` `loadNuxt`) автоматически переключает build-dir: если
   корневой `.nuxt` уже существует на старте `nuxt build`, каталог сборки
   переносится в `node_modules/.cache/nuxt/.nuxt` (условие `existsSync(defaultBuildDir)`
   в `@nuxt/kit`).
3. Vercel восстанавливает `node_modules` между сборками из своего кэша. Поэтому
   build-dir `node_modules/.cache/nuxt/.nuxt` приходит из ПРОШЛОЙ сборки — вместе
   со сгенерированными типами контента (`content/types.d.ts`), базой контента и
   инкрементальным состоянием vue-tsc (`tsconfig.*.tsbuildinfo`). При изменении
   схемы устаревшее состояние типов протекает в typecheck.
4. Локально это не воспроизводилось: свежий checkout не имеет восстановленного
   node_modules, а контент-модуль перекомпилирует типы из актуальной схемы при
   каждой сборке.

### Фикс (коммит `50d3a61`)

- `vercel.json` теперь чистит кэш Nuxt внутри node_modules перед сборкой:
  `rm -rf node_modules/.cache/nuxt && pnpm build`. Каждая сборка Vercel стартует
  с чистого состояния Nuxt (без устаревших типов/базы/tsbuildinfo).
- `HomeServices.vue` больше не выводит тип props из сгенерированного
  `SiteCollectionItem['services']`: используются явные типы из
  `app/utils/home-services.ts`, а `app/pages/index.vue` передаёт их через
  документированный каст. Даже если сгенерированные типы снова устареют,
  сборка на них не упадёт.

### Локальное падение `pnpm build` на prerender под Windows: РАБОТАЮЩИЙ DEV-СЕРВЕР

Симптом: `pnpm build` падает сразу после «Initializing prerenderer» с
`createRequire: The argument 'filename' must be ... Received 'file:///_entry.js'`.

Причина (проверено 2026-08-28): dev-сервер засоряет общий корневой `.nuxt`
dev-шаблонами. `@nuxt/icon` генерирует `nuxt-icon-server-bundle.mjs` с
`const require = createRequire(import.meta.url)` только когда
`isBundling = !nuxt.options.dev` — то есть в DEV. Когда прод-`nuxt build` затем
бандлит этот dev-шаблон, nitro-плагин `import-meta` заменяет `import.meta.url`
на плейсхолдер `"file:///_entry.js"` в не-entry чанке prerender, и
`createRequire('file:///_entry.js')` падает на Windows (не абсолютный путь).

Срабатывает только при совпадении ДВУХ условий: корневой `.nuxt` удалён
(`rm -rf .nuxt`) И работает dev-сервер (он переписывает свои dev-шаблоны в
`.nuxt`). Ни расположение build-dir, ни Node 24 тут ни при чём.

**Фикс (коммит `7bfa9a6`):** `pnpm build` и `pnpm generate` идут через
`scripts/nuxt-run.mjs`, который запускает production-сборку в изолированном
`.nuxt-build` (dev-сервер его не трогает) — dev-шаблоны физически не могут
протечь в прод-бандл. Если корневой `.nuxt` отсутствует, обёртка сначала
выполняет `nuxt prepare` (встроенный typecheck читает корневой `tsconfig.json`
→ `.nuxt/tsconfig.*`).

## Dev server memory bloat (почему тормозит со временем)

Симптом: после долгой dev-сессии (часы, много правок) страницы грузятся
медленно. Причина: процесс dev-сервера копит RAM — измерено до 4.7–5.0 ГБ RSS
(против ~2 ГБ свежего), паузы GC задерживают каждый запрос.

Что измерено (2026-08-28, `--inspect` + heap-снимки, инструменты в
`.freebuff/tools/`):

- Свежий dev-сервер после прогрева: **~2.0 ГБ RSS** (V8 heap ~0.5 ГБ,
  external ~70 МБ; остальное — native/worker память).
- 100 запросов страниц (все 16 кейсов × RU/EN × 3): **+~200 МБ** — vite-граф
  модулей + контент-БД; ограничено, незначительно.
- 10 правок файлов (HMR + перепроверка): **+2.7 ГБ** — главная утечка.
- V8 heap главного изолята всё время 300–600 МБ → рост живёт ВНЕ него.

Причина: `typescript.typeCheck: true` заставлял Nuxt запускать **vue-tsc внутри
dev-сервера** (vite-plugin-checker, воркер-поток). При каждой правке чекер
пересобирает полную TS-программу (`vue-tsc --build`), память воркера копится
без освобождения. Статичная стоимость чекера ~1 ГБ, дальше растёт без
ограничений при редактировании.

Рекомендации:

1. **Периодически перезапускать dev-сервер** — единственный надёжный сброс:
   `pnpm restart:dev` (убивает процесс на порту и поднимает свежий detached,
   дожидаясь ответа). После тяжёлых сессий правок или когда страницы стали
   «вязкими».
2. **Dev-time typecheck отключён** (коммит `4d34d14`):
   `$development: { typescript: { typeCheck: false } }`. Безопасность типов не
   теряется: `pnpm typecheck`, CI-джоб typecheck и `nuxt build` (NODE_ENV=production)
   по-прежнему гоняют vue-tsc; убран только dev-вотчер.
3. Опционально: `devtools: { enabled: false }` в dev, если UI DevTools не нужен —
   он тоже держит состояние и добавляет оверхед.
4. Не делать `rm -rf .nuxt` при работающем dev-сервере — сервер держит
   устаревшие кэши модулей в памяти и перекомпилирует с нуля.

Прод не затронут: Vercel собирает в чистом контейнере, typecheck в сборке
выполняется один раз, а не в watch-режиме.

Инструменты расследования (лежат в `.freebuff/tools/`, в git не идут):
- `mem-probe.mjs [port]` — RSS/heap/external сервера через --inspect.
- `heap-snapshot.mjs out.heapsnapshot [port]` — CDP heap-снимок.
- `heap-analyze.mjs file.heapsnapshot` — топ объектов/строк по типам.
Использование: запустить сервер с `node --inspect=9229 node_modules/nuxt/bin/nuxt.mjs dev ...`.

## Dev server cold start (измерено 2026-08-28)

Таймлайн от спавна до первого ответа главной (Windows, тёплые кэши
vite/node_modules):

- сервер готов (нитро собран): ~14 с (boot модулей + контент ~2.7 с + плагины
  ~0.9 с + пребандл `optimizeDeps` + нитро-билд ~5 с);
- не-Vue маршрут (`/robots.txt`) отвечает мгновенно, как только нитро готов;
- первая SSR-компиляция главной (vite on-demand transform дерева страницы):
  ~4.5 с → **первый 200 на ~19 с** (было ~27 с с vue-tsc-вотчером).

Рычаги, применённые в `4d34d14`:
- `$development.typescript.typeCheck: false` — убирает vue-tsc-воркер (помогает
  памяти при правках; выигрыш на старте небольшой — вотчер пересекался с
  остальным boot'ом);
- `vite.optimizeDeps.include` для three и его загрузчиков — пребандлятся при
  старте, чтобы первый заход на страницу с 3D не триггерил on-demand-оптимизацию
  и перезагрузку страницы.

Пробовано и откачено: `vite.server.warmup` (глобы ssr/client файлов) — перенёс
~2.4 с в boot, сняв с первого SSR-рендера лишь ~1 с; итог отрицательный.
Оставшиеся ~14 с boot — загрузка модулей и нитро-пересборки (модульно-управляемые,
бороться не стоит); ~4.5 с первой SSR-компиляции — природа Vite dev
(on-demand transform). Если когда-нибудь понадобится радикально быстрее —
постоянный кэш трансформаций Vite или эквиваленты `nuxt dev --prerender`,
вне текущего скоупа.
