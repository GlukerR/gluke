/*
 * Политика хранения деплоев решает, сколько места занимает Deployment Storage,
 * и ошибка здесь тихая: неверный срок уходит в API, деплои живут дольше
 * задуманного, а счётчик переполняется неделями позже — связь с этой командой
 * уже не видна. Обратная ошибка (слишком короткий срок) стирает историю для
 * отката. Поэтому проверяются обе границы: перевод дней в метки, которые
 * понимает API, и отказ на сроке, которого API не знает.
 *
 * Сам модуль — `scripts/deployment-retention.mjs` (он ходит в API и читает
 * `.vercel/project.json`, то есть node-код). Здесь проверяются части, которые
 * от сети не зависят.
 */
import { describe, expect, it } from 'vitest'
import {
  DEFAULT_RETENTION,
  expirationBody,
  parseArgs,
  policyLabels,
  retentionLabel,
} from '../../scripts/deployment-retention.mjs'

describe('retentionLabel', () => {
  it('переводит дни ответа Vercel в метки, которые принимает API', () => {
    expect(retentionLabel(1)).toBe('1d')
    expect(retentionLabel(7)).toBe('1w')
    expect(retentionLabel(30)).toBe('1m')
    expect(retentionLabel(365)).toBe('1y')
    expect(retentionLabel(36500)).toBe('unlimited')
  })

  it('незнакомый срок показывает днями, а не роняет команду', () => {
    expect(retentionLabel(5)).toBe('5d')
  })

  it('отсутствующее значение — явная метка, а не пустая строка', () => {
    expect(retentionLabel(undefined)).toBe('(не задан)')
  })
})

describe('policyLabels', () => {
  it('разбирает ответ Vercel по четырём категориям деплоев', () => {
    expect(policyLabels({
      expiration: 1,
      expirationProduction: 7,
      expirationCanceled: 30,
      expirationErrored: 90,
    })).toEqual({ preview: '1d', production: '1w', canceled: '1m', errored: '3m' })
  })
})

describe('expirationBody', () => {
  it('уходит в API теми же именами полей, что он читает', () => {
    expect(expirationBody(DEFAULT_RETENTION)).toEqual({
      expiration: '1d',
      expirationProduction: '1w',
      expirationCanceled: '1d',
      expirationErrored: '1d',
    })
  })
})

describe('parseArgs', () => {
  it('по умолчанию только читает, ничего не меняя', () => {
    expect(parseArgs([])).toMatchObject({ apply: false, dryRun: false, project: null })
  })

  it('принимает свои сроки для каждой категории', () => {
    const options = parseArgs(['--apply', '--production', '1m', '--preview', '1w', '--canceled', '1d', '--errored', '1d'])

    expect(options.apply).toBe(true)
    expect(options.policy).toMatchObject({ production: '1m', preview: '1w' })
  })

  it('отказывается от срока, которого API не знает', () => {
    expect(() => parseArgs(['--production', '3d'])).toThrow(/1d, 1w/)
  })

  it('отказывается от незнакомого аргумента', () => {
    expect(() => parseArgs(['--all'])).toThrow(/неизвестный аргумент/)
  })
})
