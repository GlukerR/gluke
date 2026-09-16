/*
 * Отпечатки картинок решают две проблемы, которых на сайте не видно вообще:
 * мессенджер показывает закэшированную картинку превью, потому что адрес не
 * менялся, и вариант `/_ipx/**` остаётся в кэше браузера и CDN, потому что его
 * адрес от содержимого исходника не зависит. Ошибка здесь тихая: страница
 * выглядит целой, а картинка старая.
 *
 * Сам модуль — `scripts/media-versions.mjs` (он читает файлы проекта, то есть
 * node-код, и в `app/`/`shared/` ему места нет: там нет node-типов). Здесь
 * проверяются части, которые от файловой системы не зависят: разбор текста и
 * отпечаток. Покрытие карты по реальным кейсам — там, где такие проверки уже
 * живут: `pnpm validate:content` (обложка обязана лежать на диске и иметь
 * версию).
 */
import { describe, expect, it } from 'vitest'
import { collectImageVersions, fingerprint, frontmatter, imageSources } from '../../scripts/media-versions.mjs'

const markdown = (...lines: string[]) => `---\n${lines.join('\n')}\n---\n\n## Задача\n`

describe('fingerprint', () => {
  it('одно и то же содержимое даёт один и тот же отпечаток', () => {
    expect(fingerprint('cover')).toBe(fingerprint('cover'))
  })

  it('изменение картинки меняет отпечаток', () => {
    expect(fingerprint('cover-old')).not.toBe(fingerprint('cover-new'))
  })

  it('короткий отпечаток — hex заданной длины', () => {
    expect(fingerprint('cover')).toMatch(/^[0-9a-f]{8}$/)
    expect(fingerprint('cover', 4)).toMatch(/^[0-9a-f]{4}$/)
  })
})

describe('frontmatter', () => {
  it('снимает тело кейса и ограничители', () => {
    expect(frontmatter(markdown('locale: ru'))).toBe('locale: ru')
  })

  it('без frontmatter не выдумывает данные', () => {
    expect(frontmatter('## Задача\n')).toBe('')
  })

  it('понимает CRLF: файлы кейсов правятся и на Windows', () => {
    expect(frontmatter('---\r\nlocale: ru\r\n---\r\n\r\n## Задача')).toBe('locale: ru')
  })
})

describe('imageSources', () => {
  it('берёт обложку', () => {
    expect(imageSources(markdown(
      'cover:',
      '  src: /media/projects/demo/demo-cover.jpg',
      '  alt: Обложка',
      '  width: 1680',
      '  height: 945',
    ))).toEqual(['/media/projects/demo/demo-cover.jpg'])
  })

  /* Обложке кейса нужна отдельная композиция для узких экранов: карточка
     подставляет её по медиазапросу, значит без версии она залипнет так же, как
     и основная. */
  it('берёт мобильную композицию обложки', () => {
    expect(imageSources(markdown(
      'cover:',
      '  src: /media/projects/demo/cover.jpg',
      '  mobile:',
      '    src: /media/projects/demo/cover-mobile.jpg',
    ))).toEqual(['/media/projects/demo/cover.jpg', '/media/projects/demo/cover-mobile.jpg'])
  })

  /* Галерея и превью машин объявлены не в `cover`, а в `media` и `thumb`:
     именно ради них список полей не перечисляется, а разбирается регулярно. */
  it('берёт картинки галереи и превью', () => {
    expect(imageSources(markdown(
      'media:',
      '  - kind: image',
      '    src: /media/projects/demo/shot.webp',
      '  - kind: 3d',
      '    src: /media/projects/demo/car.glb',
      '    thumb: /media/projects/demo/car.webp',
    ))).toEqual(['/media/projects/demo/shot.webp', '/media/projects/demo/car.webp'])
  })

  /* Модель и музыка версий не получают: их адрес уходит в загрузчик и в плеер,
     а не в `<img>`, и кэш там настраивается сам. */
  it('не трогает модели, музыку и видео', () => {
    expect(imageSources(markdown(
      'model:',
      '  src: /media/projects/demo/car.glb',
      'audio:',
      '  - src: /media/projects/demo/track.mp3',
      'video:',
      '  src: /media/projects/demo/clip.mp4',
    ))).toEqual([])
  })

  it('снимает кавычки YAML', () => {
    expect(imageSources(markdown(
      'cover:',
      `  src: '/media/projects/demo/cover.jpg'`,
    ))).toEqual(['/media/projects/demo/cover.jpg'])
  })
})

describe('collectImageVersions', () => {
  /* Каталога нет — значит и карты нет: сборка обязана остаться рабочей,
     адреса картинок просто уйдут без версии. */
  it('отсутствие каталога контента не ломает сборку', () => {
    expect(collectImageVersions({ contentDir: 'content/нет-такого' })).toEqual({})
  })

  /* Ключи карты — адреса из контента. Смотрим на реальный каталог, чтобы разбор
     не разъехался с тем, как кейсы написаны на самом деле. */
  it('карта покрывает картинки реальных кейсов', () => {
    const versions = collectImageVersions()

    expect(Object.keys(versions).length).toBeGreaterThan(20)
    expect(Object.keys(versions).every(src => src.startsWith('/media/'))).toBe(true)
    expect(versions['/media/projects/rp-grand/rp-grand-cover.jpg']).toMatch(/^[0-9a-f]{8}$/)
    expect(versions['/media/projects/rp-grand/vehicles/coupe-gt.webp']).toMatch(/^[0-9a-f]{8}$/)
  })

  it('в карте нет ни моделей, ни музыки', () => {
    const versions = collectImageVersions()

    expect(Object.keys(versions).some(src => src.endsWith('.glb'))).toBe(false)
    expect(Object.keys(versions).some(src => src.endsWith('.mp3'))).toBe(false)
  })
})
