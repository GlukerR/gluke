<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* JPEG прозрачности не хранит: на цветной подложке вокруг товара остаётся
   белый прямоугольник. PNG с прозрачностью ложится на любой фон. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { jpeg: 'JPEG на цветном фоне', png: 'PNG с прозрачностью', jpegNote: 'белая «коробка» вокруг', pngNote: 'ложится на любой фон' },
  en: { jpeg: 'JPEG on a colored page', png: 'PNG with transparency', jpegNote: 'a white "box" around it', pngNote: 'fits any background' },
})

const uid = useId()
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <linearGradient
        :id="`${uid}-page`"
        x1="0"
        y1="0"
        x2="1"
        y2="1"
      >
        <stop
          offset="0"
          class="stop-acc"
        />
        <stop
          offset="1"
          class="stop-dark"
        />
      </linearGradient>
    </defs>

    <g
      v-for="panel in [{ x: 0, ok: false }, { x: 264, ok: true }]"
      :key="panel.x"
      :transform="`translate(${panel.x} 0)`"
    >
      <Verdict
        :x="20"
        :y="20"
        :ok="panel.ok"
      />
      <text
        x="42"
        y="26"
        class="t-b"
      >{{ panel.ok ? L.png : L.jpeg }}</text>
      <rect
        x="8"
        y="44"
        width="240"
        height="160"
        rx="10"
        :fill="`url(#${uid}-page)`"
      />
      <rect
        v-if="!panel.ok"
        x="58"
        y="64"
        width="140"
        height="120"
        class="glow"
      />
      <ellipse
        cx="128"
        cy="170"
        rx="36"
        ry="5"
        class="shadow"
      />
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <polygon
          points="100,98 146,98 160,86 114,86"
          class="lit"
        />
        <polygon
          points="146,98 160,86 160,156 146,170"
          class="dark"
        />
        <rect
          x="100"
          y="98"
          width="46"
          height="72"
          class="mid"
        />
      </g>
      <text
        x="128"
        y="232"
        text-anchor="middle"
        class="t-sm"
        :class="panel.ok ? 't-acc' : 't-mut'"
      >{{ panel.ok ? L.pngNote : L.jpegNote }}</text>
    </g>
  </svg>
</template>
