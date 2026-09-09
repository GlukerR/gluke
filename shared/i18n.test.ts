/* Выбор языка для первого визита. Этим кодом решается, что увидит человек,
 * пришедший на корень сайта: русскую версию или английскую. Ошибка здесь
 * тихая — сайт работает, просто часть посетителей приходит не на свой язык,
 * и заметить это по логам почти невозможно.
 *
 * Разбор Accept-Language самый ветвистый: там сортировка по q, отсечение
 * явно отвергнутых тегов и срезание региона. Каждая ветка проверяется
 * отдельно, потому что заголовок приходит от браузера в любом виде.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_LOCALE,
  LOCALE_CODES,
  SITE_LOCALES,
  isLocaleCode,
  localeForAcceptLanguage,
  localeForCountry,
  localeForRequest,
  toOpenGraphLocale,
} from './i18n'

describe('isLocaleCode', () => {
  it('принимает только известные коды', () => {
    expect(isLocaleCode('ru')).toBe(true)
    expect(isLocaleCode('en')).toBe(true)
    expect(isLocaleCode('de')).toBe(false)
    expect(isLocaleCode('RU')).toBe(false)
    expect(isLocaleCode('')).toBe(false)
    expect(isLocaleCode(undefined)).toBe(false)
    expect(isLocaleCode(null)).toBe(false)
    expect(isLocaleCode(42)).toBe(false)
  })
})

describe('localeForCountry', () => {
  it('Россия ведёт на русский, регистр значения не важен', () => {
    expect(localeForCountry('RU')).toBe('ru')
    expect(localeForCountry('ru')).toBe('ru')
  })

  /* Сигнала нет — значит решает следующий источник, а не «по умолчанию
     английский» прямо здесь: иначе Accept-Language никогда не спросили бы. */
  it('на любой другой стране и на пустом значении сигнала не даёт', () => {
    expect(localeForCountry('KZ')).toBeUndefined()
    expect(localeForCountry('US')).toBeUndefined()
    expect(localeForCountry('')).toBeUndefined()
    expect(localeForCountry(undefined)).toBeUndefined()
    expect(localeForCountry(null)).toBeUndefined()
  })
})

describe('localeForAcceptLanguage', () => {
  it('берёт первый поддерживаемый язык из простого списка', () => {
    expect(localeForAcceptLanguage('ru')).toBe('ru')
    expect(localeForAcceptLanguage('en')).toBe('en')
  })

  /* Регион игнорируется: ru-KZ — тоже русский. */
  it('срезает регион тега', () => {
    expect(localeForAcceptLanguage('ru-KZ')).toBe('ru')
    expect(localeForAcceptLanguage('en-GB,en')).toBe('en')
  })

  it('сортирует по q, а не по порядку в заголовке', () => {
    expect(localeForAcceptLanguage('en;q=0.3, ru;q=0.9')).toBe('ru')
    expect(localeForAcceptLanguage('ru;q=0.2, en;q=0.8')).toBe('en')
  })

  /* Тег без q весит 1 и должен обходить явно ослабленные. */
  it('тег без q считается самым весомым', () => {
    expect(localeForAcceptLanguage('ru, en;q=0.9')).toBe('ru')
    expect(localeForAcceptLanguage('en, ru;q=0.9')).toBe('en')
  })

  /* q=0 — это «не предлагай мне этот язык», а не слабое предпочтение. */
  it('пропускает языки, отвергнутые через q=0', () => {
    expect(localeForAcceptLanguage('ru;q=0, en;q=0.5')).toBe('en')
    expect(localeForAcceptLanguage('ru;q=0')).toBeUndefined()
  })

  it('проходит мимо неподдерживаемых языков к поддерживаемому', () => {
    expect(localeForAcceptLanguage('de, fr, ru')).toBe('ru')
    expect(localeForAcceptLanguage('de-DE;q=0.9, fr;q=0.8')).toBeUndefined()
  })

  it('терпит мусор в заголовке и не падает', () => {
    expect(localeForAcceptLanguage('*')).toBeUndefined()
    expect(localeForAcceptLanguage('ru;q=abc')).toBeUndefined()
    expect(localeForAcceptLanguage('   ')).toBeUndefined()
    expect(localeForAcceptLanguage('')).toBeUndefined()
    expect(localeForAcceptLanguage(undefined)).toBeUndefined()
    expect(localeForAcceptLanguage(null)).toBeUndefined()
  })

  it('не спотыкается о пробелы вокруг тегов и параметров', () => {
    expect(localeForAcceptLanguage('  en ;  q=0.4 ,  ru ; q=0.7 ')).toBe('ru')
  })
})

describe('localeForRequest', () => {
  /* Порядок сигналов: страна важнее языка браузера, потому что гео-сигнал
     точнее говорит о том, где человек находится. */
  it('страна имеет приоритет над языком браузера', () => {
    expect(localeForRequest('RU', 'en-US,en;q=0.9')).toBe('ru')
  })

  it('без страны решает язык браузера', () => {
    expect(localeForRequest(undefined, 'ru-RU,ru;q=0.9')).toBe('ru')
    expect(localeForRequest(null, 'en-US,en;q=0.9')).toBe('en')
  })

  /* Гео-заголовка может не быть, а IP определяться неверно — поэтому нужен
     второй сигнал и надёжный конец цепочки. */
  it('без обоих сигналов отдаёт локаль по умолчанию', () => {
    expect(localeForRequest(undefined, undefined)).toBe(DEFAULT_LOCALE)
    expect(localeForRequest(null, null)).toBe(DEFAULT_LOCALE)
    expect(localeForRequest('', '')).toBe(DEFAULT_LOCALE)
    expect(localeForRequest('KZ', 'de-DE')).toBe(DEFAULT_LOCALE)
  })

  it('всегда возвращает поддерживаемый код', () => {
    const inputs: [string | null | undefined, string | null | undefined][] = [
      ['RU', null], ['KZ', 'ru'], [undefined, 'de'], [null, '*'], ['', 'en;q=0'],
    ]

    for (const [country, header] of inputs) {
      expect(LOCALE_CODES).toContain(localeForRequest(country, header))
    }
  })
})

describe('toOpenGraphLocale', () => {
  it('переводит BCP 47 в форму Open Graph', () => {
    expect(toOpenGraphLocale('ru-RU')).toBe('ru_RU')
    expect(toOpenGraphLocale('en-US')).toBe('en_US')
  })
})

describe('SITE_LOCALES', () => {
  /* Список локалей раздаётся и в nuxt.config, и в переключатель языка:
     рассинхрон с LOCALE_CODES дал бы язык без словаря или наоборот. */
  it('совпадает по составу с LOCALE_CODES', () => {
    expect(SITE_LOCALES.map(option => option.code).sort()).toEqual([...LOCALE_CODES].sort())
  })

  it('у каждой локали заполнены поля для переключателя и словаря', () => {
    for (const option of SITE_LOCALES) {
      expect(option.language, `${option.code}: нет language`).toMatch(/^[a-z]{2}-[A-Z]{2}$/)
      expect(option.name, `${option.code}: нет имени`).toBeTruthy()
      expect(option.short, `${option.code}: нет короткой подписи`).toBeTruthy()
      expect(option.file, `${option.code}: нет файла словаря`).toBe(`${option.code}.ts`)
    }
  })

  it('локаль по умолчанию есть в списке', () => {
    expect(SITE_LOCALES.some(option => option.code === DEFAULT_LOCALE)).toBe(true)
  })
})
