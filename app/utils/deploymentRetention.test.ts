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
  policyMatches,
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

  it('метку из ответа PATCH отдаёт как есть', () => {
    expect(retentionLabel('1w')).toBe('1w')
    expect(retentionLabel('unlimited')).toBe('unlimited')
  })

  it('незнакомый срок показывает днями, а не роняет команду', () => {
    expect(retentionLabel(5)).toBe('5d')
  })

  it('отсутствующее значение — явная метка, а не пустая строка', () => {
    expect(retentionLabel(undefined)).toBe('(не задан)')
  })
})

describe('policyLabels', () => {
  /* Форма ответа `GET /v2/projects/{id}`: сроки приходят днями с суффиксом Days.
     Именно эта форма однажды показала «(не задан)» для проекта с явной политикой
     (проверка читала поля запроса), поэтому она закреплена тестом. */
  it('читает проектную форму ответа — дни в полях expirationDays*', () => {
    expect(policyLabels({
      expirationDays: 1,
      expirationDaysProduction: 7,
      expirationDaysCanceled: 30,
      expirationDaysErrored: 90,
      deploymentsToKeep: 10,
    })).toEqual({ preview: '1d', production: '1w', canceled: '1m', errored: '3m' })
  })

  it('читает и форму ответа PATCH — метки в полях expiration*', () => {
    expect(policyLabels({
      expiration: '1d',
      expirationProduction: '1w',
      expirationCanceled: '1d',
      expirationErrored: '1d',
    })).toEqual({ preview: '1d', production: '1w', canceled: '1d', errored: '1d' })
  })
})

describe('policyMatches', () => {
  it('считает политику совпавшей при разной записи одного срока', () => {
    expect(policyMatches(
      { preview: '1d', production: '1w', canceled: '1d', errored: '1d' },
      DEFAULT_RETENTION,
    )).toBe(true)
  })

  it('замечает расхождение по любой из четырёх категорий', () => {
    expect(policyMatches(
      { preview: '1d', production: '1m', canceled: '1d', errored: '1d' },
      DEFAULT_RETENTION,
    )).toBe(false)
  })
})

describe('expirationBody', () => {
  it('уходит в API метками: поля запроса не совпадают с полями ответа', () => {
    expect(expirationBody(DEFAULT_RETENTION)).toEqual({
      expiration: '1d',
      expirationProduction: '1w',
      expirationCanceled: '1d',
      expirationErrored: '1d',
    })
  })

  /* Живой API отказывает с 400 на поля ответа: `should NOT have additional
     property expirationDays`. Проверка держит эту границу, чтобы соблазн
     «упростить» форму запроса не дошёл до продакшена. */
  it('не отправляет поля с суффиксом Days, которых API в запросе не принимает', () => {
    expect(Object.keys(expirationBody(DEFAULT_RETENTION))).not.toContain('expirationDays')
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
