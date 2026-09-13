/*
 * Машины гаража (раздел VEHICLES) из контента кейса.
 *
 * Имя машины — из слага манифеста (`coupe-jdm.json` → COUPE JDM): марок в кейсе
 * нет, и новая машина получает подпись без правок кода. Машина из основного
 * `configurator.manifest` всегда в списке — без неё гараж не с чего открыть.
 */

export interface GarageVehicleInput {
  manifest: string
  name?: string
  /** Разворот модели, градусы; без него — `model.rotation` кейса. */
  rotation?: number
  thumb?: string
}

export interface GarageVehicle {
  id: string
  /** Номер слота в гараже: 01, 02… */
  index: string
  name: string
  manifest: string
  rotation?: number
  thumb?: string
}

/** Слаг машины — имя файла манифеста без расширения. */
export function vehicleSlug(manifest: string): string {
  return manifest.split('/').pop()?.replace(/\.json$/i, '') || 'car'
}

/** Подпись в HUD по слагу: `sedan-awd` → SEDAN AWD. */
export function vehicleNameFromSlug(slug: string): string {
  return slug.replace(/[-_]+/g, ' ').trim().toUpperCase()
}

export function buildGarageVehicles(
  defaultManifest: string,
  vehicles?: readonly GarageVehicleInput[],
): GarageVehicle[] {
  const list: GarageVehicleInput[] = vehicles?.length ? [...vehicles] : []
  if (!list.some(vehicle => vehicle.manifest === defaultManifest)) {
    list.unshift({ manifest: defaultManifest })
  }

  const seen = new Set<string>()
  const result: GarageVehicle[] = []
  for (const vehicle of list) {
    if (seen.has(vehicle.manifest)) continue
    seen.add(vehicle.manifest)
    const id = vehicleSlug(vehicle.manifest)
    result.push({
      id,
      index: String(result.length + 1).padStart(2, '0'),
      name: vehicle.name?.trim() || vehicleNameFromSlug(id),
      manifest: vehicle.manifest,
      rotation: vehicle.rotation,
      thumb: vehicle.thumb,
    })
  }
  return result
}
