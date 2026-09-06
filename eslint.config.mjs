// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    /* Вендоренный код форматируем не мы: `pleprism.js` — самостоятельный виджет
       студии (кейс `pleprism`), перенесённый один в один, чтобы его можно было
       сверять с оригиналом. Приводить ES5-стиль к правилам проекта означало бы
       порвать эту связь ради файла, который мы не редактируем. */
    ignores: ['app/utils/pleprism.js'],
  },
)
