<script setup lang="ts">
/* Взрыв-схема с подписями: каждая деталь получает номер и название. На
   маркетплейсе её смотрят с телефона, поэтому деталей немного и они
   крупные — не сорок винтов, а четыре узла. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { p1: 'крышка', p2: 'плата', p3: 'аккумулятор', p4: 'корпус' },
  en: { p1: 'lid', p2: 'board', p3: 'battery', p4: 'housing' },
})

const parts = [
  { key: 'p1', y: 38, h: 12, top: 'lit', side: 'dark' },
  { key: 'p2', y: 92, h: 8, top: 'lit', side: 'mid' },
  { key: 'p3', y: 140, h: 16, top: 'acc', side: 'acc2' },
  { key: 'p4', y: 196, h: 34, top: 'mid', side: 'dark' },
] as const

function slab(x: number, y: number, h: number) {
  return {
    top: `${x},${y} ${x + 120},${y} ${x + 160},${y - 24} ${x + 40},${y - 24}`,
    front: `${x},${y} ${x + 120},${y} ${x + 120},${y + h} ${x},${y + h}`,
    side: `${x + 120},${y} ${x + 160},${y - 24} ${x + 160},${y - 24 + h} ${x + 120},${y + h}`,
  }
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(part, index) in parts"
      :key="part.key"
    >
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <polygon
          :points="slab(40, part.y, part.h).front"
          :class="part.side"
        />
        <polygon
          :points="slab(40, part.y, part.h).side"
          :class="part.side"
          opacity="0.85"
        />
        <polygon
          :points="slab(40, part.y, part.h).top"
          :class="part.top"
        />
      </g>
      <line
        x1="210"
        :y1="part.y - 6"
        x2="300"
        :y2="part.y - 6"
        class="s-acc"
        stroke-width="1.5"
      />
      <circle
        cx="210"
        :cy="part.y - 6"
        r="4"
        class="acc"
      />
      <circle
        cx="318"
        :cy="part.y - 6"
        r="13"
        class="acc"
      />
      <text
        x="318"
        :y="part.y - 1"
        text-anchor="middle"
        class="t-sm t-b t-onacc"
      >{{ index + 1 }}</text>
      <text
        x="340"
        :y="part.y"
        class="t-b"
      >{{ L[part.key] }}</text>
    </g>
  </svg>
</template>
