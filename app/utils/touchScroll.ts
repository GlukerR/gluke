/**
 * Общая политика жестов для всех 3D-вьюверов сайта.
 *
 * Проблема: на тач-устройствах канвас 3D-модели перехватывает вертикальный
 * свайп (вращение модели), и пользователь не может пролистать страницу мимо
 * модели. Решение — разделить жесты по направлению: вертикальный свайп
 * отдаём браузеру (скролл страницы), горизонтальный оставляем вьюверу
 * (вращение модели).
 *
 * Механика:
 * - `touch-action: pan-y` на канвасе — браузер сам обрабатывает вертикальную
 *   прокрутку и шлёт pointercancel вьюверу, когда забирает жест;
 * - на десктопе (мышь, pointer: fine) ничего не меняем — вращение и наклон
 *   работают как раньше.
 *
 * Используется всеми вьюверами:
 * - GlukeLogo3D.vue — модель на главной (свой pointer-обработчик);
 * - ProjectModelViewer.vue — модели в кейсах (OrbitControls: при connect()
 *   ставит inline `touch-action: none`, который перекрывает CSS, поэтому
 *   здесь его нужно перекрывать стилем из JS).
 */
export function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches
}

export function applyTouchScrollPolicy(canvas: HTMLCanvasElement): void {
  if (isCoarsePointer()) {
    canvas.style.touchAction = 'pan-y'
  }
}
