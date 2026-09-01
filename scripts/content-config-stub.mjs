/**
 * Подмена `@nuxt/content` при загрузке `content.config.ts` из валидатора.
 *
 * Настоящий `defineCollection()` сразу конвертирует zod-схему в JSON Schema, а
 * исходную zod-схему выбрасывает — для проверки контента нужна именно она.
 * Поэтому jiti подставляет этот модуль вместо `@nuxt/content`: `define*` просто
 * возвращают объект как есть, а `z` берётся из того же экземпляра zod, который
 * использует сам `@nuxt/content` (пакет строгий pnpm-овский, из корня проекта
 * `zod` не резолвится — идём через дерево зависимостей `@nuxt/content`).
 *
 * См. scripts/validate-content.mjs.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const rootRequire = createRequire(import.meta.url)
const contentRequire = createRequire(rootRequire.resolve('@nuxt/content'))
const zodModule = await import(pathToFileURL(contentRequire.resolve('zod')).href)

export const z = zodModule.z ?? zodModule.default?.z ?? zodModule.default

export const defineContentConfig = config => config
export const defineCollection = collection => collection
export const defineCollectionSource = source => source
