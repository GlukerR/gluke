<script setup lang="ts">
/* Clay-рендер и финал. На сером «глиняном» кадре ничто не отвлекает от
   формы — его и согласуют первым. Цвет, фактуру и свет смотрят уже на
   финальном. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { clay: 'Clay-рендер', final: 'Финал', c1: 'силуэт', c2: 'пропорции', c3: 'детали', f1: 'цвет', f2: 'фактура', f3: 'свет' },
  en: { clay: 'Clay render', final: 'Final', c1: 'silhouette', c2: 'proportions', c3: 'details', f1: 'color', f2: 'texture', f3: 'light' },
})

const uid = useId()

/* Колонка: корпус-колонка с двумя динамиками. `clay` — нейтральные грани. */
const panels = [
  { x: 0, clay: true, title: 'clay', checks: ['c1', 'c2', 'c3'] },
  { x: 268, clay: false, title: 'final', checks: ['f1', 'f2', 'f3'] },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 240"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <pattern
        :id="`${uid}-mesh`"
        width="5"
        height="5"
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx="2.5"
          cy="2.5"
          r="1.1"
          class="dark"
        />
      </pattern>
    </defs>

    <g
      v-for="panel in panels"
      :key="panel.title"
      :transform="`translate(${panel.x} 0)`"
    >
      <text
        x="8"
        y="22"
        class="t-b"
      >{{ L[panel.title] }}</text>
      <rect
        x="8"
        y="34"
        width="244"
        height="150"
        rx="10"
        :class="panel.clay ? 'paper' : 'soft'"
        class="s-line"
        stroke-width="2"
      />

      <ellipse
        cx="86"
        cy="168"
        rx="44"
        ry="6"
        class="shadow"
      />
      <g
        class="s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      >
        <polygon
          points="50,62 110,62 124,50 64,50"
          :class="panel.clay ? 'clay-lit' : 'lit'"
        />
        <polygon
          points="110,62 124,50 124,152 110,166"
          :class="panel.clay ? 'clay-dark' : 'dark'"
        />
        <rect
          x="50"
          y="62"
          width="60"
          height="104"
          rx="4"
          :class="panel.clay ? 'clay-mid' : 'mid'"
        />
        <circle
          cx="80"
          cy="132"
          r="20"
          :class="panel.clay ? 'clay-dark' : 'dark'"
        />
        <circle
          cx="80"
          cy="84"
          r="10"
          :class="panel.clay ? 'clay-dark' : 'dark'"
        />
      </g>
      <template v-if="!panel.clay">
        <circle
          cx="80"
          cy="132"
          r="17"
          :fill="`url(#${uid}-mesh)`"
        />
        <circle
          cx="80"
          cy="132"
          r="6"
          class="acc"
        />
        <circle
          cx="80"
          cy="84"
          r="4"
          class="acc"
        />
        <ellipse
          cx="62"
          cy="76"
          rx="5"
          ry="10"
          class="glow"
          opacity="0.6"
        />
      </template>

      <g
        v-for="(check, index) in panel.checks"
        :key="check"
        :transform="`translate(150 ${76 + index * 34})`"
      >
        <circle
          r="10"
          class="acc"
        />
        <path
          d="M -4.5 0 L -1.5 3.5 L 5 -3.5"
          class="none s-paper round"
          stroke-width="2.5"
        />
        <text
          x="18"
          y="5"
          class="t-sm"
        >{{ L[check] }}</text>
      </g>
    </g>

    <path
      d="M 254 110 L 266 110 M 260 104 L 266 110 L 260 116"
      class="none s-acc round"
      stroke-width="2.5"
    />
  </svg>
</template>
