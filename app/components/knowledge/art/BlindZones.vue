<script setup lang="ts">
/* «Слепые зоны» карточки: часть кадра перекрывают значки и кнопки
   площадки. Где именно — зависит от площадки и меняется, поэтому на схеме
   зоны условные; точное расположение смотрят в кабинете продавца. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { zones: 'значки площадки', safe: 'безопасная зона', note1: 'текст и важные детали —', note2: 'в безопасной зоне', note3: 'точные зоны — в кабинете', note4: 'продавца, они меняются' },
  en: { zones: 'platform badges', safe: 'safe area', note1: 'text and key details', note2: 'go in the safe area', note3: 'exact zones are in the', note4: 'seller dashboard, they change' },
})

const uid = useId()
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <pattern
        :id="`${uid}-hatch`"
        width="8"
        height="8"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect
          width="8"
          height="8"
          class="soft"
        />
        <line
          x1="0"
          y1="0"
          x2="0"
          y2="8"
          class="s-mut"
          stroke-width="3"
        />
      </pattern>
    </defs>

    <!-- Карточка 3:4. -->
    <rect
      x="30"
      y="16"
      width="200"
      height="266"
      rx="10"
      class="paper s-line"
      stroke-width="2"
    />
    <rect
      x="30"
      y="16"
      width="200"
      height="40"
      rx="10"
      :fill="`url(#${uid}-hatch)`"
    />
    <rect
      x="30"
      y="236"
      width="200"
      height="46"
      rx="10"
      :fill="`url(#${uid}-hatch)`"
    />
    <rect
      x="54"
      y="70"
      width="152"
      height="152"
      rx="6"
      class="none s-acc dash"
      stroke-width="2"
    />

    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <polygon
        points="96,118 146,118 162,104 112,104"
        class="lit"
      />
      <polygon
        points="146,118 162,104 162,180 146,194"
        class="dark"
      />
      <rect
        x="96"
        y="118"
        width="50"
        height="76"
        class="mid"
      />
    </g>
    <rect
      x="66"
      y="80"
      width="80"
      height="12"
      rx="3"
      class="acc"
    />

    <g transform="translate(256 60)">
      <rect
        x="0"
        y="-12"
        width="22"
        height="16"
        rx="3"
        :fill="`url(#${uid}-hatch)`"
        class="s-mut"
        stroke-width="1"
      />
      <text
        x="32"
        y="1"
        class="t-sm"
      >{{ L.zones }}</text>
      <rect
        x="0"
        y="22"
        width="22"
        height="16"
        rx="3"
        class="none s-acc dash"
        stroke-width="2"
      />
      <text
        x="32"
        y="35"
        class="t-sm"
      >{{ L.safe }}</text>
      <text
        x="0"
        y="90"
        class="t-sm t-mut"
      >{{ L.note1 }}</text>
      <text
        x="0"
        y="112"
        class="t-sm t-mut"
      >{{ L.note2 }}</text>
      <text
        x="0"
        y="150"
        class="t-sm t-mut"
      >{{ L.note3 }}</text>
      <text
        x="0"
        y="172"
        class="t-sm t-mut"
      >{{ L.note4 }}</text>
    </g>
  </svg>
</template>
