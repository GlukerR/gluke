<script setup lang="ts">
/* Переключение LOD по расстоянию: камера слева, три зоны дальности. Чем
   дальше объект, тем меньше он на экране и тем проще версия. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { near: 'близко', mid: 'средне', far: 'далеко' },
  en: { near: 'near', mid: 'mid', far: 'far' },
})

const zones = [
  { key: 'near', lod: 'LOD0', x: 90, w: 130, size: 1, cls: 'soft2' },
  { key: 'mid', lod: 'LOD1', x: 220, w: 140, size: 0.6, cls: 'soft' },
  { key: 'far', lod: 'LOD2', x: 360, w: 150, size: 0.35, cls: 'paper' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 210"
    role="img"
    :aria-label="alt"
  >
    <rect
      v-for="zone in zones"
      :key="`z-${zone.key}`"
      :x="zone.x"
      y="30"
      :width="zone.w"
      height="120"
      :class="zone.cls"
      class="s-line"
      stroke-width="1"
    />

    <!-- Камера и лучи взгляда. -->
    <g transform="translate(40 90)">
      <rect
        x="-16"
        y="-12"
        width="22"
        height="24"
        rx="4"
        class="acc"
      />
      <path
        d="M 6 -7 L 16 -11 L 16 11 L 6 7 Z"
        class="acc2"
      />
    </g>
    <path
      d="M 58 84 L 510 30 M 58 96 L 510 150"
      class="none s-acc dash"
      stroke-width="1.2"
    />

    <g
      v-for="zone in zones"
      :key="zone.key"
      :transform="`translate(${zone.x + zone.w / 2} 90) scale(${zone.size})`"
    >
      <path
        d="M -40 20 L -38 6 L -22 2 L -12 -12 L 16 -12 L 26 2 L 38 4 L 40 20 Z"
        class="mid s-ink"
        :stroke-width="1.5 / zone.size"
        stroke-linejoin="round"
      />
      <circle
        cx="-22"
        cy="20"
        r="8"
        class="dark"
      />
      <circle
        cx="24"
        cy="20"
        r="8"
        class="dark"
      />
    </g>

    <g
      v-for="zone in zones"
      :key="`t-${zone.key}`"
      text-anchor="middle"
    >
      <text
        :x="zone.x + zone.w / 2"
        y="176"
        class="t-b"
      >{{ zone.lod }}</text>
      <text
        :x="zone.x + zone.w / 2"
        y="198"
        class="t-sm t-mut"
      >{{ L[zone.key] }}</text>
    </g>
  </svg>
</template>
