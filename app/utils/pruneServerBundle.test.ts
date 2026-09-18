/*
 * Трим серверного бандла работает по именам файлов внутри зависимостей, и
 * ошибиться тут можно в две стороны. Лишнее удаление ломает собранный сервер:
 * `better-sqlite3` ищет свой prebuild по имени платформы, а без файла падает на
 * первой же странице с контентом. Недостаточное удаление не ломает ничего, но
 * оставляет в каждом деплое десяток мегабайт чужих систем, которые
 * умножаются на число сохранённых деплоев в Deployment Storage.
 *
 * Первую ошибку как раз и проверяют тесты: файл нужной платформы остаётся,
 * musl-вариант на linux тоже (страховка от незнакомой libc), а незнакомое имя
 * не удаляется вовсе — лучше оставить лишнее, чем угадать неправильно.
 *
 * Сам модуль — `scripts/prune-server-bundle.mjs` (он читает и удаляет файлы,
 * то есть node-код). Здесь проверяются решения по именам.
 */
import { describe, expect, it } from 'vitest'
import {
  isForeignImgDir,
  isForeignPrebuild,
  keepImgNames,
  keepPrebuildNames,
} from '../../scripts/prune-server-bundle.mjs'

describe('keepPrebuildNames', () => {
  it('оставляет prebuild текущей платформы', () => {
    expect(keepPrebuildNames('win32', 'x64')).toEqual(['win32-x64.node'])
  })

  it('на linux оставляет и musl-вариант: цена ошибки — неработающий контент', () => {
    expect(keepPrebuildNames('linux', 'x64')).toEqual(['linux-x64.node', 'linuxmusl-x64.node'])
  })
})

describe('isForeignPrebuild', () => {
  const target = { platform: 'linux', arch: 'x64' }

  it('удаляет бинарники чужих систем', () => {
    expect(isForeignPrebuild('darwin-arm64.node', target)).toBe(true)
    expect(isForeignPrebuild('win32-x64.node', target)).toBe(true)
    expect(isForeignPrebuild('linux-arm64.node', target)).toBe(true)
  })

  it('оставляет glibc- и musl-варианты целевой архитектуры', () => {
    expect(isForeignPrebuild('linux-x64.node', target)).toBe(false)
    expect(isForeignPrebuild('linuxmusl-x64.node', target)).toBe(false)
  })

  it('не трогает файлы, которые не являются prebuild', () => {
    expect(isForeignPrebuild('README.md', target)).toBe(false)
  })
})

describe('isForeignImgDir', () => {
  const target = { platform: 'linux', arch: 'x64' }

  it('удаляет каталоги sharp для других систем', () => {
    expect(isForeignImgDir('sharp-darwin-arm64', target)).toBe(true)
    expect(isForeignImgDir('sharp-win32-x64', target)).toBe(true)
    expect(isForeignImgDir('sharp-linuxmusl-arm64', target)).toBe(true)
  })

  it('оставляет каталог целевой платформы', () => {
    expect(isForeignImgDir('sharp-linux-x64', target)).toBe(false)
    expect(isForeignImgDir('sharp-linuxmusl-x64', target)).toBe(false)
  })

  it('не удаляет незнакомые имена: неизвестное — не обязательно чужое', () => {
    expect(isForeignImgDir('sharp-wasm32', target)).toBe(false)
    expect(isForeignImgDir('not-sharp', target)).toBe(false)
  })

  it('на Windows остаётся только win32-вариант', () => {
    const windows = { platform: 'win32', arch: 'x64' }

    expect(keepImgNames('win32', 'x64')).toEqual(['-win32-x64'])
    expect(isForeignImgDir('sharp-win32-x64', windows)).toBe(false)
    expect(isForeignImgDir('sharp-linux-x64', windows)).toBe(true)
  })
})
