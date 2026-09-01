# Справочник разработчика — GLUKE

Единая точка входа по коду сайта. Собран из `README.md`, `CASE_TEMPLATE.md`,
`docs/content-decisions.md` и практики разработки. Если документ противоречит
фактам в коде — код главнее; обнови этот файл.

---

## 1. Стек и требования

- **Nuxt 4** (`app/`-структура), **Vue 3 Composition API**, **TypeScript** (strict, `typeCheck`).
- **Nuxt UI 4** (включает Tailwind CSS) — компоненты и токены тем.
- Модули: `@nuxt/content` (Markdown/yml → SQLite, коннектор `better-sqlite3`),
  `@nuxt/image`, `@nuxt/fonts` (Manrope), `@nuxtjs/i18n`, `@nuxtjs/robots`,
  `@nuxtjs/sitemap`, `nuxt-schema-org`.
- **ESLint** flat config + ESLint Stylistic: 2 пробела, одинарные кавычки, без `;`.
- 3D: `three` + `@types/three` (вьювер — `ProjectModelViewer.vue`).
- Node ≥ 22 (`.nvmrc`), pnpm (packageManager `pnpm@11.18.0`).

## 2. Команды

```bash
pnpm dev          # dev-сервер (по умолчанию :3000; на этой машине принято :52972)
pnpm build        # прод-сборка
pnpm generate     # статическая генерация
pnpm preview      # превью прод-сборки
pnpm lint         # ESLint
pnpm lint:fix     # ESLint autofix
pnpm typecheck    # nuxt typecheck (vue-tsc)
pnpm check        # lint + typecheck + build
```

Запуск с портом: `pnpm dev --port 52972`.

> ⚠️ Не запускай два `pnpm dev` одновременно: оба делят
> `.data/content/contents.sqlite` и могут её сломать (страницы → 500).

## 3. Структура проекта

```
app/
  components/          Vue SFC, автоимпорт (префикс = имя папки)
    home/              секции главной (HomeHero, HomeProjects, …)
    projects/          кейсы (ProjectCard, ProjectDetail*, ProjectMedia*, ProjectModelViewer)
    site/              каркас (SiteHeader, SiteFooter, SiteThemeToggle, …)
  pages/               index.vue, projects/index.vue, projects/[slug].vue
  assets/css/main.css  глобальные стили и токены тем (--site-*)
  layouts/, composables/, config/, utils/
content/
  projects/{ru,en}/    кейсы (Markdown + frontmatter)
  site/{ru,en}.yml     глобальный контент сайта
content.config.ts      Zod-схемы коллекций (projects, site)
i18n/locales/{ru,en}.ts  строки интерфейса
public/                ЕДИНСТВЕННАЯ папка, отдаваемая наружу статикой
scripts/               typecheck.mjs, скрипты PNG/EXIF
server/                api/__sitemap__/urls.ts, middleware/locale-redirect.ts
docs/                  ВНУТРЕННЯЯ документация (наружу не отдаётся!)
CASE_TEMPLATE.md       ВНУТРЕННИЙ шаблон кейсов (наружу не отдаётся!)
```

## 4. Как устроен сайт

- **Главная** (`app/pages/index.vue`) собирает секции из `app/components/home/*`,
  контент — из `content/site/{ru,en}.yml` (hero, about, services, stats, process).
- **Список проектов** (`projects/index.vue`) — карточки `ProjectCard`,
  данные из коллекции `projects` (`content/projects/*.md`).
- **Кейс** (`projects/[slug].vue`) — hero (`ProjectDetailHero`), метрики и услуги
  (`ProjectDetailOverview`/`ProjectDetailScope`), галерея (`ProjectMediaGallery`
  + `ProjectMediaItem`), переходы (`ProjectPager`).
- **i18n**: EN — без префикса (дефолт), RU — под `/ru`
  (`strategy: prefix_except_default`). Строки — `i18n/locales/*.ts`,
  `baseUrl` — из `NUXT_SITE_URL`.
- **Темы**: `@nuxt/ui` + Nuxt Color Mode; тёмная по умолчанию.
  Токены и переходы — в `app/assets/css/main.css`.

### Автоимпорт компонентов (важно!)

Nuxt автоимпортирует SFC, **добавляя префикс из имени папки**:

- `app/components/site/SiteHeader.vue` → `<SiteHeader>`
- `app/components/projects/ProjectCard.vue` → `<ProjectsProjectCard>`
- `app/components/projects/ProjectModelViewer.vue` → `<ProjectsProjectModelViewer>`

Ссылаться на компонент без префикса (`<ProjectModelViewer>`) — тихая ошибка:
компонент не рендерится. При создании файла сверь имя в шаблоне.

## 5. Контент: кейсы

Схема — `content.config.ts` (коллекция `projects`), поля описаны в
`CASE_TEMPLATE.md`. Основное:

- Один кейс = **два файла**: `content/projects/ru/<slug>.md` и `en/<slug>.md`.
- Медиа — в `public/media/projects/<slug>/`; папка `public/` отдаётся
  статикой, поэтому новые файлы попадают в прод автоматически.
- Поля: `title`, `description`, `client`, `industry`, `categories`
  (`orgtech|industrial|furniture|gameready`), `position` (новый кейс — последним),
  `featured`, `status`, `period`, `engagement`, `services` (первые 2 — на карточке
  главной, самые продающие), `metrics` (ровно 3), `cover` (16:9,
  1680×945, JPEG ≤200 КБ), `media`, опционально `model` (3D).
- `## Задача / Ход работы / Результат` выводятся на странице кейса: первый абзац
  «Задачи» стоит рядом с услугами, остальное — в свёрнутом блоке «Подробнее о
  проекте» (`app/utils/project-story.ts` делит тело, дублирования нет).
- Поля `about` больше нет: оно дублировало «Задачу» и удалено из схемы и кейсов.

### 3D-модель в кейсе (`model:`)

```yaml
model:
  src: /media/projects/softlogic/sc-imvs-rm3-model-01.glb
  alt: '…'
  width: 1680
  height: 945
  autoRotate: true          # автоповорот (по умолчанию true)
  emissivePulse: 5          # макс. интенсивность пульсации свечения (дефолт 5)
  emissivePulseHz: 0.7      # частота пульсации, Гц (дефолт 0.7)
  metalness: 0.88           # множитель металличности (дефолт 0.88)
  diffuseLift: 30           # подъём «чёрного» диффузной текстуры (дефолт 30)
  rotation: 180             # разворот модели вокруг Y, градусы (дефолт 0)
  autoRotateSpeed: 1.2      # скорость автоповорота (дефолт 1.2)
  environmentIntensity: 0.5 # интенсивность студийного окружения (дефолт 0.5)
  hemisphereLight: 0.5      # полусфера (дефолт 0.5)
  keyLight: 0.8             # ключевой свет (дефолт 0.8)
  fillLight: 0.4            # мягкая подсветка (дефолт 0.4)
```

Параметры вьювера — **данные, а не код**: движок один
(`ProjectModelViewer.vue`), каждая модель переопределяет дефолты через
frontmatter. Требования к моделям (GLB, Draco, WebP-текстуры ≤2K, локализация
всех файлов) — в `docs/3d-viewer-spec.md` §5.

## 6. Как менять сайт (общий порядок)

1. **Тексты/кейсы** → правки в `content/**`, `i18n/locales/*.ts`. HMR, сервер
   перезапускать не нужно.
2. **Стили** → `app/assets/css/main.css` (токены `--site-*`, темы).
3. **Схема контента** → `content.config.ts`. ⚠️ После правок схемы **сервер надо
   перезапускать**; правки только в `content/` подхватываются горячо.
4. **Компоненты/логика** → SFC в `app/components/`, утилиты в `app/utils/`,
   `app/composables/`. Проверяй автоимпорт (см. §4).
5. **Новые медиа** → кладём файл в `public/media/…` — папка `public/` отдаётся
   статикой, дополнительная синхронизация не нужна.
6. После изменений: `pnpm lint` и `pnpm typecheck` — чисто. Перед продом —
   `pnpm build`.

### Известные подводные камни

- **Кэш контента** иногда слетает (пустая страница/старое содержимое):
  `rm -rf .data/content` + перезапуск dev-сервера.
- **Двоеточие в `alt` ломает YAML**: бери строку в кавычки.
- **PNG с битым EXIF** не читается ffmpeg — используй ImageMagick.
- **`canvas { max-width: 100% }`** в глобальных стилях режет размер канваса
  WebGL: у вьювера в scoped-стилях должен быть `max-width: none`.
- Канвас добавляется в DOM через JS и не получает `data-v-xxx`: opacity
  вьювера управляется из JS (`attachViewer`/`detachViewer`), а не scoped-CSS.

---

## 7. 🚨 Что никогда не должно попасть в открытый доступ

**Папка `public/` — единственное, что сайт отдаёт наружу.** Всё остальное
в репозитории — внутреннее. Ничего из перечисленного ниже нельзя:

- класть в `public/`;
- ссылаться с сайта (URL, `<img>`, `fetch`, прелоады);
- упоминать/раскрывать в кейсах, текстах и карточках;
- поститься в публичные репозитории/гитхаб.

### Запрещённые к публикации пути и данные

| Путь / данные | Почему опасно |
|---|---|
| `docs/**` | Внутренние ТЗ, планы, инвентарь — рабочие мысли, не для посетителей |
| `docs/content-decisions.md` | **Особо секретно**: цены (бюджет 30 000 ₽, нижняя граница 10 000 ₽), внутренние имена, правила, что нельзя публиковать. Само существование этих цифр — внутренняя информация |
| `docs/3d-viewer-spec.md`, `docs/backlog.md`, `docs/changes-log.md` и др. | Рабочая документация и история решений |
| `CASE_TEMPLATE.md` | Внутренний шаблон с правилами и чек-листами |
| `README.md` (опционально) | Технические детали для разработчика, не для публики |
| `.freebuff/` | Логи dev-сервера, логи превью, `run.md`, `project-id`, БД диалогов (`desktop-v2.db*`) — **все разговоры о сайте**, чувствительно |
| `.data/`, `.nuxt/`, `.output/`, `.cache/`, `.vite/` | Сборки и кэш контента (внутри может лежать содержимое всех страниц) |
| `logs/`, `*.log`, `dev-server.log` | Логи с путями, ошибками и деталями |
| `.env*` (кроме `.env.example`) | Секреты и конфигурация |
| `node_modules/`, `.pnpm-store/` | Зависимости (не публиковать вручную) |
| Личные переписки, внутренние имена, платежи, споры | Полный список запрещённого контента — `docs/content-decisions.md` §8 |

### Как это обеспечено технически

- **Nuxt отдаёт наружу только `public/`.** Проверено: `/docs/…`, `/CASE_TEMPLATE.md`,
  `/README.md`, `/nuxt.config.ts`, `/content.config.ts`, `/.env` → все 404.
  Внутренние файлы не попадают на сайт сами по себе — опасно только сознательно
  положить их в `public/`.
- **`.freebuff/` (логи, БД диалогов, `run.md`) игнорируется git** корневым
  `.gitignore` (репозиторий лежит на уровень выше папки сайта).
- **`docs/` и `CASE_TEMPLATE.md`** лежат в папке сайта и в git — это внутренняя
  документация для разработчика. В публичный репозиторий их пушить нельзя
  (см. правила ниже).

### Правила на будущее

- **Новые внутренние документы** (мысли, ТЗ, планы, обсуждения) класть **вне
  `public/`**: в `docs/` или вообще вне папки сайта. Не ссылаться на них из кода.
- **Разговоры/правила работы** (типа этого диалога) — **не привязывать к сайту**:
  не класть в `public/`, не линковать, не цитировать в контенте.
- Перед деплоем/публикацией репозитория прогонять чек: ничего из таблицы выше
  не попало в `public/` или в коммит.
- Если нужен «открытый» вариант документа — создавать его отдельно
  (например, стандарт 3D для клиентов в `docs/3d-viewer-spec.md` §5 уже
  частично публичный), не переиспользуя внутренний файл.
