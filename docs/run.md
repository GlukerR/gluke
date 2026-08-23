# Run doc — GLUKE site (Nuxt 4)

Как поднять проект с нуля и запустить сервер. Канонический док; `.freebuff/run.md` — указатель на него.

## Воспроизведение артефактов (fresh checkout)

1. **Зависимости** — pnpm:
   ```bash
   pnpm install
   ```
   `postinstall` сам выполняет `nuxt prepare` (генерирует типы/маршруты).

2. **`.env`** — уже закоммичен и содержит только несекретные dev-значения:
   `NUXT_SITE_URL=http://localhost:3000`, `NUXT_SITE_NAME=GLUKE`, `NUXT_SITE_ENV=development`.
   Править не нужно для локального запуска.
   - `NUXT_SITE_ENV` управляет индексацией (`development`/`staging` — noindex, `production` — индексация разрешена). В проде (Vercel) ставится `production`.
   - Для честных замеров (Lighthouse, og/twitter/hreflang с реальным доменом) превью-сервер поднимается с `NUXT_SITE_ENV=production NUXT_SITE_URL=http://127.0.0.1:3000`.

3. **Контент** — в `content/projects/{ru,en}/*.md` (кейсы на двух языках), медиа в `public/media/`. Отдельной сборки не требует — подхватывается при сборке (`nuxt build`) или в dev-режиме.

## Запуск сервера

Порт по умолчанию — **3000**.

### Dev-сервер (для разработки)
```bash
pnpm dev
```

### Прод-сборка (используется для превью и Lighthouse)
```bash
pnpm build
node .output/server/index.mjs
```

Windows (detached, переживает конец сессии), stdout и stderr в разные файлы:
```powershell
powershell -NoProfile -Command "(Start-Process -FilePath 'node.exe' -ArgumentList '.output/server/index.mjs' -WorkingDirectory 'D:\Work\WEB\gluke-master' -RedirectStandardOutput 'D:\Work\WEB\gluke-master\.freebuff\preview.log' -RedirectStandardError 'D:\Work\WEB\gluke-master\.freebuff\preview.log.err' -WindowStyle Hidden -PassThru).Id"
```

Проверка: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/ru` → `200`.

Замечания:
- Превью-сервер **не сжимает** ответы (gzip/brotli на Vercel добавляет сам хостинг) — замеры FCP в превью пессимистичнее прода.
- Контент (кейсы) зашивается в сборку: после правки `content/**` нужен `pnpm build` + рестарт.
