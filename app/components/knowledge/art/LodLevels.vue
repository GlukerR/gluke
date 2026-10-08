<script setup lang="ts">
/* Три уровня детализации одной модели: полная для ближнего плана,
   упрощённая для средней дистанции, силуэт для дальней. Сетка редеет,
   силуэт и цвет остаются теми же. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { lod0: 'ближний план', lod1: 'средний', lod2: 'дальний' },
  en: { lod0: 'close-up', lod1: 'mid-range', lod2: 'far' },
})

const uid = useId()

const levels = [
  { key: 'lod0', name: 'LOD0', x: 8, step: 7, wheels: 16 },
  { key: 'lod1', name: 'LOD1', x: 180, step: 14, wheels: 10 },
  { key: 'lod2', name: 'LOD2', x: 352, step: 0, wheels: 6 },
] as const

function wheel(cx: number, cy: number, r: number, sides: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

/* Силуэт машины: кузов и кабина. Одинаковый на всех уровнях. */
const BODY = 'M 14 92 L 18 70 L 46 64 L 62 44 L 112 44 L 132 64 L 150 68 L 154 92 Z'
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 190"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <clipPath :id="`${uid}-body`">
        <path :d="BODY" />
      </clipPath>
    </defs>

    <g
      v-for="level in levels"
      :key="level.key"
      :transform="`translate(${level.x} 10)`"
    >
      <rect
        x="0"
        y="0"
        width="160"
        height="120"
        rx="10"
        class="soft s-line"
        stroke-width="2"
      />
      <path
        :d="BODY"
        class="mid"
      />
      <g
        v-if="level.step"
        :clip-path="`url(#${uid}-body)`"
        class="s-ink"
        stroke-width="0.8"
        opacity="0.45"
      >
        <line
          v-for="x in Math.ceil(160 / level.step)"
          :key="`v-${x}`"
          :x1="x * level.step"
          y1="40"
          :x2="x * level.step"
          y2="96"
        />
        <line
          v-for="y in Math.ceil(56 / level.step)"
          :key="`h-${y}`"
          x1="0"
          :y1="40 + y * level.step"
          x2="160"
          :y2="40 + y * level.step"
        />
      </g>
      <path
        :d="BODY"
        class="none s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <polygon
        v-if="level.key !== 'lod2'"
        points="66,50 84,50 84,64 56,64"
        class="lit s-ink"
        stroke-width="1"
      />
      <polygon
        v-if="level.key !== 'lod2'"
        points="90,50 110,50 124,64 90,64"
        class="lit s-ink"
        stroke-width="1"
      />
      <polygon
        v-for="cx in [44, 124]"
        :key="cx"
        :points="wheel(cx, 94, 14, level.wheels)"
        class="dark s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <template v-if="level.key === 'lod0'">
        <circle
          v-for="cx in [44, 124]"
          :key="`h-${cx}`"
          :cx="cx"
          cy="94"
          r="6"
          class="lit s-ink"
          stroke-width="1"
        />
      </template>

      <text
        x="80"
        y="148"
        text-anchor="middle"
        class="t-b"
      >{{ level.name }}</text>
      <text
        x="80"
        y="170"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[level.key] }}</text>
    </g>
  </svg>
</template>
