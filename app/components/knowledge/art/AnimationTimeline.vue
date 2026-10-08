<script setup lang="ts">
/* Порядок работы над роликом. Галочки — где согласовывать: сценарий,
   раскадровка и аниматик. После них переделка стоит дороже. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'сценарий', s2: 'раскадровка', s3: 'аниматик', s4: 'свет и материалы', s5: 'рендер', s6: 'монтаж и звук', cheap: 'правки здесь — быстро', costly: 'здесь — переделка' },
  en: { s1: 'script', s2: 'storyboard', s3: 'animatic', s4: 'light, materials', s5: 'render', s6: 'edit and sound', cheap: 'edits here are quick', costly: 'here they mean redoing' },
})

const steps = [
  { key: 's1', approve: true },
  { key: 's2', approve: true },
  { key: 's3', approve: true },
  { key: 's4', approve: false },
  { key: 's5', approve: false },
  { key: 's6', approve: false },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 220"
    role="img"
    :aria-label="alt"
  >
    <line
      x1="30"
      y1="90"
      x2="490"
      y2="90"
      class="s-line"
      stroke-width="3"
    />
    <!-- Подписи чередуются над шкалой и под ней: длинные названия соседних
         этапов иначе наползают друг на друга. -->
    <g
      v-for="(step, index) in steps"
      :key="step.key"
      :transform="`translate(${60 + index * 80} 90)`"
    >
      <line
        :y1="index % 2 ? 18 : -18"
        :y2="index % 2 ? 30 : -30"
        class="s-line"
        stroke-width="1.5"
      />
      <circle
        r="16"
        :class="step.approve ? 'acc' : 'soft2'"
        class="s-acc"
        stroke-width="2"
      />
      <path
        v-if="step.approve"
        d="M -6 0 L -2 4.5 L 7 -5"
        class="none s-paper round"
        stroke-width="3"
      />
      <text
        v-else
        y="5"
        text-anchor="middle"
        class="t-sm t-b"
      >{{ index + 1 }}</text>
      <text
        :y="index % 2 ? 48 : -38"
        text-anchor="middle"
        class="t-sm"
        :class="step.approve ? 't-b' : ''"
      >{{ L[step.key] }}</text>
    </g>
    <path
      d="M 40 172 H 258"
      class="none s-acc"
      stroke-width="3"
      stroke-linecap="round"
    />
    <path
      d="M 282 172 H 480"
      class="none s-line"
      stroke-width="3"
      stroke-linecap="round"
      stroke-dasharray="2 8"
    />
    <text
      x="40"
      y="200"
      class="t-sm t-acc"
    >{{ L.cheap }}</text>
    <text
      x="480"
      y="200"
      text-anchor="end"
      class="t-sm t-mut"
    >{{ L.costly }}</text>
  </svg>
</template>
