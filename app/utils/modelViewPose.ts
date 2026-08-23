/**
 * Сохранение позы 3D-вьювера между перемонтированиями.
 *
 * Кейсовый вьювер (ProjectModelViewer) переживает смену языка целиком —
 * канвас, камера и контролы живут в viewerCache, поэтому модель остаётся
 * ровно в том положении, в котором её оставил пользователь. Вьювер главной
 * (GlukeLogo3D) пересоздаётся с нуля при смене локали: без этого хранилища
 * ручной поворот/наклон модели сбрасывались бы, и модель «прыгала» в
 * исходный ракурс.
 *
 * Ключ — путь к GLB (props.src), поэтому механизм работает для любой модели
 * автоматически: у каждой свой ключ, будущим вьюверам достаточно вызвать
 * getViewerPose/saveViewerPose с тем же src. Состояние живёт до перезагрузки
 * страницы (модульная область видимости).
 *
 * Прогресс раскрытия здесь не хранится намеренно: он выводится из позиции
 * скролла (scrollProgress), которую при смене языка сохраняет
 * router.options.ts — восстанавливать его не нужно.
 */
export interface ViewerPose {
  /** Поворот модели вокруг собственной оси (pivot.rotation.y), радианы. */
  rotationY?: number
  /** Наклон модели вперёд/назад (tiltPivot.rotation.x), радианы. */
  tiltX?: number
}

const poses = new Map<string, ViewerPose>()

export function getViewerPose(key: string): ViewerPose | undefined {
  return poses.get(key)
}

export function saveViewerPose(key: string, pose: ViewerPose): void {
  poses.set(key, pose)
}
