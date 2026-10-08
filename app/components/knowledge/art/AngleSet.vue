<script setup lang="ts">
/* Единая сетка ракурсов: три разные модели серии сняты одинаковым набором
   кадров. Новая позиция встаёт в каталог рядом с прежними без переделок. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { front: 'спереди', quarter: '¾', side: 'сбоку', detail: 'деталь', model: 'модель' },
  en: { front: 'front', quarter: '¾', side: 'side', detail: 'detail', model: 'model' },
})

/* Пропорции моделей серии: ширина, высота и глубина в пикселях ячейки. */
const models = [
  { w: 34, h: 52, d: 22 },
  { w: 52, h: 36, d: 26 },
  { w: 26, h: 60, d: 18 },
]

const COLS = ['front', 'quarter', 'side', 'detail'] as const
const CELL = { x0: 92, y0: 40, w: 104, h: 86 }

function cellCenter(col: number, row: number) {
  return { x: CELL.x0 + col * CELL.w + 48, y: CELL.y0 + row * (CELL.h + 6) + 42 }
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 320"
    role="img"
    :aria-label="alt"
  >
    <text
      v-for="(col, index) in COLS"
      :key="col"
      :x="CELL.x0 + index * CELL.w + 48"
      y="26"
      text-anchor="middle"
      class="t-sm t-b"
    >{{ L[col] }}</text>

    <g
      v-for="(model, row) in models"
      :key="row"
    >
      <text
        x="14"
        :y="cellCenter(0, row).y + 6"
        class="t-sm t-mut"
      >{{ L.model }} {{ row + 1 }}</text>
      <rect
        v-for="(col, index) in COLS"
        :key="col"
        :x="CELL.x0 + index * CELL.w"
        :y="CELL.y0 + row * (CELL.h + 6)"
        width="96"
        :height="CELL.h"
        rx="6"
        class="paper s-line"
        stroke-width="1.5"
      />

      <!-- Спереди. -->
      <rect
        :x="cellCenter(0, row).x - model.w / 2"
        :y="cellCenter(0, row).y - model.h / 2"
        :width="model.w"
        :height="model.h"
        class="mid s-ink"
        stroke-width="1.5"
      />
      <!-- Три четверти. -->
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <polygon
          :points="`${cellCenter(1, row).x - model.w / 2},${cellCenter(1, row).y - model.h / 2} ${cellCenter(1, row).x + model.w / 2},${cellCenter(1, row).y - model.h / 2} ${cellCenter(1, row).x + model.w / 2 + model.d / 2},${cellCenter(1, row).y - model.h / 2 - model.d / 3} ${cellCenter(1, row).x - model.w / 2 + model.d / 2},${cellCenter(1, row).y - model.h / 2 - model.d / 3}`"
          class="lit"
        />
        <polygon
          :points="`${cellCenter(1, row).x + model.w / 2},${cellCenter(1, row).y - model.h / 2} ${cellCenter(1, row).x + model.w / 2 + model.d / 2},${cellCenter(1, row).y - model.h / 2 - model.d / 3} ${cellCenter(1, row).x + model.w / 2 + model.d / 2},${cellCenter(1, row).y + model.h / 2 - model.d / 3} ${cellCenter(1, row).x + model.w / 2},${cellCenter(1, row).y + model.h / 2}`"
          class="dark"
        />
        <rect
          :x="cellCenter(1, row).x - model.w / 2"
          :y="cellCenter(1, row).y - model.h / 2"
          :width="model.w"
          :height="model.h"
          class="mid"
        />
      </g>
      <!-- Сбоку. -->
      <rect
        :x="cellCenter(2, row).x - model.d / 2"
        :y="cellCenter(2, row).y - model.h / 2"
        :width="model.d"
        :height="model.h"
        class="dark s-ink"
        stroke-width="1.5"
      />
      <!-- Деталь: крупно ручка. -->
      <circle
        :cx="cellCenter(3, row).x"
        :cy="cellCenter(3, row).y"
        r="26"
        class="mid s-ink"
        stroke-width="1.5"
      />
      <circle
        :cx="cellCenter(3, row).x"
        :cy="cellCenter(3, row).y"
        r="12"
        class="lit s-ink"
        stroke-width="1.5"
      />
      <circle
        :cx="cellCenter(3, row).x"
        :cy="cellCenter(3, row).y"
        r="4"
        class="acc"
      />
    </g>
  </svg>
</template>
