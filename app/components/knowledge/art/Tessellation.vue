<script setup lang="ts">
/* Тесселяция: точная окружность из CAD превращается в многоугольник.
   Мало сторон — видны грани, много — гладко, но модель тяжелее. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { exact: 'CAD: точная форма', coarse: '12 сторон', fine: '40 сторон', coarseNote: 'лёгкая, видны грани', fineNote: 'гладкая, тяжелее' },
  en: { exact: 'CAD: exact shape', coarse: '12 sides', fine: '40 sides', coarseNote: 'light, facets show', fineNote: 'smooth, heavier' },
})

function ring(cx: number, cy: number, r: number, sides: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2 - Math.PI / 2
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

/* Веер треугольников из центра — так сетку видно глазами. */
function fan(cx: number, cy: number, r: number, sides: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2 - Math.PI / 2
    return `M ${cx} ${cy} L ${(cx + r * Math.cos(angle)).toFixed(1)} ${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 230"
    role="img"
    :aria-label="alt"
  >
    <circle
      cx="90"
      cy="96"
      r="62"
      class="mid s-acc"
      stroke-width="3"
    />
    <path
      d="M 168 96 H 196 M 188 89 L 196 96 L 188 103"
      class="none s-acc round"
      stroke-width="2.5"
    />

    <polygon
      :points="ring(266, 96, 62, 12)"
      class="mid s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path
      :d="fan(266, 96, 62, 12)"
      class="none s-ink"
      stroke-width="1"
      opacity="0.5"
    />

    <polygon
      :points="ring(430, 96, 62, 40)"
      class="mid s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <path
      :d="fan(430, 96, 62, 40)"
      class="none s-ink"
      stroke-width="0.75"
      opacity="0.4"
    />

    <g text-anchor="middle">
      <text
        x="90"
        y="190"
        class="t-b"
      >{{ L.exact }}</text>
      <text
        x="266"
        y="190"
        class="t-b"
      >{{ L.coarse }}</text>
      <text
        x="266"
        y="212"
        class="t-sm t-mut"
      >{{ L.coarseNote }}</text>
      <text
        x="430"
        y="190"
        class="t-b"
      >{{ L.fine }}</text>
      <text
        x="430"
        y="212"
        class="t-sm t-mut"
      >{{ L.fineNote }}</text>
    </g>
  </svg>
</template>
