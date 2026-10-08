/**
 * Генерация `public/llms.txt` из контента.
 *
 * llms.txt читают ИИ-краулеры — это единственный файл сайта, написанный прямо
 * для них. Он вёлся руками и разошёлся с кейсами: обещал «14+ AR models» у
 * M1 GROUP (таких работ не было), «60+ models» у HARDI против 50+ и «7
 * radiators» у Кливет против 15. Файл, специально предназначенный для машин,
 * выдавал цифры, которых нет на самом сайте.
 *
 * Поэтому он собирается из тех же файлов, что и страницы: разойтись больше
 * нечему. Запускается перед `nuxt build` (см. package.json), то есть
 * пересобирается и на Vercel при каждом деплое.
 *
 * Там же собираются markdown-версии статей базы знаний —
 * `public/knowledge/<slug>.md` (EN) и `public/ru/knowledge/<slug>.md` (RU):
 * адрес статьи плюс `.md`, как советует спецификация llms.txt. Агенту не нужно
 * разбирать вёрстку — он получает тот же текст, что и читатель, со схемами,
 * описанными словами. Туда же — глоссарий (`/knowledge/glossary.md`,
 * `/ru/knowledge/glossary.md`). Файлы генерируемые и в git не идут
 * (.gitignore).
 *
 * Использование: pnpm llms
 */
import { glob, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = 'https://gluke.ru'
const OUT = join(root, 'public', 'llms.txt')

function frontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  return match ? parseYaml(match[1]) : {}
}

async function readSite(locale) {
  return parseYaml(await readFile(join(root, 'content', 'site', `${locale}.yml`), 'utf8'))
}

async function readProjects() {
  const projects = []
  for await (const entry of glob('content/projects/en/*.md', { cwd: root })) {
    const data = frontmatter(await readFile(join(root, entry), 'utf8'))
    if (data.status === 'published') {
      projects.push(data)
    }
  }
  return projects.sort((a, b) => a.position - b.position)
}

/* Метрики — самое ценное для машинного читателя: это проверяемые числа, а не
   маркетинговые формулировки. Поэтому строка кейса собирается из них. */
function metricsLine(project) {
  return (project.metrics ?? [])
    .map(metric => `${metric.value} ${metric.label}`)
    .join('; ')
}

function projectLine(project) {
  const parts = [metricsLine(project), project.period].filter(Boolean)
  return `- [${project.client}](${SITE}/projects/${project.slug}): ${project.title}. ${parts.join('. ')}.`
}

/* Статьи базы знаний одной локали, только опубликованные. Тело — сырой
   markdown после frontmatter. */
async function readArticles(locale) {
  const articles = []
  for await (const entry of glob(`content/knowledge/${locale}/*.md`, { cwd: root })) {
    const raw = await readFile(join(root, entry), 'utf8')
    const data = frontmatter(raw)
    if (data.status === 'published') {
      articles.push({ ...data, body: raw.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') })
    }
  }
  return articles.sort((a, b) => a.slug.localeCompare(b.slug))
}

const KNOWLEDGE_PATH = { en: '/knowledge', ru: '/ru/knowledge' }
const FIGURE_LABEL = { en: 'Illustration', ru: 'Схема' }

/* Схема в статье — SVG-компонент (`::kb-figure{art alt}` + подпись). Агенту
   картинка недоступна, поэтому в markdown-версии она становится описанием:
   `alt` говорит, что нарисовано, подпись — зачем. */
function plainMarkdown(body, locale) {
  return body
    .replace(/::kb-figure\{[^}]*?alt="([^"]*)"[^}]*\}\r?\n([\s\S]*?)\r?\n::/g, (_, alt, caption) =>
      `> **${FIGURE_LABEL[locale]}:** ${alt}\n>\n> ${caption.trim()}`)
    /* Внутренние ссылки — абсолютными: markdown читают вне сайта. */
    .replace(/\]\(\//g, `](${SITE}/`)
    .trim()
}

async function writeArticleMarkdown(article, founder) {
  const url = `${SITE}${KNOWLEDGE_PATH[article.locale]}/${article.slug}`
  const meta = [`Source: ${url}`, `Author: ${founder}`, article.updated ? `Updated: ${article.updated}` : null]
    .filter(Boolean)
    .join(' · ')
  const text = [
    `# ${article.title}`,
    '',
    `> ${article.summary}`,
    '',
    meta,
    '',
    plainMarkdown(article.body, article.locale),
    '',
  ].join('\n')

  const dir = join(root, 'public', ...KNOWLEDGE_PATH[article.locale].split('/').filter(Boolean))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, `${article.slug}.md`), text)
}

/* Глоссарий одной локали — термины по алфавиту языка, группами по первой
   букве, как на странице (app/utils/knowledge.ts → groupByLetter). */
const GLOSSARY_TEXT = {
  en: { aka: 'also', more: 'More' },
  ru: { aka: 'иначе', more: 'Подробнее' },
}

async function readGlossary(locale) {
  try {
    return parseYaml(await readFile(join(root, 'content', 'glossary', `${locale}.yml`), 'utf8'))
  }
  catch {
    return null
  }
}

async function writeGlossaryMarkdown(glossary, articles, founder) {
  const { locale } = glossary
  const base = `${SITE}${KNOWLEDGE_PATH[locale]}`
  const titles = new Map(articles.map(article => [article.slug, article.title]))
  const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true })
  const text = GLOSSARY_TEXT[locale]

  const lines = [
    `# ${glossary.title}`,
    '',
    `> ${glossary.intro}`,
    '',
    [`Source: ${base}/glossary`, `Author: ${founder}`, glossary.updated ? `Updated: ${glossary.updated}` : null].filter(Boolean).join(' · '),
  ]
  let letter = null
  for (const term of [...glossary.terms].sort((a, b) => collator.compare(a.term, b.term))) {
    const first = term.term.charAt(0).toLocaleUpperCase(locale)
    const next = /\p{L}/u.test(first) ? first : '#'
    if (next !== letter) {
      letter = next
      lines.push('', `## ${letter}`)
    }
    const aka = term.aka?.length ? ` (${text.aka}: ${term.aka.join(', ')})` : ''
    const more = term.article && titles.has(term.article)
      ? ` ${text.more}: [${titles.get(term.article)}](${base}/${term.article}).`
      : ''
    lines.push('', `**${term.term}**${aka} — ${term.definition}${more}`)
  }
  lines.push('')

  const dir = join(root, 'public', ...KNOWLEDGE_PATH[locale].split('/').filter(Boolean))
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, 'glossary.md'), lines.join('\n'))
}

async function main() {
  const [en, ru, projects, articlesEn, articlesRu, glossaryEn, glossaryRu] = await Promise.all([
    readSite('en'),
    readSite('ru'),
    readProjects(),
    readArticles('en'),
    readArticles('ru'),
    readGlossary('en'),
    readGlossary('ru'),
  ])

  /* Старые файлы удаляются целиком: статья, снятая с публикации, не должна
     остаться доступной в markdown. */
  await rm(join(root, 'public', 'knowledge'), { recursive: true, force: true })
  await rm(join(root, 'public', 'ru'), { recursive: true, force: true })
  const founder = { en: en.brand.founder, ru: ru.brand.founder }
  for (const article of [...articlesEn, ...articlesRu]) {
    await writeArticleMarkdown(article, founder[article.locale])
  }
  if (glossaryEn) await writeGlossaryMarkdown(glossaryEn, articlesEn, founder.en)
  if (glossaryRu) await writeGlossaryMarkdown(glossaryRu, articlesRu, founder.ru)

  const services = en.services.map(service => `- **${service.title}** — ${service.description}`)
  const contact = en.contacts.find(item => item.primary) ?? en.contacts[0]

  const lines = [
    `# ${en.brand.name} — ${en.brand.descriptor}`,
    '',
    `> ${en.hero.description}`,
    '',
    en.about.description,
    '',
    '## Main pages',
    '',
    `- [Home (EN)](${SITE}/): services, cases, process, pricing and contacts.`,
    `- [Главная (RU)](${SITE}/ru): услуги, кейсы, процесс, цены и контакты.`,
    `- [Projects (EN)](${SITE}/projects): all published case studies.`,
    `- [Проекты (RU)](${SITE}/ru/projects): все опубликованные кейсы.`,
    '',
    'Every page exists in two languages: English at the root, Russian under `/ru`.',
    '',
    '## Services',
    '',
    ...services,
    '',
    '## Pricing',
    '',
    `${en.pricing.summary} ${en.pricing.note}`,
    '',
    '## FAQ',
    '',
    ...en.faq.flatMap(item => [`**${item.question}** ${item.answer}`, '']),
    `## Case studies (${projects.length})`,
    '',
    'Figures below are the ones published on each case page.',
    '',
    ...projects.map(projectLine),
    '',
    ...(articlesEn.length
      ? [
          `## Knowledge base (${articlesEn.length})`,
          '',
          `Practical articles on working with a 3D artist. Each link is the plain-markdown version; the HTML page is the same URL without \`.md\`, and the Russian version lives under \`/ru/knowledge\`.`,
          '',
          ...articlesEn.map(article => `- [${article.title}](${SITE}/knowledge/${article.slug}.md): ${article.summary}`),
          '',
        ]
      : []),
    ...(glossaryEn
      ? [
          '## Glossary',
          '',
          `- [${glossaryEn.title}](${SITE}/knowledge/glossary.md): ${glossaryEn.terms.length} terms of 3D visualization with short definitions and links to the articles above. Russian version: ${SITE}/ru/knowledge/glossary.md`,
          '',
        ]
      : []),
    '## Contact',
    '',
    `${contact.label}: ${contact.value} (${contact.href}). Briefs are accepted through the contact form on the home page.`,
    '',
    `_Generated from the site content by scripts/generate-llms.mjs — do not edit by hand._`,
    '',
  ]

  await writeFile(OUT, lines.join('\n'))
  console.log(`[llms] public/llms.txt: ${projects.length} кейсов, ${en.services.length} услуг, ${articlesEn.length} статей; markdown статей: ${articlesEn.length + articlesRu.length}; глоссарий: ${glossaryEn?.terms.length ?? 0} терминов`)
}

await main()
