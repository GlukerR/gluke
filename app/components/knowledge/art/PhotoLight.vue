<script setup lang="ts">
import Camera from './parts/Camera.vue'
import Verdict from './parts/Verdict.vue'

/* Свет: вспышка в лоб даёт блик на лицевой грани и жёсткую тень, мягкий
   боковой свет из окна — грани разного тона и размытую тень. Предмет один
   и тот же, меняется только свет. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: 'Вспышка в лоб', ok: 'Мягкий свет сбоку', bad1: 'блик прячет фактуру', bad2: 'тень похожа на деталь', ok1: 'грани читаются по тону', ok2: 'тень мягкая', window: 'окно' },
  en: { bad: 'Head-on flash', ok: 'Soft side light', bad1: 'glare hides texture', bad2: 'shadow mimics a part', ok1: 'faces read by tone', ok2: 'soft shadow', window: 'window' },
})

const uid = useId()
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 400"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <filter
        :id="`${uid}-blur`"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feGaussianBlur stdDeviation="7" />
      </filter>
      <filter
        :id="`${uid}-glare`"
        x="-50%"
        y="-50%"
        width="200%"
        height="200%"
      >
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <!-- Вспышка: жёсткая тень, блик, ровная заливка граней. -->
    <g>
      <Verdict
        :x="22"
        :y="26"
        :ok="false"
      />
      <text
        x="46"
        y="32"
        class="t-b"
      >{{ L.bad }}</text>
      <line
        x1="16"
        y1="168"
        x2="340"
        y2="168"
        class="s-line"
        stroke-width="2"
      />

      <polygon
        points="300,168 330,146 420,152 392,168"
        class="shadow s-mut"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <polygon
        points="200,88 300,88 330,66 230,66"
        class="mid s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <polygon
        points="300,88 330,66 330,146 300,168"
        class="mid s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <rect
        x="200"
        y="88"
        width="100"
        height="80"
        class="mid s-ink"
        stroke-width="2"
      />
      <ellipse
        cx="246"
        cy="122"
        rx="30"
        ry="22"
        class="glow"
        :filter="`url(#${uid}-glare)`"
      />
      <ellipse
        cx="246"
        cy="122"
        rx="14"
        ry="10"
        class="glow"
      />

      <Camera
        :x="60"
        :y="128"
      />
      <path
        d="M 56 84 L 62 96 L 74 92 L 66 102 L 74 112 L 61 108 L 56 120 L 51 108 L 38 112 L 46 102 L 38 92 L 50 96 Z"
        class="acc"
      />
      <line
        x1="80"
        y1="122"
        x2="196"
        y2="122"
        class="s-acc dash"
        stroke-width="1.5"
      />

      <text
        x="352"
        y="96"
        class="t-sm t-mut"
      >{{ L.bad1 }}</text>
      <text
        x="352"
        y="120"
        class="t-sm t-mut"
      >{{ L.bad2 }}</text>
    </g>

    <line
      x1="16"
      y1="198"
      x2="504"
      y2="198"
      class="s-line"
      stroke-width="1"
    />

    <!-- Мягкий свет: грани разного тона, тень размыта. -->
    <g transform="translate(0 200)">
      <Verdict
        :x="22"
        :y="26"
        :ok="true"
      />
      <text
        x="46"
        y="32"
        class="t-b"
      >{{ L.ok }}</text>
      <line
        x1="16"
        y1="168"
        x2="340"
        y2="168"
        class="s-line"
        stroke-width="2"
      />

      <rect
        x="34"
        y="62"
        width="58"
        height="80"
        rx="4"
        class="lit s-ink"
        stroke-width="2"
      />
      <line
        x1="63"
        y1="62"
        x2="63"
        y2="142"
        class="s-ink"
        stroke-width="2"
      />
      <line
        x1="34"
        y1="102"
        x2="92"
        y2="102"
        class="s-ink"
        stroke-width="2"
      />
      <text
        x="63"
        y="160"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L.window }}</text>
      <g
        class="s-acc dash"
        stroke-width="1.5"
      >
        <line
          x1="100"
          y1="80"
          x2="196"
          y2="100"
        />
        <line
          x1="100"
          y1="104"
          x2="196"
          y2="124"
        />
        <line
          x1="100"
          y1="128"
          x2="196"
          y2="148"
        />
      </g>

      <ellipse
        cx="300"
        cy="170"
        rx="82"
        ry="10"
        class="shadow"
        :filter="`url(#${uid}-blur)`"
      />
      <polygon
        points="200,88 300,88 330,66 230,66"
        class="lit s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <polygon
        points="300,88 330,66 330,146 300,168"
        class="dark s-ink"
        stroke-width="2"
        stroke-linejoin="round"
      />
      <rect
        x="200"
        y="88"
        width="100"
        height="80"
        class="mid s-ink"
        stroke-width="2"
      />
      <circle
        cx="270"
        cy="128"
        r="12"
        class="none s-ink"
        stroke-width="2"
      />
      <line
        x1="214"
        y1="104"
        x2="246"
        y2="104"
        class="s-ink"
        stroke-width="2"
        stroke-linecap="round"
      />

      <text
        x="352"
        y="96"
        class="t-sm t-acc"
      >{{ L.ok1 }}</text>
      <text
        x="352"
        y="120"
        class="t-sm t-acc"
      >{{ L.ok2 }}</text>
    </g>
  </svg>
</template>
