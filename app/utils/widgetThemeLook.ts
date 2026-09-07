/* Общий «внешний вид по теме сайта» для WebGL-виджетов. Используется и на
   кейсах, и на живых карточках проектов, чтобы превью на карточке выглядело
   так же, как виджет в самом кейсе, в обеих темах (тёмной и светлой).
   Меняется в одном месте — компоненты только импортируют. */

export type PyramidThemeParams = Record<string, unknown>

/* Пирамида живёт на фоне темы сайта, как звёздное поле: собственного тёмного
   экрана у неё больше нет. Свечение в тёмной теме — как настроено в кейсе,
   а в светлой пирамида приглушается (тёмная подложка убрана, и неон по
   белому фону выцветает): `wash` ровно затемняет каналы, не сдвигая оттенок,
   `vividness` держит насыщенность. Ползунки лаборатории поверх темы не
   теряются — `tuned` ложится последним. */
export const PYRAMID_THEME_LOOK: Record<'dark' | 'light', PyramidThemeParams> = {
  dark: {},
  light: {
    wash: '#7e7e9c',
    vividness: 1.8,
    flare: 0.75,
  },
}

export interface ConstellationThemeColors {
  palette: string[]
  linkColor: string
  auraColor: string
  coreColor: string
}

/* Палитра и цвета поля под тему сайта. Тёмная тема — светящиеся пастели на
   тёмном фоне, светлая — «чернильные» оттенки, читаемые на светлом фоне.
   Выбор делает цвет colorMode: у поля нет собственного тёмного экрана. */
export const CONSTELLATION_THEME_COLORS: Record<'dark' | 'light', ConstellationThemeColors> = {
  dark: {
    palette: ['#7dd3fc', '#818cf8', '#e879f9'],
    linkColor: '#a5b4fc',
    auraColor: '#818cf8',
    coreColor: '#e0e7ff',
  },
  light: {
    palette: ['#1e40af', '#6d28d9', '#be185d'],
    linkColor: '#4c1d95',
    auraColor: '#4f46e5',
    coreColor: '#312e81',
  },
}