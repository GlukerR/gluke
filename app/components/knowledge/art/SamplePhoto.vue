<script setup lang="ts">
import Camera from './parts/Camera.vue'

/* Как снять образец материала. Для цвета — сверху, при рассеянном свете,
   рядом с белым листом: по нему видно, насколько камера сдвинула баланс
   белого. Для фактуры — свет низко сбоку, тогда рельеф отбрасывает тень. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { colorTitle: 'Цвет: сверху, рядом с белым листом', textureTitle: 'Фактура: свет низко сбоку', sheet: 'белый лист', sample: 'образец', window: 'окно', note1: 'по листу видно,', note2: 'как камера сдвинула цвет', note3: 'рельеф отбрасывает', note4: 'тень — фактура видна' },
  en: { colorTitle: 'Color: from above, next to white paper', textureTitle: 'Texture: low side light', sheet: 'white paper', sample: 'sample', window: 'window', note1: 'the paper shows how', note2: 'the camera shifted color', note3: 'the relief casts', note4: 'shadows, texture shows' },
})

/* Рельеф поверхности: волна из полуокружностей. Каждый бугорок даёт тень
   справа — свет приходит слева. */
const bumps = Array.from({ length: 7 }, (_, index) => 82 + index * 34)
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 400"
    role="img"
    :aria-label="alt"
  >
    <!-- Цвет: вид сверху. -->
    <text
      x="20"
      y="30"
      class="t-b"
    >{{ L.colorTitle }}</text>
    <rect
      x="22"
      y="70"
      width="40"
      height="96"
      rx="4"
      class="lit s-ink"
      stroke-width="2"
    />
    <line
      x1="42"
      y1="70"
      x2="42"
      y2="166"
      class="s-ink"
      stroke-width="1.5"
    />
    <line
      x1="22"
      y1="118"
      x2="62"
      y2="118"
      class="s-ink"
      stroke-width="1.5"
    />
    <text
      x="42"
      y="186"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.window }}</text>
    <g
      class="s-acc dash"
      stroke-width="1.5"
    >
      <line
        x1="70"
        y1="96"
        x2="168"
        y2="156"
      />
      <line
        x1="70"
        y1="130"
        x2="228"
        y2="156"
      />
    </g>

    <!-- Вид сбоку: лист и образец лежат на столе, камера смотрит вниз. -->
    <line
      x1="100"
      y1="172"
      x2="300"
      y2="172"
      class="s-line"
      stroke-width="2"
    />
    <rect
      x="116"
      y="164"
      width="168"
      height="8"
      class="glow s-line"
      stroke-width="1.5"
    />
    <rect
      x="168"
      y="156"
      width="64"
      height="8"
      class="acc s-ink"
      stroke-width="1.5"
    />
    <line
      x1="200"
      y1="100"
      x2="200"
      y2="150"
      class="s-mut dash"
      stroke-width="1.5"
    />
    <Camera
      :x="200"
      :y="80"
      :angle="90"
    />
    <text
      x="136"
      y="196"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.sheet }}</text>
    <text
      x="250"
      y="196"
      text-anchor="middle"
      class="t-sm t-acc"
    >{{ L.sample }}</text>
    <text
      x="336"
      y="110"
      class="t-sm t-mut"
    >{{ L.note1 }}</text>
    <text
      x="336"
      y="132"
      class="t-sm t-mut"
    >{{ L.note2 }}</text>

    <line
      x1="16"
      y1="214"
      x2="504"
      y2="214"
      class="s-line"
      stroke-width="1"
    />

    <!-- Фактура: вид сбоку, свет скользит по поверхности. -->
    <text
      x="20"
      y="246"
      class="t-b"
    >{{ L.textureTitle }}</text>
    <rect
      x="60"
      y="336"
      width="250"
      height="36"
      class="mid s-ink"
      stroke-width="2"
    />
    <g
      v-for="x in bumps"
      :key="x"
    >
      <polygon
        :points="`${x + 12},336 ${x + 34},336 ${x + 22},328`"
        class="shadow"
      />
      <path
        :d="`M ${x - 12} 336 A 12 12 0 0 1 ${x + 12} 336 Z`"
        class="lit s-ink"
        stroke-width="1.5"
      />
    </g>
    <circle
      cx="28"
      cy="312"
      r="10"
      class="glow s-ink"
      stroke-width="1.5"
    />
    <g
      class="s-acc dash"
      stroke-width="1.5"
    >
      <line
        x1="40"
        y1="316"
        x2="130"
        y2="327"
      />
      <line
        x1="40"
        y1="312"
        x2="240"
        y2="325"
      />
    </g>
    <line
      x1="186"
      y1="286"
      x2="186"
      y2="318"
      class="s-mut dash"
      stroke-width="1.5"
    />
    <Camera
      :x="186"
      :y="268"
      :angle="90"
      :scale="0.8"
    />
    <text
      x="330"
      y="336"
      class="t-sm t-acc"
    >{{ L.note3 }}</text>
    <text
      x="330"
      y="358"
      class="t-sm t-acc"
    >{{ L.note4 }}</text>
  </svg>
</template>
