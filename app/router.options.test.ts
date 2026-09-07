import { describe, expect, it } from 'vitest'
import routerOptions from './router.options'

/* Для scrollBehavior достаточно плоских маршрутов: реализация читает только
   path, query и hash. Типы vue-router (полные RouteLocation) в тестах не нужны. */
interface RouteSnapshot {
  path: string
  query: Record<string, string>
  hash: string
}

const route = (path: string, hash = ''): RouteSnapshot => ({ path, query: {}, hash })

/* Реальная сигнатура scrollBehavior типизирована полными RouteLocation и
   ScrollPosition — для теста они избыточны, поэтому сужаем до плоских. */
const behavior = routerOptions.scrollBehavior as unknown as (
  to: RouteSnapshot,
  from: RouteSnapshot,
  saved: unknown,
) => unknown

async function scroll(to: RouteSnapshot, from: RouteSnapshot, saved?: unknown): Promise<unknown> {
  return behavior(to, from, saved ?? null)
}

describe('router scrollBehavior', () => {
  it('обычный переход на другую страницу — плавно наверх', async () => {
    const result = await scroll(route('/projects/bar'), route('/projects/foo'))

    expect(result).toEqual({ top: 0, behavior: 'smooth' })
  })

  it('смена языка на той же странице не трогает прокрутку', async () => {
    const result = await scroll(route('/projects/foo'), route('/ru/projects/foo'))

    expect(result).toBe(false)
  })

  it('смена языка с сохранением hash тоже не трогает прокрутку', async () => {
    const result = await scroll(route('/projects/foo', '#top'), route('/ru/projects/foo', '#top'))

    expect(result).toBe(false)
  })

  it('навигация «назад/вперёд» восстанавливает сохранённую позицию', async () => {
    const saved = { left: 0, top: 250 }
    const result = await scroll(route('/projects/foo'), route('/projects/bar'), saved)

    expect(result).toBe(saved)
  })

  it('hash-переход оставляет прокрутку hash-scroll плагину', async () => {
    const result = await scroll(route('/projects/foo', '#media'), route('/projects/foo'))

    expect(result).toBe(false)
  })

  it('переход между языковыми версиями разных страниц скроллит наверх', async () => {
    const result = await scroll(route('/projects/new'), route('/ru'))

    expect(result).toEqual({ top: 0, behavior: 'smooth' })
  })
})
