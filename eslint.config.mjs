// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  {
    /* ES5-стиль этого файла правилами проекта не выправляем: виджет перенесён
       из отдельного скрипта пирамиды и сверяется с ним, а переформатирование
       порвало бы эту связь. Правки здесь точечные, не косметические. */
    ignores: ['app/utils/gluke-pyramid.js'],
  },
)
