/**
 * Проверка файлов `content/` против zod-схем из `content.config.ts`.
 *
 * Зачем это нужно. Nuxt Content 3 использует схему коллекции только для двух
 * вещей: генерации типов и вывода типов колонок SQLite. Содержимое файлов
 * против схемы он не валидирует — данные попадают в базу как есть. Поэтому
 * ошибка в контенте проходит сборку молча и всплывает уже на странице.
 *
 * Реальный случай: строка `answer: Да: продуктовые анимации…`. Плоский скаляр
 * YAML не может содержать `": "`, поэтому парсер превратил ответ во вложенный
 * объект, а страница отрендерила его как `{ "Да": "…" }`. Схема объявляет
 * `answer: z.string()`, но проверить это было некому.
 *
 * Скрипт закрывает именно эту дыру: грузит те же самые zod-схемы (через
 * jiti + scripts/content-config-stub.mjs), читает файлы коллекций и прогоняет
 * их через `safeParse`. Ошибка — ненулевой код возврата и путь до поля.
 *
 * Использование: pnpm validate:content   (входит в pnpm check и в CI)
 */
import { glob, readFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { createJiti } from 'jiti'
import { parse as parseYaml } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const contentDir = join(root, 'content')

/* Поля, которые Nuxt Content добавляет сам при разборе файла (path/body и
   прочее). В самих файлах их нет, поэтому перед проверкой они дописываются
   заглушками — иначе обязательные поля страничных коллекций дадут ложную
   ошибку. Значения из файла всегда перекрывают заглушку. */
const GENERATED_PAGE_FIELDS = {
  path: '/generated',
  title: 'generated',
  description: 'generated',
  seo: {},
  body: { type: 'minimal', value: [] },
}

function firstLine(message) {
  return String(message).split(/\r?\n/)[0]
}

function collectIssues(error) {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join('.') : '(корень)'
    return `    ${path}: ${issue.message}`
  })
}

/* Frontmatter из .md: только блок между первой парой `---`. Тело документа
   схемой не описывается — его разбирает сам Nuxt Content. */
function readFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return match ? parseYaml(match[1]) : {}
}

/* content.config.ts грузится через jiti с подменой `@nuxt/content`: настоящий
   `defineCollection()` конвертирует zod в JSON Schema и исходную схему теряет,
   а нам нужна именно она. См. scripts/content-config-stub.mjs. */
async function loadCollections() {
  const jiti = createJiti(import.meta.url, {
    alias: { '@nuxt/content': join(root, 'scripts', 'content-config-stub.mjs') },
    interopDefault: true,
  })
  const configUrl = pathToFileURL(join(root, 'content.config.ts')).href
  const config = await jiti.import(configUrl, { default: true })

  return config.collections ?? {}
}

async function main() {
  const collections = await loadCollections()
  const failures = []
  let checked = 0

  for (const [name, collection] of Object.entries(collections)) {
    const source = typeof collection.source === 'string' ? collection.source : collection.source?.include
    if (!source || !collection.schema) {
      continue
    }

    for await (const entry of glob(source, { cwd: contentDir })) {
      const file = join(contentDir, entry)
      const shortPath = relative(root, file).split(sep).join('/')
      const raw = await readFile(file, 'utf8')
      checked += 1

      /* Сам YAML тоже может оказаться невалидным — например, плоский скаляр
         с `": "` внутри. Это ошибка того же класса, поэтому сообщение должно
         быть таким же понятным, как у нарушения схемы, а не стектрейсом. */
      let data
      try {
        data = entry.endsWith('.md') ? readFrontmatter(raw) : parseYaml(raw)
      }
      catch (error) {
        failures.push({
          file: shortPath,
          collection: name,
          issues: [`    YAML не разобран: ${firstLine(error.message)}`],
        })
        continue
      }

      const payload = collection.type === 'page' ? { ...GENERATED_PAGE_FIELDS, ...data } : data
      const result = collection.schema.safeParse(payload)
      if (!result.success) {
        failures.push({
          file: shortPath,
          collection: name,
          issues: collectIssues(result.error),
        })
      }
    }
  }

  if (failures.length) {
    console.error(`\n[validate:content] схема нарушена в ${failures.length} из ${checked} файлов:\n`)
    for (const failure of failures) {
      console.error(`  ${failure.file}  (коллекция «${failure.collection}»)`)
      console.error(failure.issues.join('\n'))
      console.error('')
    }
    process.exit(1)
  }

  console.log(`[validate:content] ${checked} файлов — схема соблюдена`)
}

await main()
