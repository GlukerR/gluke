import type * as THREE from 'three'

/*
 * Атмосфера зала: подземная мастерская, а не студия. Свет вьювера по умолчанию
 * нейтрально-белый — под прозрачный фон сайта. В гараже он становится тёплым
 * вольфрамом с оранжевыми практическими лампами над полом, холодный голубой
 * остаётся только слабым контровым акцентом. Дальние стены уходят в тёплую
 * дымку, а под машиной ложится мягкая контактная тень — без неё кузов
 * читается висящим над плитой пола.
 *
 * Интенсивности ключевого и заполняющего света не трогаем: кузов, оптика
 * и покрытия настроены под них (см. changes-log §50–§55). Меняется только
 * цвет — температура сцены.
 */

export const GARAGE_LIGHT = {
  /* Небо полусферы — тёплый потолок, земля — грязный бетон. */
  hemisphereSky: 0xffd9b0,
  hemisphereGround: 0x2b1d14,
  /* Ключевой свет — лампа накаливания. */
  key: 0xffc896,
  /* Заполняющий — холодный технический контровой, приглушённый. */
  fill: 0x9fdcff,
  fillScale: 0.7,
  /* Практические лампы: оранжевые пятна на полу по сторонам машины. */
  practical: 0xff8a3d,
  practicalIntensity: 9,
  practicalDistance: 9,
  practicalHeight: 3.2,
  /* Дымка: начинается за машиной и съедает дальние стены. */
  fog: 0x140e0a,
  fogNear: 11,
  fogFar: 34,
} as const

/*
 * Тон материалов зала. Карты зала светлые и нейтральные (бетон под дневным
 * светом), а материалы белые — под тёплым вольфрамом пол выходил выбеленной
 * плитой. Множитель цвета темнит и греет каждую группу по имени материала;
 * светильники получают свечение своей же картой — лампы на потолке горят.
 */
export const GARAGE_TINT: readonly { match: RegExp, color: number, emissive?: number, emissiveIntensity?: number }[] = [
  { match: /ground|floor/i, color: 0x5f5247 },
  { match: /wall/i, color: 0x7a6a5c },
  { match: /pillar|column/i, color: 0x85735f },
  { match: /light|lamp/i, color: 0xffffff, emissive: 0xffb070, emissiveIntensity: 1.6 },
]

function tintGarage(garage: THREE.Object3D): void {
  const seen = new Set<THREE.Material>()
  garage.traverse((object) => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (seen.has(material)) continue
      seen.add(material)
      const standard = material as THREE.MeshStandardMaterial
      const tint = GARAGE_TINT.find(item => item.match.test(material.name))
      if (!tint || !standard.color) continue
      standard.color.setHex(tint.color)
      if (tint.emissive !== undefined && standard.map) {
        standard.emissive.setHex(tint.emissive)
        standard.emissiveMap = standard.map
        standard.emissiveIntensity = tint.emissiveIntensity ?? 1
      }
      standard.needsUpdate = true
    }
  })
}

export interface GarageDressInput {
  scene: THREE.Scene
  /** Сам зал: его материалы темнеют и теплеют. */
  garage: THREE.Object3D
  hemisphere: THREE.HemisphereLight
  key: THREE.DirectionalLight
  fill: THREE.DirectionalLight
  /** Габарит машины в мире и уровень пола под ней. */
  carBox: THREE.Box3
  floorY: number
}

/** Всё, что атмосфера добавила в сцену, — чтобы освободить вместе с ней. */
export interface GarageDressing {
  shadow: THREE.Mesh
  practicals: THREE.PointLight[]
}

/* Контактная тень — радиальный градиент на канвасе: дешевле теневых карт
   и мягче их, а на статичной машине разницы не видно. */
function contactShadowTexture(three: typeof import('three')): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (context) {
    const gradient = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
    gradient.addColorStop(0, 'rgba(0,0,0,0.95)')
    gradient.addColorStop(0.45, 'rgba(0,0,0,0.7)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
  }
  const texture = new three.CanvasTexture(canvas)
  texture.colorSpace = three.SRGBColorSpace
  return texture
}

/** Тень по габариту машины: смена машины в гараже подгоняет ту же плоскость. */
export function fitContactShadow(shadow: THREE.Object3D, carBox: THREE.Box3, floorY: number): void {
  const size = carBox.getSize(shadow.position.clone())
  const center = carBox.getCenter(shadow.position.clone())
  /* Плоскость повёрнута на −90° по X: её локальная Y лежит вдоль мировой Z. */
  shadow.scale.set(size.x * 1.22, size.z * 1.12, 1)
  shadow.position.set(center.x, floorY + 0.004, center.z)
}

export function dressGarage(three: typeof import('three'), input: GarageDressInput): GarageDressing {
  const { scene, garage, hemisphere, key, fill, carBox, floorY } = input

  tintGarage(garage)

  hemisphere.color.setHex(GARAGE_LIGHT.hemisphereSky)
  hemisphere.groundColor.setHex(GARAGE_LIGHT.hemisphereGround)
  key.color.setHex(GARAGE_LIGHT.key)
  fill.color.setHex(GARAGE_LIGHT.fill)
  fill.intensity *= GARAGE_LIGHT.fillScale

  scene.fog = new three.Fog(GARAGE_LIGHT.fog, GARAGE_LIGHT.fogNear, GARAGE_LIGHT.fogFar)

  const center = carBox.getCenter(new three.Vector3())
  const size = carBox.getSize(new three.Vector3())
  /* Лампы стоят вдоль длинной оси машины, по обе стороны от неё. */
  const alongZ = size.z >= size.x
  const across = (alongZ ? size.x : size.z) * 0.5 + 2.2
  const along = (alongZ ? size.z : size.x) * 0.18
  const practicals: THREE.PointLight[] = []
  for (const sign of [-1, 1]) {
    const light = new three.PointLight(
      GARAGE_LIGHT.practical,
      GARAGE_LIGHT.practicalIntensity,
      GARAGE_LIGHT.practicalDistance,
      2,
    )
    light.position.set(
      center.x + (alongZ ? sign * across : sign * along),
      floorY + GARAGE_LIGHT.practicalHeight,
      center.z + (alongZ ? -sign * along : sign * across),
    )
    scene.add(light)
    practicals.push(light)
  }

  const shadow = new three.Mesh(
    new three.PlaneGeometry(1, 1),
    new three.MeshBasicMaterial({
      map: contactShadowTexture(three),
      transparent: true,
      depthWrite: false,
      opacity: 0.78,
      /* Тень не должна светлеть в дымке — она лежит у самой машины. */
      fog: false,
    }),
  )
  shadow.name = 'garage-contact-shadow'
  shadow.rotation.x = -Math.PI / 2
  fitContactShadow(shadow, carBox, floorY)
  shadow.renderOrder = 1
  scene.add(shadow)

  return { shadow, practicals }
}
