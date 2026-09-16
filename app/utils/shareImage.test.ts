import { describe, expect, it } from 'vitest'
import { withShareImageVersion } from './shareImage'

/*
 * Версия в адресе share-картинки — то, что заставляет мессенджер переспросить
 * изображение. Проверяем адрес целиком: лишний `?` вместо `&` или потерянный
 * отпечаток дают битый URL в og:image, который на странице никак не заметен.
 */
describe('withShareImageVersion', () => {
  const versions = { '/media/projects/demo/cover.jpg': '1a2b3c4d' }

  it('без версии адрес не трогает', () => {
    expect(withShareImageVersion('/media/projects/demo/cover.jpg', undefined))
      .toBe('/media/projects/demo/cover.jpg')
    expect(withShareImageVersion('/media/brand/logo.svg', versions))
      .toBe('/media/brand/logo.svg')
  })

  it('подставляет версию первым параметром', () => {
    expect(withShareImageVersion('/media/projects/demo/cover.jpg', versions))
      .toBe('/media/projects/demo/cover.jpg?v=1a2b3c4d')
  })

  it('свой query у адреса сохраняет и добавляет версию вторым параметром', () => {
    expect(withShareImageVersion('/media/projects/demo/cover.jpg?w=1200', versions))
      .toBe('/media/projects/demo/cover.jpg?w=1200&v=1a2b3c4d')
  })

  it('фрагмент остаётся в конце адреса', () => {
    expect(withShareImageVersion('/media/projects/demo/cover.jpg#top', versions))
      .toBe('/media/projects/demo/cover.jpg?v=1a2b3c4d#top')
  })
})
