/*
 * Пурж вариантов картинок — операция с тихой ошибкой: неверно собранный список
 * уходит в API, тот отвечает успехом и не помечает ничего. Картинка после
 * замены файла остаётся старой в кэше браузера и на краю, а причина искать
 * будет не в этом списке.
 *
 * Поэтому проверяется приведение путей к одному виду — что бы ни передали,
 * путь из репозитория или абсолютный адрес, — отбор только тем расширениям,
 * которые оптимизатор действительно обрабатывает, и разбивка на порции.
 *
 * Сам модуль — `scripts/purge-image-cache.mjs` (он зовёт git и ходит в API,
 * то есть node-код). Здесь проверяются части, которые от сети не зависят.
 */
import { describe, expect, it } from 'vitest'
import { batchSourceImages, mediaPaths, sourceImageUrls } from '../../scripts/purge-image-cache.mjs'

describe('mediaPaths', () => {
  it('приводит путь из репозитория к адресу сайта', () => {
    expect(mediaPaths(['public/media/projects/rp-grand/rp-grand-cover.jpg']))
      .toEqual(['/media/projects/rp-grand/rp-grand-cover.jpg'])
  })

  it('принимает и путь, и абсолютный адрес', () => {
    expect(mediaPaths(['https://gluke.ru/media/projects/getic/cover.webp']))
      .toEqual(['/media/projects/getic/cover.webp'])
    expect(mediaPaths(['/media/projects/getic/cover.webp']))
      .toEqual(['/media/projects/getic/cover.webp'])
  })

  it('не повторяет один и тот же путь дважды', () => {
    expect(mediaPaths(['/media/a.jpg', 'public/media/a.jpg', 'https://gluke.ru/media/a.jpg']))
      .toEqual(['/media/a.jpg'])
  })

  it('отбрасывает то, что оптимизатор не обрабатывает', () => {
    expect(mediaPaths([
      'public/media/projects/rp-grand/garage.glb',
      'public/media/projects/rp-grand/coupe-gt-lod0.glb',
      'public/draco/draco_decoder.wasm',
      'app/utils/imageVersion.ts',
      'public/favicon.ico',
    ])).toEqual([])
  })

  it('не берёт картинки вне public/media', () => {
    expect(mediaPaths(['public/media-logo.svg', 'design/cover.jpg'])).toEqual([])
  })

  it('находит адрес внутри пути MSYS из Git Bash на Windows', () => {
    expect(mediaPaths(['C:/Program Files/Git/media/projects/rp-grand/rp-grand-cover.jpg']))
      .toEqual(['/media/projects/rp-grand/rp-grand-cover.jpg'])
  })
})

describe('sourceImageUrls', () => {
  it('склеивает адрес сайта и путь без двойного слэша', () => {
    expect(sourceImageUrls(['/media/a.jpg'], 'https://gluke.ru/'))
      .toEqual(['https://gluke.ru/media/a.jpg'])
  })

  it('пустой список остаётся пустым', () => {
    expect(sourceImageUrls([], 'https://gluke.ru')).toEqual([])
  })
})

describe('batchSourceImages', () => {
  it('дробит длинный список на порции в пределах лимита API', () => {
    const list = Array.from({ length: 17 }, (_, index) => `https://gluke.ru/media/${index}.jpg`)
    const batches = batchSourceImages(list, 16)

    expect(batches).toHaveLength(2)
    expect(batches[0]).toHaveLength(16)
    expect(batches[1]).toHaveLength(1)
    expect(batches.flat()).toEqual(list)
  })

  it('короткий список уходит одним запросом', () => {
    expect(batchSourceImages(['a', 'b'])).toEqual([['a', 'b']])
  })

  it('пустой список не даёт ни одного запроса', () => {
    expect(batchSourceImages([])).toEqual([])
  })
})
