<script setup lang="ts">
/* Одна модель — много применений через месяцы и годы: новые рендеры,
   цвета, AR, просмотр на сайте, видео, печать. Без модели каждое из них —
   работа с нуля. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { model: '3D-модель', a: 'новый ракурс', b: 'новый цвет', c: 'AR', d: '3D на сайте', e: 'видео', f: 'печать' },
  en: { model: '3D model', a: 'new angle', b: 'new color', c: 'AR', d: '3D on site', e: 'video', f: 'print' },
})

const leaves = ['a', 'b', 'c', 'd', 'e', 'f'] as const

function leafPosition(index: number) {
  const angle = ((index / (leaves.length - 1)) * 156 - 168) * Math.PI / 180
  return { x: Math.round(260 + 210 * Math.cos(angle)), y: Math.round(236 + 190 * Math.sin(angle)) }
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 280"
    role="img"
    :aria-label="alt"
  >
    <line
      v-for="(leaf, index) in leaves"
      :key="`l-${leaf}`"
      x1="260"
      y1="226"
      :x2="leafPosition(index).x"
      :y2="leafPosition(index).y + 14"
      class="s-acc dash"
      stroke-width="1.5"
    />

    <g
      v-for="(leaf, index) in leaves"
      :key="leaf"
      :transform="`translate(${leafPosition(index).x} ${leafPosition(index).y})`"
    >
      <rect
        x="-52"
        y="-4"
        width="104"
        height="36"
        rx="18"
        class="soft s-acc"
        stroke-width="2"
      />
      <text
        x="0"
        y="19"
        text-anchor="middle"
        class="t-sm t-b"
      >{{ L[leaf] }}</text>
    </g>

    <g transform="translate(260 226)">
      <rect
        x="-74"
        y="-26"
        width="148"
        height="52"
        rx="26"
        class="acc"
      />
      <text
        x="0"
        y="6"
        text-anchor="middle"
        class="t-b t-onacc"
      >{{ L.model }}</text>
    </g>
  </svg>
</template>
