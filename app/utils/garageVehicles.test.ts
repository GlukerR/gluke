import { describe, expect, it } from 'vitest'
import { buildGarageVehicles, vehicleNameFromSlug, vehicleSlug } from './garageVehicles'

const base = '/media/projects/rp-grand/'

describe('vehicleSlug / vehicleNameFromSlug', () => {
  it('слаг — имя файла манифеста, подпись — слова слага прописными', () => {
    expect(vehicleSlug(`${base}coupe-jdm.json`)).toBe('coupe-jdm')
    expect(vehicleNameFromSlug('sedan-awd')).toBe('SEDAN AWD')
  })
})

describe('buildGarageVehicles', () => {
  it('без списка в гараже одна машина из основного манифеста', () => {
    expect(buildGarageVehicles(`${base}coupe-gt.json`)).toEqual([
      { id: 'coupe-gt', index: '01', name: 'COUPE GT', manifest: `${base}coupe-gt.json`, rotation: undefined, thumb: undefined },
    ])
  })

  it('номера по порядку списка, поворот и миниатюра переносятся, имя можно задать', () => {
    const vehicles = buildGarageVehicles(`${base}coupe-gt.json`, [
      { manifest: `${base}coupe-gt.json`, thumb: '/t/gt.webp' },
      { manifest: `${base}coupe-jdm.json`, rotation: 90, name: 'R-Coupe' },
    ])
    expect(vehicles.map(v => [v.index, v.id, v.name, v.rotation, v.thumb])).toEqual([
      ['01', 'coupe-gt', 'COUPE GT', undefined, '/t/gt.webp'],
      ['02', 'coupe-jdm', 'R-Coupe', 90, undefined],
    ])
  })

  it('основная машина, забытая в списке, встаёт первой; дубли отбрасываются', () => {
    const vehicles = buildGarageVehicles(`${base}coupe-gt.json`, [
      { manifest: `${base}sedan.json` },
      { manifest: `${base}sedan.json` },
    ])
    expect(vehicles.map(v => `${v.index}:${v.id}`)).toEqual(['01:coupe-gt', '02:sedan'])
  })
})
