<script setup lang="ts">
/* Что хранит каждый формат. Полный кружок — хранит, половина — частично
   или не всегда, пустой — нет. Подробности — в таблице статьи. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { geometry: 'Геометрия', materials: 'Материалы', textures: 'Текстуры внутри', animation: 'Анимация', exact: 'Точные поверхности', yes: 'да', part: 'частично', no: 'нет' },
  en: { geometry: 'Geometry', materials: 'Materials', textures: 'Textures inside', animation: 'Animation', exact: 'Exact surfaces', yes: 'yes', part: 'partly', no: 'no' },
})

const FEATURES = ['geometry', 'materials', 'textures', 'animation', 'exact'] as const

/* 2 — да, 1 — частично, 0 — нет; порядок как в FEATURES. */
const formats = [
  { name: 'GLB', values: [2, 2, 2, 2, 0] },
  { name: 'FBX', values: [2, 1, 1, 2, 0] },
  { name: 'OBJ', values: [2, 1, 0, 0, 0] },
  { name: 'USDZ', values: [2, 2, 2, 1, 0] },
  { name: 'STEP', values: [2, 0, 0, 0, 2] },
]

const COL = { x0: 196, w: 64 }
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 330"
    role="img"
    :aria-label="alt"
  >
    <text
      v-for="(format, index) in formats"
      :key="format.name"
      :x="COL.x0 + index * COL.w"
      y="24"
      text-anchor="middle"
      class="t-b"
    >{{ format.name }}</text>

    <g
      v-for="(feature, row) in FEATURES"
      :key="feature"
      :transform="`translate(0 ${44 + row * 46})`"
    >
      <rect
        x="2"
        y="0"
        width="516"
        height="38"
        rx="8"
        :class="row % 2 ? 'paper' : 'soft'"
      />
      <text
        x="14"
        y="25"
        class="t-sm"
      >{{ L[feature] }}</text>
      <g
        v-for="(format, index) in formats"
        :key="format.name"
        :transform="`translate(${COL.x0 + index * COL.w} 19)`"
      >
        <circle
          r="10"
          :class="format.values[row] === 2 ? 'acc' : 'none'"
          class="s-acc"
          stroke-width="2"
        />
        <path
          v-if="format.values[row] === 1"
          d="M 0 -10 A 10 10 0 0 1 0 10 Z"
          class="acc"
        />
      </g>
    </g>

    <g transform="translate(14 300)">
      <circle
        cx="8"
        cy="0"
        r="8"
        class="acc s-acc"
        stroke-width="2"
      />
      <text
        x="24"
        y="5"
        class="t-sm t-mut"
      >{{ L.yes }}</text>
      <g transform="translate(90 0)">
        <circle
          cx="8"
          cy="0"
          r="8"
          class="none s-acc"
          stroke-width="2"
        />
        <path
          d="M 8 -8 A 8 8 0 0 1 8 8 Z"
          class="acc"
        />
        <text
          x="24"
          y="5"
          class="t-sm t-mut"
        >{{ L.part }}</text>
      </g>
      <g transform="translate(206 0)">
        <circle
          cx="8"
          cy="0"
          r="8"
          class="none s-acc"
          stroke-width="2"
        />
        <text
          x="24"
          y="5"
          class="t-sm t-mut"
        >{{ L.no }}</text>
      </g>
    </g>
  </svg>
</template>
