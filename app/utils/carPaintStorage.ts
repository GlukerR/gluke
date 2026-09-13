/*
 * Окраска конфигуратора переживает перезагрузку страницы: выбор лежит в
 * localStorage и восстанавливается при следующем визите. Ключ общий на весь
 * сайт — машина одна, и её красят «как прошлую», с какой страницы ни зашли.
 *
 * Здесь нет никакой магии: localStorage может быть недоступен (приватный
 * режим, SSR, политика браузера) — тогда просто считаем, что сохранения нет.
 */

export interface StoredCarSelection {
  color: string
  pattern: string
  scale: number
  coverage: string
}

const STORAGE_KEY = 'rp-grand:car-paint'

function isBrowserStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    /* Safari в приватном режиме кидает на записи — проверяем именно записью. */
    const probe = '__car-paint__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  }
  catch {
    return null
  }
}

export function loadCarSelection(): StoredCarSelection | null {
  const storage = isBrowserStorage()
  if (!storage) return null
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const record = parsed as Record<string, unknown>
    if (
      typeof record.color !== 'string'
      || typeof record.pattern !== 'string'
      || typeof record.coverage !== 'string'
      || typeof record.scale !== 'number'
      || !Number.isFinite(record.scale)
    ) return null
    return {
      color: record.color,
      pattern: record.pattern,
      scale: record.scale,
      coverage: record.coverage,
    }
  }
  catch {
    /* Чужие или битые данные — не наша проблема, стартуем с дефолта. */
    return null
  }
}

export function saveCarSelection(selection: StoredCarSelection): void {
  const storage = isBrowserStorage()
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(selection))
  }
  catch {
    /* Переполнение квоты не должно ломать конфигуратор. */
  }
}
