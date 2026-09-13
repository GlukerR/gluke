/*
 * Математика камеры гаража без three: плавные подъезды к деталям обвеса
 * и сдвиг кадра под панель HUD. Всё в радианах и в тех же осях, что у
 * OrbitControls: азимут θ — atan2(x, z) от цели облёта, полярный угол φ —
 * от вертикали (0 — строго сверху, π/2 — на высоте цели).
 */

const TAU = Math.PI * 2

/** Кратчайший поворот от `from` к `to`: результат в (−π, π]. */
export function shortestAngleDelta(from: number, to: number): number {
  let delta = (to - from) % TAU
  if (delta > Math.PI) delta -= TAU
  if (delta <= -Math.PI) delta += TAU
  return delta
}

/** Из нескольких азимутов — ближайший к текущему (по кратчайшему повороту). */
export function nearestAngle(current: number, candidates: readonly number[]): number {
  let best = candidates[0] ?? current
  let bestDistance = Infinity
  for (const candidate of candidates) {
    const distance = Math.abs(shortestAngleDelta(current, candidate))
    if (distance < bestDistance) {
      best = candidate
      bestDistance = distance
    }
  }
  return best
}

/** Плавный старт и плавная остановка: камера не дёргается ни в начале, ни в конце. */
export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t))
  return x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2
}

/** Подъём над горизонтом (градусы) → полярный угол OrbitControls. */
export function polarFromElevation(degrees: number): number {
  return ((90 - degrees) * Math.PI) / 180
}

/*
 * Как смотреть на деталь. `end` — деталь на торце машины (бамперы, спойлер):
 * камера встаёт в три четверти к ней, на `turn` градусов от оси торца.
 * `side` — деталь по борту (юбки): камера встаёт сбоку, перпендикулярно
 * длинной оси. Подъём — небольшой: это подъезд к детали, а не смена плана.
 */
export interface GarageFocusSpec {
  view: 'end' | 'side'
  elevation: number
  turn: number
}

export const GARAGE_FOCUS: Readonly<Record<string, GarageFocusSpec>> = {
  bumper_front: { view: 'end', elevation: 11, turn: 36 },
  bumper_rear: { view: 'end', elevation: 13, turn: 36 },
  spoiler: { view: 'end', elevation: 24, turn: 40 },
  skirt: { view: 'side', elevation: 7, turn: 0 },
}

export interface FocusInput {
  spec: GarageFocusSpec
  /** Текущий азимут камеры. */
  theta: number
  /** Смещение центра детали от цели облёта по X и Z (для `end`). */
  part?: { x: number, z: number }
  /** Габарит машины по X и Z: длинная ось задаёт борт (для `side`). */
  size?: { x: number, z: number }
}

/**
 * Азимут, на который встаёт камера для детали. Из двух симметричных ракурсов
 * берётся ближайший к текущему — камера не облетает машину через всю сцену.
 * `null` — данных для ракурса нет (деталь не нашлась), камера остаётся.
 */
export function focusAzimuth({ spec, theta, part, size }: FocusInput): number | null {
  if (spec.view === 'side') {
    if (!size) return null
    /* Длинная ось по Z — борта смотрят в ±X (θ = ±π/2), иначе в ±Z. */
    const side = size.z >= size.x ? Math.PI / 2 : 0
    return nearestAngle(theta, [side, side + Math.PI])
  }
  if (!part || (Math.abs(part.x) < 1e-6 && Math.abs(part.z) < 1e-6)) return null
  const base = Math.atan2(part.x, part.z)
  const turn = (spec.turn * Math.PI) / 180
  return nearestAngle(theta, [base + turn, base - turn])
}

/**
 * Сдвиг кадра под открытую панель, в пикселях канваса. На широком экране
 * панель стоит слева, и машина уходит вправо на половину занятой полосы;
 * на узком панель — шторка снизу, и машина поднимается над ней.
 * Положительный `x` — вправо, положительный `y` — вверх.
 */
export function viewShiftForPanel(input: {
  width: number
  height: number
  narrow: boolean
  panel: { right: number, height: number } | null
}): { x: number, y: number } {
  if (!input.panel) return { x: 0, y: 0 }
  if (input.narrow) {
    return { x: 0, y: Math.min(input.panel.height, input.height * 0.55) * 0.42 }
  }
  return { x: Math.min(input.panel.right, input.width * 0.4) * 0.5, y: 0 }
}
