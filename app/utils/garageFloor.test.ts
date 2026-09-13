import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { garageFloorLevel } from './garageFloor'

/*
 * Посадка по габариту гаража утапливала машину в пол: у зала по периметру идёт
 * плинтус ниже плиты, поэтому низ габарита — не пол. Пробы идут по габариту
 * машины, поэтому проверяем именно то, что мешает: плинтус в стороне, реквизит
 * и лампа над машиной.
 */

function floorAt(y: number, size = 40) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial())
  mesh.rotation.x = -Math.PI / 2
  mesh.position.y = y
  return mesh
}

function box(size: [number, number, number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial())
  return mesh
}

/* Габарит машины: 2,15 × 1,39 × 5,16 м. */
const carBox = new THREE.Box3(new THREE.Vector3(-1.08, 0.3, -1.72), new THREE.Vector3(1.08, 1.69, 3.44))
const probe = { footprint: carBox, from: carBox.max.y + 0.5 }

describe('garageFloorLevel', () => {
  it('берёт уровень пола, а не нижнюю точку габарита гаража', () => {
    const garage = new THREE.Group()
    garage.add(floorAt(0.084))
    /* Плинтус вдоль стены: он и есть низ габарита, но машине под колёса не идёт. */
    const plinth = box([1, 0.25, 20])
    plinth.position.set(-12, 0.075, 0)
    garage.add(plinth)
    expect(new THREE.Box3().setFromObject(garage).min.y).toBeCloseTo(-0.05, 3)
    expect(garageFloorLevel(THREE, garage, probe)).toBeCloseTo(0.084, 3)
  })

  it('не поднимает машину на реквизит над ней', () => {
    const garage = new THREE.Group()
    garage.add(floorAt(0.084))
    const lamp = box([2.4, 0.6, 5.4])
    lamp.position.set(0, 3, 0.8)
    garage.add(lamp)
    expect(garageFloorLevel(THREE, garage, probe)).toBeCloseTo(0.084, 3)
  })

  it('не поднимает машину на предмет, стоящий на полу под ней', () => {
    const garage = new THREE.Group()
    garage.add(floorAt(0.084))
    const crate = box([0.4, 0.8, 0.4])
    crate.position.set(0, 0.48, 0.8)
    garage.add(crate)
    expect(garageFloorLevel(THREE, garage, probe)).toBeCloseTo(0.084, 3)
  })

  it('считает пол повёрнутого окружения в мировых координатах', () => {
    const garage = new THREE.Group()
    const floor = floorAt(0)
    floor.position.y = 0.084
    garage.add(floor)
    const ramp = box([2, 0.5, 2])
    ramp.position.set(0, 0.25, 0)
    garage.add(ramp)
    garage.rotation.y = Math.PI / 6
    /* Под машиной после поворота — только пол: откос уехал вбок. */
    expect(garageFloorLevel(THREE, garage, probe)).toBeCloseTo(0.084, 3)
  })

  it('возвращает null, если под габаритом ничего нет', () => {
    const garage = new THREE.Group()
    const farFloor = floorAt(0.084, 2)
    farFloor.position.set(30, 0.084, 30)
    garage.add(farFloor)
    const far = box([0.5, 0.5, 0.5])
    far.position.set(30, 0.25, 30)
    garage.add(far)
    expect(garageFloorLevel(THREE, garage, probe)).toBeNull()
  })
})
