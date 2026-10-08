/**
 * Разделы и читатели базы знаний.
 *
 * Списки общие для схемы контента (`content.config.ts`), хаба и валидатора:
 * подписи к ним — в `i18n/locales/*.ts` (`knowledge.sections`,
 * `knowledge.audiences`), порядок разделов на хабе — порядок этого массива.
 */
export const KNOWLEDGE_SECTIONS = ['preparation', 'briefing', 'formats', 'use-cases', 'realtime', 'craft'] as const

export type KnowledgeSection = typeof KNOWLEDGE_SECTIONS[number]

export const KNOWLEDGE_AUDIENCES = ['client', 'marketing', 'developer', 'artist'] as const

export type KnowledgeAudience = typeof KNOWLEDGE_AUDIENCES[number]
