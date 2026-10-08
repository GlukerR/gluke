<script setup lang="ts">
/* Карта «задача → формат»: слева, что нужно сделать с моделью, справа,
   какой файл для этого просить. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { web: 'Сайт, 3D-вьювер', ios: 'AR на iPhone и iPad', android: 'AR на Android', dcc: 'Другая 3D-программа', cad: 'Производство, CAD', simple: 'Простая геометрия' },
  en: { web: 'Website, 3D viewer', ios: 'AR on iPhone and iPad', android: 'AR on Android', dcc: 'Another 3D program', cad: 'Manufacturing, CAD', simple: 'Plain geometry' },
})

const rows = [
  { key: 'web', format: 'GLB' },
  { key: 'android', format: 'GLB' },
  { key: 'ios', format: 'USDZ' },
  { key: 'dcc', format: 'FBX' },
  { key: 'simple', format: 'OBJ' },
  { key: 'cad', format: 'STEP' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 330"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(row, index) in rows"
      :key="row.key"
      :transform="`translate(0 ${8 + index * 54})`"
    >
      <rect
        x="2"
        y="0"
        width="300"
        height="42"
        rx="21"
        class="soft s-line"
        stroke-width="2"
      />
      <text
        x="22"
        y="27"
        class="t-sm"
      >{{ L[row.key] }}</text>
      <path
        d="M 312 21 H 380 M 372 14 L 380 21 L 372 28"
        class="none s-acc round"
        stroke-width="2"
      />
      <rect
        x="392"
        y="0"
        width="120"
        height="42"
        rx="21"
        class="acc"
      />
      <text
        x="452"
        y="27"
        text-anchor="middle"
        class="t-b t-onacc"
      >{{ row.format }}</text>
    </g>
  </svg>
</template>
