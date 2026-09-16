/*
 * Версия в адресе варианта ipx — то, что заставляет браузер и CDN взять новую
 * картинку после замены файла. Ошибка здесь тихая: страница выглядит целой, а
 * на месте обложки остаётся прежняя картинка из кэша.
 *
 * Проверяется то, что решает исход: попадает ли версия в модификаторы и не
 * портится ли адрес, когда отпечатка нет.
 */
import { describe, expect, it } from 'vitest'
import { imagePath, ipxVersionModifier, lookupImageVersion } from './imageVersion'

const versions = { '/media/projects/demo/cover.jpg': '1a2b3c4d' }

describe('imagePath', () => {
  it('снимает query и фрагмент', () => {
    expect(imagePath('/media/a.jpg?w=1200')).toBe('/media/a.jpg')
    expect(imagePath('/media/a.jpg#top')).toBe('/media/a.jpg')
    expect(imagePath('/media/a.jpg')).toBe('/media/a.jpg')
  })
})

describe('lookupImageVersion', () => {
  it('находит отпечаток по адресу файла', () => {
    expect(lookupImageVersion('/media/projects/demo/cover.jpg', versions)).toBe('1a2b3c4d')
  })

  /* Версия ищется по пути, а не по адресу целиком: картинка со своим `?w=`
     иначе осталась бы без версии. */
  it('находит отпечаток у адреса с query', () => {
    expect(lookupImageVersion('/media/projects/demo/cover.jpg?w=1200', versions)).toBe('1a2b3c4d')
  })

  it('без карты и для чужого адреса версии нет', () => {
    expect(lookupImageVersion('/media/projects/demo/cover.jpg', undefined)).toBeUndefined()
    expect(lookupImageVersion('/media/brand/logo.svg', versions)).toBeUndefined()
  })
})

describe('ipxVersionModifier', () => {
  it('картинка с отпечатком получает модификатор версии', () => {
    expect(ipxVersionModifier('/media/projects/demo/cover.jpg', versions)).toEqual({ v: '1a2b3c4d' })
  })

  /* Пустой объект, а не `{ v: undefined }`: модификатор с undefined превратил
     бы адрес в `v_undefined`, то есть в мусорный, но валидный для ipx URL. */
  it('картинка без отпечатка модификаторов не получает', () => {
    expect(ipxVersionModifier('/media/brand/logo.svg', versions)).toEqual({})
    expect(ipxVersionModifier('/media/projects/demo/cover.jpg', undefined)).toEqual({})
  })

  it('модификатор версии не затирает формат картинки', () => {
    expect({ format: 'avif', ...ipxVersionModifier('/media/projects/demo/cover.jpg', versions) })
      .toEqual({ format: 'avif', v: '1a2b3c4d' })
  })
})
