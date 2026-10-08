<script setup lang="ts">
/* Один товар — четыре подачи фона. У каждой своё применение, и её нужно
   назвать в задаче заранее: переснять фон потом — это новый рендер. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { white: 'белый', clear: 'прозрачный', room: 'интерьер', studio: 'цветной', whiteNote: 'каталог, WB', clearNote: 'любая подложка', roomNote: 'сценарий', studioNote: 'реклама' },
  en: { white: 'white', clear: 'transparent', room: 'interior', studio: 'color', whiteNote: 'catalog, WB', clearNote: 'any backdrop', roomNote: 'in context', studioNote: 'ads, covers' },
})

const uid = useId()

const frames = [
  { key: 'white', note: 'whiteNote', x: 8 },
  { key: 'clear', note: 'clearNote', x: 136 },
  { key: 'room', note: 'roomNote', x: 264 },
  { key: 'studio', note: 'studioNote', x: 392 },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 210"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <pattern
        :id="`${uid}-checker`"
        width="16"
        height="16"
        patternUnits="userSpaceOnUse"
      >
        <rect
          width="16"
          height="16"
          class="paper"
        />
        <rect
          width="8"
          height="8"
          class="linef"
        />
        <rect
          x="8"
          y="8"
          width="8"
          height="8"
          class="linef"
        />
      </pattern>
      <linearGradient
        :id="`${uid}-studio`"
        x1="0"
        y1="0"
        x2="0"
        y2="1"
      >
        <stop
          offset="0"
          class="stop-lit"
        />
        <stop
          offset="1"
          class="stop-acc"
        />
      </linearGradient>
      <clipPath
        v-for="frame in frames"
        :id="`${uid}-${frame.key}`"
        :key="frame.key"
      >
        <rect
          :x="frame.x"
          y="8"
          width="120"
          height="120"
          rx="8"
        />
      </clipPath>
    </defs>

    <g
      v-for="frame in frames"
      :key="frame.key"
    >
      <g :clip-path="`url(#${uid}-${frame.key})`">
        <rect
          v-if="frame.key === 'white'"
          :x="frame.x"
          y="8"
          width="120"
          height="120"
          class="glow"
        />
        <rect
          v-else-if="frame.key === 'clear'"
          :x="frame.x"
          y="8"
          width="120"
          height="120"
          :fill="`url(#${uid}-checker)`"
        />
        <template v-else-if="frame.key === 'room'">
          <rect
            :x="frame.x"
            y="8"
            width="120"
            height="84"
            class="soft"
          />
          <rect
            :x="frame.x"
            y="92"
            width="120"
            height="36"
            class="soft2"
          />
          <rect
            :x="frame.x + 10"
            y="22"
            width="26"
            height="34"
            class="lit s-line"
            stroke-width="1.5"
          />
          <path
            :d="`M ${frame.x + 104} 92 V 66 M ${frame.x + 104} 74 l -8 -8 M ${frame.x + 104} 70 l 8 -8`"
            class="none s-acc round"
            stroke-width="2"
          />
        </template>
        <rect
          v-else
          :x="frame.x"
          y="8"
          width="120"
          height="120"
          :fill="`url(#${uid}-studio)`"
        />

        <!-- Товар: одинаковый во всех кадрах, тень только там, где есть пол. -->
        <ellipse
          v-if="frame.key !== 'clear'"
          :cx="frame.x + 62"
          cy="108"
          rx="34"
          ry="5"
          class="shadow"
        />
        <g
          class="s-ink"
          stroke-width="1.5"
          stroke-linejoin="round"
        >
          <polygon
            :points="`${frame.x + 36},58 ${frame.x + 76},58 ${frame.x + 90},48 ${frame.x + 50},48`"
            class="lit"
          />
          <polygon
            :points="`${frame.x + 76},58 ${frame.x + 90},48 ${frame.x + 90},94 ${frame.x + 76},106`"
            class="dark"
          />
          <rect
            :x="frame.x + 36"
            y="58"
            width="40"
            height="48"
            class="mid"
          />
        </g>
      </g>
      <rect
        :x="frame.x"
        y="8"
        width="120"
        height="120"
        rx="8"
        class="none s-line"
        stroke-width="2"
      />
      <text
        :x="frame.x + 60"
        y="156"
        text-anchor="middle"
        class="t-b"
      >{{ L[frame.key] }}</text>
      <text
        :x="frame.x + 60"
        y="178"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[frame.note] }}</text>
    </g>
  </svg>
</template>
