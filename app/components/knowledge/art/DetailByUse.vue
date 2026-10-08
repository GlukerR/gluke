<script setup lang="ts">
/* Одна и та же панель с ручкой в трёх уровнях детализации: для сайта и AR
   (простая сетка), для каталога (фаски), для крупного плана (скругления,
   крепёж, плотная сетка). Шкала под каждой — сколько деталей нужно. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { web: 'Сайт и AR', webNote: 'лёгкая модель', catalog: 'Каталог', catalogNote: 'фаски, баланс', close: 'Крупный план', closeNote: 'скругления, крепёж' },
  en: { web: 'Web and AR', webNote: 'light model', catalog: 'Catalog', catalogNote: 'bevels, balanced', close: 'Close-up', closeNote: 'fillets, screws' },
})

const uid = useId()

/* Многоугольник ручки: чем выше детализация, тем больше сторон. */
function polygon(cx: number, cy: number, r: number, sides: number): string {
  return Array.from({ length: sides }, (_, index) => {
    const angle = (index / sides) * Math.PI * 2 - Math.PI / 2
    return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`
  }).join(' ')
}

const denseLines = Array.from({ length: 9 }, (_, index) => 382 + index * 12)
const denseRows = Array.from({ length: 7 }, (_, index) => 60 + index * 12)
const SEGMENTS = [0, 1, 2]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <clipPath :id="`${uid}-close`">
        <rect
          x="370"
          y="50"
          width="120"
          height="90"
          rx="16"
        />
      </clipPath>
    </defs>

    <!-- Сайт и AR: прямые углы, два треугольника, ручка-шестиугольник. -->
    <rect
      x="30"
      y="50"
      width="120"
      height="90"
      class="mid s-ink"
      stroke-width="2"
    />
    <path
      d="M 30 50 L 150 140"
      class="s-ink"
      stroke-width="1"
      opacity="0.5"
    />
    <polygon
      :points="polygon(115, 95, 18, 6)"
      class="lit s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />

    <!-- Каталог: фаски по углам, ручка-двенадцатигранник, пара рёбер. -->
    <polygon
      points="210,50 310,50 320,60 320,130 310,140 210,140 200,130 200,60"
      class="mid s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <g
      class="s-ink"
      stroke-width="1"
      opacity="0.5"
    >
      <path
        d="M 200 95 H 320 M 240 50 V 140 M 210 60 H 310 V 130 H 210 Z"
        class="none"
      />
    </g>
    <polygon
      :points="polygon(285, 95, 20, 12)"
      class="lit s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <polygon
      :points="polygon(285, 95, 11, 12)"
      class="none s-ink"
      stroke-width="1.5"
    />

    <!-- Крупный план: скругления, плотная сетка, круглая ручка, винты. -->
    <rect
      x="370"
      y="50"
      width="120"
      height="90"
      rx="16"
      class="mid"
    />
    <g
      :clip-path="`url(#${uid}-close)`"
      class="s-ink"
      stroke-width="0.75"
      opacity="0.4"
    >
      <line
        v-for="x in denseLines"
        :key="`v-${x}`"
        :x1="x"
        y1="50"
        :x2="x"
        y2="140"
      />
      <line
        v-for="y in denseRows"
        :key="`h-${y}`"
        x1="370"
        :y1="y"
        x2="490"
        :y2="y"
      />
    </g>
    <rect
      x="370"
      y="50"
      width="120"
      height="90"
      rx="16"
      class="none s-ink"
      stroke-width="2"
    />
    <circle
      cx="455"
      cy="95"
      r="21"
      class="lit s-ink"
      stroke-width="2"
    />
    <circle
      cx="455"
      cy="95"
      r="13"
      class="none s-ink"
      stroke-width="1.5"
    />
    <circle
      cx="455"
      cy="95"
      r="4"
      class="acc"
    />
    <circle
      v-for="[x, y] in [[382, 62], [478, 62], [382, 128], [478, 128]]"
      :key="`${x}-${y}`"
      :cx="x"
      :cy="y"
      r="4"
      class="lit s-ink"
      stroke-width="1.5"
    />

    <g text-anchor="middle">
      <text
        x="90"
        y="176"
        class="t-b"
      >{{ L.web }}</text>
      <text
        x="90"
        y="198"
        class="t-sm t-mut"
      >{{ L.webNote }}</text>
      <text
        x="260"
        y="176"
        class="t-b"
      >{{ L.catalog }}</text>
      <text
        x="260"
        y="198"
        class="t-sm t-mut"
      >{{ L.catalogNote }}</text>
      <text
        x="430"
        y="176"
        class="t-b"
      >{{ L.close }}</text>
      <text
        x="430"
        y="198"
        class="t-sm t-mut"
      >{{ L.closeNote }}</text>
    </g>

    <g
      v-for="(column, level) in [90, 260, 430]"
      :key="column"
    >
      <rect
        v-for="index in SEGMENTS"
        :key="index"
        :x="column - 53 + index * 37"
        y="214"
        width="32"
        height="10"
        rx="3"
        :class="index <= level ? 'acc' : 'linef'"
      />
    </g>
  </svg>
</template>
