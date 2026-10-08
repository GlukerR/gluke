<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Расплывчатая правка против пометок с номерами на самом рендере: во втором
   случае каждое замечание привязано к месту и говорит, каким должен быть
   результат. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: 'Расплывчато', vague: '«Сделайте поживее»', ok: 'Номера на рендере и список', m1: 'ручка темнее, как образец', m2: 'убрать блик на панели', m3: 'логотип крупнее' },
  en: { bad: 'Vague', vague: '"Make it pop"', ok: 'Numbers on the render, plus a list', m1: 'darker knob, like the sample', m2: 'remove the panel glare', m3: 'bigger logo' },
})

const marks = [
  { n: 1, x: 136, y: 140, key: 'm1' },
  { n: 2, x: 74, y: 128, key: 'm2' },
  { n: 3, x: 122, y: 92, key: 'm3' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 400"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="panel in [{ y: 0, ok: false }, { y: 200, ok: true }]"
      :key="panel.y"
      :transform="`translate(0 ${panel.y})`"
    >
      <Verdict
        :x="22"
        :y="22"
        :ok="panel.ok"
      />
      <text
        x="46"
        y="28"
        class="t-b"
      >{{ panel.ok ? L.ok : L.bad }}</text>

      <!-- Тот же рендер в обеих панелях. -->
      <rect
        x="20"
        y="44"
        width="200"
        height="140"
        rx="8"
        class="soft s-line"
        stroke-width="2"
      />
      <ellipse
        cx="114"
        cy="166"
        rx="54"
        ry="6"
        class="shadow"
      />
      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <polygon
          points="62,74 150,74 166,60 78,60"
          class="lit"
        />
        <polygon
          points="150,74 166,60 166,148 150,162"
          class="dark"
        />
        <rect
          x="62"
          y="74"
          width="88"
          height="88"
          rx="3"
          class="mid"
        />
        <circle
          cx="112"
          cy="128"
          r="14"
          class="lit"
        />
        <rect
          x="74"
          y="88"
          width="30"
          height="8"
          rx="2"
          class="acc"
        />
      </g>
      <ellipse
        cx="82"
        cy="110"
        rx="12"
        ry="6"
        class="glow"
        opacity="0.8"
      />

      <template v-if="!panel.ok">
        <path
          d="M 252 86 h 240 a 10 10 0 0 1 10 10 v 40 a 10 10 0 0 1 -10 10 h -228 l -12 14 v -14 a 10 10 0 0 1 -10 -10 v -40 a 10 10 0 0 1 10 -10 z"
          class="paper s-line"
          stroke-width="2"
        />
        <text
          x="372"
          y="122"
          text-anchor="middle"
          class="t-b t-mut"
        >{{ L.vague }}</text>
      </template>
      <template v-else>
        <g
          v-for="mark in marks"
          :key="mark.n"
        >
          <circle
            :cx="mark.x"
            :cy="mark.y"
            r="11"
            class="acc"
          />
          <text
            :x="mark.x"
            :y="mark.y + 5"
            text-anchor="middle"
            class="t-sm t-b t-onacc"
          >{{ mark.n }}</text>
        </g>
        <g
          v-for="(mark, index) in marks"
          :key="`l-${mark.n}`"
          :transform="`translate(248 ${78 + index * 36})`"
        >
          <circle
            r="11"
            class="acc"
          />
          <text
            y="5"
            text-anchor="middle"
            class="t-sm t-b t-onacc"
          >{{ mark.n }}</text>
          <text
            x="20"
            y="5"
            class="t-sm"
          >{{ L[mark.key] }}</text>
        </g>
      </template>
    </g>
    <line
      x1="16"
      y1="196"
      x2="504"
      y2="196"
      class="s-line"
      stroke-width="1"
    />
  </svg>
</template>
