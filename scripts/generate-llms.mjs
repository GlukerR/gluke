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
 * Использование: pnpm llms
 */
import { glob, readFile, writeFile } from 'node:fs/promises'
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

async function main() {
  const [en, projects] = await Promise.all([readSite('en'), readProjects()])

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
    '## Contact',
    '',
    `${contact.label}: ${contact.value} (${contact.href}). Briefs are accepted through the contact form on the home page.`,
    '',
    `_Generated from the site content by scripts/generate-llms.mjs — do not edit by hand._`,
    '',
  ]

  await writeFile(OUT, lines.join('\n'))
  console.log(`[llms] public/llms.txt: ${projects.length} кейсов, ${en.services.length} услуг`)
}

await main()
