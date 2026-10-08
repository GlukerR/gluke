<script setup lang="ts">
import Camera from './parts/Camera.vue'

/* Шесть цветов одного товара. Фото: под каждый цвет нужен свой образец и
   своя съёмка. 3D: одна модель, цвет переключается материалом. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { photo: 'Фото: шесть образцов, шесть съёмок', render: '3D: одна модель, шесть цветов', model: 'модель' },
  en: { photo: 'Photo: six samples, six shoots', render: '3D: one model, six colors', model: 'model' },
})

const TONES = ['lit', 'mid', 'dark', 'acc', 'soft2', 'clay-mid'] as const

function boxPoints(x: number, y: number) {
  return {
    top: `${x},${y + 12} ${x + 30},${y + 12} ${x + 40},${y + 4} ${x + 10},${y + 4}`,
    side: `${x + 30},${y + 12} ${x + 40},${y + 4} ${x + 40},${y + 40} ${x + 30},${y + 48}`,
  }
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 330"
    role="img"
    :aria-label="alt"
  >
    <text
      x="12"
      y="24"
      class="t-b"
    >{{ L.photo }}</text>
    <g
      v-for="(tone, index) in TONES"
      :key="`p-${tone}`"
      :transform="`translate(${12 + index * 84} 44)`"
    >
      <rect
        x="0"
        y="0"
        width="76"
        height="104"
        rx="8"
        class="paper s-line"
        stroke-width="1.5"
      />
      <Camera
        :x="38"
        :y="22"
        :angle="90"
        :scale="0.7"
      />
      <g
        class="s-ink"
        stroke-width="1.2"
        stroke-linejoin="round"
      >
        <polygon
          :points="boxPoints(18, 44).top"
          :class="tone"
        />
        <polygon
          :points="boxPoints(18, 44).side"
          :class="tone"
          opacity="0.75"
        />
        <rect
          x="18"
          y="56"
          width="30"
          height="36"
          :class="tone"
        />
      </g>
    </g>

    <line
      x1="12"
      y1="168"
      x2="508"
      y2="168"
      class="s-line"
      stroke-width="1"
    />

    <text
      x="12"
      y="196"
      class="t-b"
    >{{ L.render }}</text>
    <g transform="translate(12 212)">
      <rect
        x="0"
        y="0"
        width="92"
        height="104"
        rx="8"
        class="soft2 s-acc"
        stroke-width="2"
      />
      <g
        class="none s-acc round"
        stroke-width="2"
      >
        <path d="M 30 36 L 50 26 L 70 36 L 50 46 Z M 30 36 V 70 L 50 80 L 70 70 V 36 M 50 46 V 80" />
      </g>
      <text
        x="46"
        y="98"
        text-anchor="middle"
        class="t-sm t-acc"
      >{{ L.model }}</text>
    </g>
    <path
      d="M 112 264 H 136 M 128 257 L 136 264 L 128 271"
      class="none s-acc round"
      stroke-width="2.5"
    />
    <g
      v-for="(tone, index) in TONES"
      :key="`r-${tone}`"
      :transform="`translate(${148 + index * 60} 236)`"
    >
      <g
        class="s-ink"
        stroke-width="1.2"
        stroke-linejoin="round"
      >
        <polygon
          :points="boxPoints(8, 0).top"
          :class="tone"
        />
        <polygon
          :points="boxPoints(8, 0).side"
          :class="tone"
          opacity="0.75"
        />
        <rect
          x="8"
          y="12"
          width="30"
          height="36"
          :class="tone"
        />
      </g>
    </g>
  </svg>
</template>
