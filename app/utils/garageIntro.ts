/*
 * Подсказка гаража «это не картинка».
 *
 * Собранный гараж на первый взгляд читается как рендер: кадр неподвижен, а
 * меню внизу похоже на подписи. Поэтому при первом показе сцена приглушается,
 * по контуру кнопки «Машины» бежит огонёк, над меню — короткая подпись.
 * Подсказка уходит с первым действием в гараже и больше не возвращается:
 * человек, который уже крутил машину, в ней не нуждается.
 *
 * Хранилище может быть недоступно (приватный режим, SSR, политика браузера) —
 * тогда подсказка просто покажется снова при следующем визите.
 */

const STORAGE_KEY = 'rp-grand:garage-intro'

type IntroStorage = Pick<Storage, 'getItem' | 'setItem'>

function browserStorage(): IntroStorage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  }
  catch {
    return null
  }
}

export function hasSeenGarageIntro(storage: IntroStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    return storage.getItem(STORAGE_KEY) === '1'
  }
  catch {
    return false
  }
}

export function markGarageIntroSeen(storage: IntroStorage | null = browserStorage()): void {
  if (!storage) return
  try {
    storage.setItem(STORAGE_KEY, '1')
  }
  catch {
    /* Переполнение квоты или запрет записи не должны ломать гараж. */
  }
}
