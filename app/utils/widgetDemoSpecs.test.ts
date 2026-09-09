/* Таблица описаний виджетов — единственное место, где перечислены ползунки,
 * их диапазоны и дефолты. Она набирается руками, и опечатка в ней тихо
 * меняет поведение публичной страницы: при переносе пяти компонентов в общую
 * оболочку в неё уже проехал неверный размер точки у оленя. Эти проверки
 * ловят именно такой класс ошибок — расхождение таблицы со словарями и
 * с самой собой.
 *
 * Словари импортируем как объекты, а не читаем файлами: так проверяется то,
 * что реально попадёт в приложение, и тест не зависит от форматирования.
 */
import { describe, expect, it } from 'vitest'
import en from '../../i18n/locales/en'
import ru from '../../i18n/locales/ru'
import { WIDGET_DEMO_SPECS, widgetDemoSpec } from './widgetDemoSpecs'

type Dictionary = Record<string, string>

function labels(locale: typeof ru, block: 'groups' | 'controls'): Dictionary {
  const demo = (locale as unknown as {
    project: { demo: Record<'groups' | 'controls', Dictionary> }
  }).project.demo
  return demo[block]
}

const specs = Object.entries(WIDGET_DEMO_SPECS)

describe('widgetDemoSpecs', () => {
  it.each(specs)('%s: ползунки не повторяются и имеют осмысленные диапазоны', (_id, spec) => {
    const seen = new Set<string>()

    for (const group of spec.groups) {
      for (const control of group.controls) {
        expect(seen.has(control.key), `ползунок ${control.key} объявлен дважды`).toBe(false)
        seen.add(control.key)

        expect(control.min, `${control.key}: min не меньше max`).toBeLessThan(control.max)
        expect(control.step, `${control.key}: шаг не положительный`).toBeGreaterThan(0)
        expect(
          control.step,
          `${control.key}: шаг крупнее самого диапазона`,
        ).toBeLessThanOrEqual(control.max - control.min)
      }
    }
  })

  /* Дефолт вне диапазона своего ползунка — тихая ошибка: панель покажет
     значение, которого ползунком не достичь, а «Сбросить» вернёт его же. */
  it.each(specs)('%s: дефолты укладываются в диапазоны ползунков', (_id, spec) => {
    const ranges = new Map(
      spec.groups.flatMap(group => group.controls.map(control => [control.key, control] as const)),
    )

    for (const [key, value] of Object.entries(spec.defaults ?? {})) {
      const control = ranges.get(key)
      if (!control) continue
      expect(value, `${key}: дефолт ${value} ниже минимума ${control.min}`).toBeGreaterThanOrEqual(control.min)
      expect(value, `${key}: дефолт ${value} выше максимума ${control.max}`).toBeLessThanOrEqual(control.max)
    }
  })

  it.each(specs)('%s: у каждой группы есть подпись в обеих локалях', (_id, spec) => {
    const groupsRu = labels(ru, 'groups')
    const groupsEn = labels(en as typeof ru, 'groups')

    for (const group of spec.groups) {
      expect(groupsRu[group.id], `нет русской подписи группы ${group.id}`).toBeTruthy()
      expect(groupsEn[group.id], `нет английской подписи группы ${group.id}`).toBeTruthy()
    }
  })

  /* Ровно этот случай был на публичной странице: у пирамиды не оказалось ни
     одной подписи, и панель показывала сырые ключи вроде `baseSpan`. */
  it.each(specs)('%s: у каждого ползунка есть подпись в обеих локалях', (_id, spec) => {
    const controlsRu = labels(ru, 'controls')
    const controlsEn = labels(en as typeof ru, 'controls')
    const scoped = (key: string) =>
      spec.labelPrefix ? `${spec.labelPrefix}${key.charAt(0).toUpperCase()}${key.slice(1)}` : null

    for (const group of spec.groups) {
      for (const { key } of group.controls) {
        const alias = scoped(key)
        const hasRu = Boolean(controlsRu[key] || (alias && controlsRu[alias]))
        const hasEn = Boolean(controlsEn[key] || (alias && controlsEn[alias]))
        expect(hasRu, `нет русской подписи ползунка ${key}`).toBe(true)
        expect(hasEn, `нет английской подписи ползунка ${key}`).toBe(true)
      }
    }
  })

  it('находит описание по имени виджета и молчит на незнакомом', () => {
    expect(widgetDemoSpec('pyramid')).toBe(WIDGET_DEMO_SPECS.pyramid)
    expect(widgetDemoSpec('нет-такого')).toBeNull()
    expect(widgetDemoSpec(null)).toBeNull()
    expect(widgetDemoSpec(undefined)).toBeNull()
  })
})
