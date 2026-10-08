<script setup lang="ts">
/* Четыре этапа визуализации и точки согласования между ними. На каждом
   этапе один и тот же предмет выглядит по-разному: от серой «глины» до
   финального кадра. Под этапом — что на нём проверять. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'Форма', s2: 'Материалы', s3: 'Свет и ракурс', s4: 'Финал', c1a: 'пропорции,', c1b: 'детали', c2a: 'цвет,', c2b: 'фактура', c3a: 'настроение,', c3b: 'кадр', c4a: 'мелочи,', c4b: 'чистота' },
  en: { s1: 'Shape', s2: 'Materials', s3: 'Light, angle', s4: 'Final', c1a: 'proportions,', c1b: 'details', c2a: 'color,', c2b: 'texture', c3a: 'mood,', c3b: 'framing', c4a: 'small things,', c4b: 'clean-up' },
})

const stages = [1, 2, 3, 4].map(index => ({ index, x: (index - 1) * 136 + 8 }))
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="stage in stages"
      :key="stage.index"
      :transform="`translate(${stage.x} 0)`"
    >
      <rect
        x="0"
        y="10"
        width="100"
        height="100"
        rx="10"
        :class="stage.index === 4 ? 'soft2' : 'paper'"
        class="s-line"
        stroke-width="2"
      />

      <ellipse
        v-if="stage.index >= 3"
        cx="52"
        cy="92"
        rx="30"
        ry="5"
        class="shadow"
      />
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <polygon
          points="30,48 66,48 78,38 42,38"
          :class="stage.index === 1 ? 'clay-lit' : 'lit'"
        />
        <polygon
          points="66,48 78,38 78,78 66,90"
          :class="stage.index === 1 ? 'clay-dark' : stage.index === 2 ? 'mid' : 'dark'"
        />
        <rect
          x="30"
          y="48"
          width="36"
          height="42"
          :class="stage.index === 1 ? 'clay-mid' : 'mid'"
        />
        <circle
          cx="48"
          cy="69"
          r="7"
          :class="stage.index === 1 ? 'clay-lit' : 'acc'"
        />
      </g>
      <ellipse
        v-if="stage.index >= 3"
        cx="40"
        cy="58"
        rx="5"
        ry="3"
        class="glow"
        opacity="0.8"
      />

      <text
        x="50"
        y="140"
        text-anchor="middle"
        class="t-b"
      >{{ L[`s${stage.index}` as 's1'] }}</text>
      <text
        x="50"
        y="164"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[`c${stage.index}a` as 'c1a'] }}</text>
      <text
        x="50"
        y="184"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[`c${stage.index}b` as 'c1b'] }}</text>

      <!-- Точка согласования между этапами. -->
      <g
        v-if="stage.index < 4"
        transform="translate(118 60)"
      >
        <line
          x1="-14"
          y1="0"
          x2="14"
          y2="0"
          class="s-line"
          stroke-width="2"
        />
        <circle
          r="11"
          class="acc"
        />
        <path
          d="M -5 0 L -1.5 4 L 5.5 -4"
          class="none s-paper round"
          stroke-width="2.5"
        />
      </g>
    </g>

    <line
      x1="8"
      y1="214"
      x2="508"
      y2="214"
      class="s-line"
      stroke-width="2"
    />
    <polygon
      points="508,214 498,208 498,220"
      class="linef"
    />
  </svg>
</template>
