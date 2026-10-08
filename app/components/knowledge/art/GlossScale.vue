<script setup lang="ts">
/* Степень блеска: один и тот же шар матовый, полуматовый и глянцевый.
   Отличается только блик — размытое пятно, собранное пятно, отражение
   окна. По нему 3D-специалист и настраивает материал. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { matte: 'матовый', satin: 'полуматовый', gloss: 'глянцевый', matteNote: 'блик размыт', satinNote: 'блик собран', glossNote: 'видно отражение' },
  en: { matte: 'matte', satin: 'satin', gloss: 'gloss', matteNote: 'highlight is soft', satinNote: 'highlight is tighter', glossNote: 'reflection visible' },
})

const uid = useId()

const balls = [
  { cx: 90, key: 'matte', note: 'matteNote' },
  { cx: 260, key: 'satin', note: 'satinNote' },
  { cx: 430, key: 'gloss', note: 'glossNote' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 230"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <radialGradient
        :id="`${uid}-body`"
        cx="0.38"
        cy="0.32"
        r="0.75"
      >
        <stop
          offset="0"
          class="stop-lit"
        />
        <stop
          offset="0.55"
          class="stop-mid"
        />
        <stop
          offset="1"
          class="stop-dark"
        />
      </radialGradient>
      <filter
        :id="`${uid}-soft`"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur stdDeviation="12" />
      </filter>
      <filter
        :id="`${uid}-mid`"
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur stdDeviation="4" />
      </filter>
    </defs>

    <g
      v-for="ball in balls"
      :key="ball.key"
    >
      <ellipse
        :cx="ball.cx"
        cy="164"
        rx="46"
        ry="8"
        class="shadow"
      />
      <circle
        :cx="ball.cx"
        cy="100"
        r="58"
        :fill="`url(#${uid}-body)`"
        class="s-ink"
        stroke-width="2"
      />
    </g>

    <!-- Матовый: широкое мягкое пятно. -->
    <ellipse
      cx="72"
      cy="78"
      rx="26"
      ry="20"
      class="glow"
      opacity="0.55"
      :filter="`url(#${uid}-soft)`"
    />
    <!-- Полуматовый: пятно меньше и чётче. -->
    <ellipse
      cx="244"
      cy="80"
      rx="14"
      ry="10"
      class="glow"
      opacity="0.85"
      :filter="`url(#${uid}-mid)`"
    />
    <!-- Глянец: маленький резкий блик и отражение окна. -->
    <g transform="translate(410 70) rotate(-14)">
      <rect
        x="0"
        y="0"
        width="22"
        height="18"
        rx="3"
        class="glow"
        opacity="0.9"
      />
      <line
        x1="11"
        y1="0"
        x2="11"
        y2="18"
        class="s-ink"
        stroke-width="1.5"
        opacity="0.5"
      />
      <line
        x1="0"
        y1="9"
        x2="22"
        y2="9"
        class="s-ink"
        stroke-width="1.5"
        opacity="0.5"
      />
    </g>
    <circle
      cx="452"
      cy="126"
      r="4"
      class="glow"
      opacity="0.7"
    />

    <g text-anchor="middle">
      <template
        v-for="ball in balls"
        :key="`t-${ball.key}`"
      >
        <text
          :x="ball.cx"
          y="196"
          class="t-b"
        >{{ L[ball.key] }}</text>
        <text
          :x="ball.cx"
          y="218"
          class="t-sm t-mut"
        >{{ L[ball.note] }}</text>
      </template>
    </g>
  </svg>
</template>
