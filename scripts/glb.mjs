/*
 * Разбор GLB для скриптов: 12-байтный заголовок и чанки
 * `[length(4) type(4) data]`. JSON-чанк несёт всю структуру модели (ноды,
 * меши, min/max атрибутов, материалы), BIN — геометрию и картинки.
 *
 * Один разбор на все скрипты: копии в каждом скрипте расходились в мелочах
 * (проверка подписи, граница цикла), и ошибку пришлось бы чинить в пяти местах.
 */
import { readFileSync } from 'node:fs'

const MAGIC = 0x46546C67 // 'glTF'
const CHUNK_JSON = 0x4E4F534A
const CHUNK_BIN = 0x004E4942

/** JSON и BIN из байтов GLB (Buffer или Uint8Array). BIN может отсутствовать. */
export function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (bytes.byteLength < 12 || view.getUint32(0, true) !== MAGIC) throw new Error('не GLB: неверная подпись')
  let json = null
  let bin = null
  let offset = 12
  while (offset + 8 <= bytes.byteLength) {
    const length = view.getUint32(offset, true)
    const type = view.getUint32(offset + 4, true)
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(new TextDecoder().decode(data))
    else if (type === CHUNK_BIN) bin = data
    offset += 8 + length
  }
  if (!json) throw new Error('в GLB нет JSON-чанка')
  return { json, bin }
}

/** JSON и BIN из файла GLB. */
export function readGlb(file) {
  return parseGlb(readFileSync(file))
}

/** Только JSON-чанк файла GLB. */
export function readGlbJson(file) {
  return readGlb(file).json
}

export { CHUNK_BIN, CHUNK_JSON }
