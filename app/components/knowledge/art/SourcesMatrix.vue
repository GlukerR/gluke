<script setup lang="ts">
/* Четыре источника и две шкалы у каждого: насколько точно источник
   передаёт форму и внешний вид. Деления — 0…3, подробнее в таблице статьи. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { cad: 'CAD-модель', drawing: 'Чертежи', sample: 'Образец', photo: 'Фото', shape: 'Форма', look: 'Вид' },
  en: { cad: 'CAD model', drawing: 'Drawings', sample: 'Sample', photo: 'Photos', shape: 'Shape', look: 'Look' },
})

const cards = [
  { key: 'cad', x: 0, y: 0, shape: 3, look: 1 },
  { key: 'drawing', x: 270, y: 0, shape: 3, look: 0 },
  { key: 'sample', x: 0, y: 176, shape: 3, look: 3 },
  { key: 'photo', x: 270, y: 176, shape: 1, look: 2 },
] as const

const SEGMENTS = [0, 1, 2]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 336"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="card in cards"
      :key="card.key"
      :transform="`translate(${card.x} ${card.y})`"
    >
      <rect
        x="1"
        y="1"
        width="248"
        height="158"
        rx="14"
        class="soft s-line"
        stroke-width="2"
      />

      <!-- Иконки: каркас CAD, лист чертежа, сплошной образец, снимок. -->
      <g
        v-if="card.key === 'cad'"
        class="none round"
        stroke-width="2"
      >
        <path
          d="M 32 66 L 32 104 L 58 118 L 84 104 L 84 66"
          class="s-acc"
        />
        <path
          d="M 32 66 L 58 52 L 84 66 L 58 80 Z M 58 80 L 58 118"
          class="s-acc"
        />
        <path
          d="M 32 104 L 58 90 L 84 104 M 58 52 L 58 90"
          class="s-mut dash"
          stroke-width="1.5"
        />
      </g>
      <g v-else-if="card.key === 'drawing'">
        <rect
          x="24"
          y="44"
          width="68"
          height="84"
          rx="4"
          class="paper s-ink"
          stroke-width="2"
        />
        <rect
          x="38"
          y="74"
          width="40"
          height="36"
          class="none s-ink"
          stroke-width="2"
        />
        <path
          d="M 38 64 H 78 M 38 60 V 68 M 78 60 V 68"
          class="none s-acc"
          stroke-width="1.5"
        />
        <circle
          cx="58"
          cy="92"
          r="7"
          class="none s-ink"
          stroke-width="1.5"
        />
      </g>
      <g
        v-else-if="card.key === 'sample'"
        class="s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      >
        <polygon
          points="32,66 58,52 84,66 58,80"
          class="lit"
        />
        <polygon
          points="32,66 58,80 58,118 32,104"
          class="mid"
        />
        <polygon
          points="58,80 84,66 84,104 58,118"
          class="dark"
        />
      </g>
      <g v-else>
        <rect
          x="22"
          y="48"
          width="72"
          height="72"
          rx="8"
          class="paper s-ink"
          stroke-width="2"
        />
        <g
          class="s-ink"
          stroke-width="1.5"
          stroke-linejoin="round"
        >
          <polygon
            points="40,78 58,69 76,78 58,87"
            class="lit"
          />
          <polygon
            points="40,78 58,87 58,106 40,97"
            class="mid"
          />
          <polygon
            points="58,87 76,78 76,97 58,106"
            class="dark"
          />
        </g>
        <circle
          cx="82"
          cy="60"
          r="5"
          class="acc"
        />
      </g>

      <text
        x="116"
        y="46"
        class="t-b t-lg"
      >{{ L[card.key] }}</text>

      <text
        x="116"
        y="80"
        class="t-sm t-mut"
      >{{ L.shape }}</text>
      <rect
        v-for="index in SEGMENTS"
        :key="`s-${index}`"
        :x="116 + index * 37"
        y="88"
        width="32"
        height="10"
        rx="3"
        :class="index < card.shape ? 'acc' : 'linef'"
      />

      <text
        x="116"
        y="122"
        class="t-sm t-mut"
      >{{ L.look }}</text>
      <rect
        v-for="index in SEGMENTS"
        :key="`l-${index}`"
        :x="116 + index * 37"
        y="130"
        width="32"
        height="10"
        rx="3"
        :class="index < card.look ? 'acc' : 'linef'"
      />
    </g>
  </svg>
</template>
