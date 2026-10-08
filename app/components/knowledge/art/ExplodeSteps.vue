<script setup lang="ts">
/* Взрыв-схема: то же изделие собранным и разобранным вдоль одной оси.
   Пунктир показывает, откуда деталь «вылетела». */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { assembled: 'собрано', exploded: 'взрыв-схема' },
  en: { assembled: 'assembled', exploded: 'exploded view' },
})

/* Слои изделия снизу вверх: корпус, аккумулятор, плата, крышка. Высота
   слоя и сдвиг по вертикали во «взорванном» состоянии. */
const parts = [
  { h: 34, lift: 0, top: 'mid', side: 'dark' },
  { h: 16, lift: 34, top: 'acc', side: 'acc2' },
  { h: 8, lift: 70, top: 'lit', side: 'mid' },
  { h: 12, lift: 108, top: 'lit', side: 'dark' },
] as const

function slab(x: number, y: number, h: number) {
  return {
    top: `${x},${y} ${x + 90},${y} ${x + 120},${y - 20} ${x + 30},${y - 20}`,
    front: `${x},${y} ${x + 90},${y} ${x + 90},${y + h} ${x},${y + h}`,
    side: `${x + 90},${y} ${x + 120},${y - 20} ${x + 120},${y - 20 + h} ${x + 90},${y + h}`,
  }
}

/* Собранное: слои вплотную, снизу вверх. */
function stacked(index: number) {
  const below = parts.slice(0, index).reduce((sum, part) => sum + part.h, 0)
  return 216 - below - parts[index]!.h
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 260"
    role="img"
    :aria-label="alt"
  >
    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <g
        v-for="(part, index) in parts"
        :key="`a-${index}`"
      >
        <polygon
          :points="slab(30, stacked(index), part.h).front"
          :class="part.side"
        />
        <polygon
          :points="slab(30, stacked(index), part.h).side"
          :class="part.side"
          opacity="0.85"
        />
        <polygon
          v-if="index === parts.length - 1"
          :points="slab(30, stacked(index), part.h).top"
          :class="part.top"
        />
      </g>
    </g>
    <text
      x="90"
      y="248"
      text-anchor="middle"
      class="t-b"
    >{{ L.assembled }}</text>

    <path
      d="M 186 150 H 222 M 214 143 L 222 150 L 214 157"
      class="none s-acc round"
      stroke-width="2.5"
    />

    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <g
        v-for="(part, index) in parts"
        :key="`e-${index}`"
      >
        <polygon
          :points="slab(300, 216 - part.h - part.lift, part.h).front"
          :class="part.side"
        />
        <polygon
          :points="slab(300, 216 - part.h - part.lift, part.h).side"
          :class="part.side"
          opacity="0.85"
        />
        <polygon
          :points="slab(300, 216 - part.h - part.lift, part.h).top"
          :class="part.top"
        />
      </g>
    </g>
    <g
      class="s-acc dash"
      stroke-width="1.2"
    >
      <line
        x1="300"
        y1="30"
        x2="300"
        y2="216"
      />
      <line
        x1="420"
        y1="10"
        x2="420"
        y2="196"
      />
    </g>
    <text
      x="360"
      y="248"
      text-anchor="middle"
      class="t-b t-acc"
    >{{ L.exploded }}</text>
  </svg>
</template>
