<script setup lang="ts">
/* Один рендер — три кадра: 3:4 для маркетплейсов, 1:1, 16:9 для баннера
   на сайте. Рамки наложены на общий кадр: если вокруг товара есть воздух,
   из одного рендера получаются все три. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { tall: '3:4 — WB, Ozon', square: '1:1 — соцсети', wide: '16:9 — баннер', air: 'воздух вокруг товара' },
  en: { tall: '3:4 — marketplaces', square: '1:1 — social', wide: '16:9 — banner', air: 'room around it' },
})

/* Общий кадр 300×240 с товаром в центре (cx 166, cy 140). */
const frames = [
  { key: 'wide', x: 16, y: 56, w: 300, h: 169, cls: 's-mut' },
  { key: 'square', x: 76, y: 50, w: 180, h: 180, cls: 's-ink' },
  { key: 'tall', x: 106, y: 40, w: 120, h: 160, cls: 's-acc' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 260"
    role="img"
    :aria-label="alt"
  >
    <rect
      x="16"
      y="20"
      width="300"
      height="230"
      rx="6"
      class="soft"
    />
    <ellipse
      cx="166"
      cy="176"
      rx="40"
      ry="6"
      class="shadow"
    />
    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <polygon
        points="136,104 186,104 200,92 150,92"
        class="lit"
      />
      <polygon
        points="186,104 200,92 200,160 186,174"
        class="dark"
      />
      <rect
        x="136"
        y="104"
        width="50"
        height="70"
        class="mid"
      />
    </g>

    <rect
      v-for="frame in frames"
      :key="frame.key"
      :x="frame.x"
      :y="frame.y"
      :width="frame.w"
      :height="frame.h"
      class="none"
      :class="frame.cls"
      stroke-width="2.5"
      :stroke-dasharray="frame.key === 'wide' ? '8 6' : undefined"
    />

    <g transform="translate(336 80)">
      <g
        v-for="(frame, index) in [...frames].reverse()"
        :key="frame.key"
        :transform="`translate(0 ${index * 36})`"
      >
        <rect
          x="0"
          y="-10"
          width="24"
          height="14"
          rx="2"
          class="none"
          :class="frame.cls"
          stroke-width="2.5"
          :stroke-dasharray="frame.key === 'wide' ? '5 3' : undefined"
        />
        <text
          x="34"
          y="2"
          class="t-sm"
        >{{ L[frame.key] }}</text>
      </g>
      <text
        x="0"
        y="122"
        class="t-sm t-mut"
      >{{ L.air }}</text>
    </g>
  </svg>
</template>
