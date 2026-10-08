<script setup lang="ts">
/* Раскадровка продуктового ролика: пять кадров от общего плана к финалу.
   Её согласуют до анимации — переставить кадры на бумаге проще, чем в
   готовом ролике. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { f1: 'общий план', f2: 'механизм', f3: 'деталь', f4: 'внутри', f5: 'логотип' },
  en: { f1: 'wide shot', f2: 'mechanism', f3: 'detail', f4: 'inside', f5: 'logo' },
})

const frames = ['f1', 'f2', 'f3', 'f4', 'f5'] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 200"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(frame, index) in frames"
      :key="frame"
      :transform="`translate(${4 + index * 104} 20)`"
    >
      <rect
        x="0"
        y="0"
        width="96"
        height="120"
        rx="6"
        class="paper s-line"
        stroke-width="1.5"
      />
      <rect
        x="6"
        y="6"
        width="84"
        height="84"
        rx="3"
        class="soft"
      />
      <text
        x="10"
        y="110"
        class="t-sm t-b t-acc"
      >{{ index + 1 }}</text>

      <g
        class="s-ink"
        stroke-width="1.2"
        stroke-linejoin="round"
      >
        <template v-if="frame === 'f1'">
          <polygon
            points="32,44 60,44 70,36 42,36"
            class="lit"
          />
          <polygon
            points="60,44 70,36 70,70 60,78"
            class="dark"
          />
          <rect
            x="32"
            y="44"
            width="28"
            height="34"
            class="mid"
          />
        </template>
        <template v-else-if="frame === 'f2'">
          <rect
            x="24"
            y="44"
            width="40"
            height="34"
            class="mid"
          />
          <rect
            x="46"
            y="54"
            width="32"
            height="12"
            class="lit"
          />
          <path
            d="M 70 40 q 8 6 0 12"
            class="none s-acc round"
            stroke-width="2"
          />
          <path
            d="M 64 36 l 8 4 l -6 6"
            class="none s-acc round"
            stroke-width="2"
          />
        </template>
        <template v-else-if="frame === 'f3'">
          <circle
            cx="48"
            cy="48"
            r="30"
            class="mid"
          />
          <circle
            cx="48"
            cy="48"
            r="14"
            class="lit"
          />
          <circle
            cx="48"
            cy="48"
            r="5"
            class="acc"
          />
        </template>
        <template v-else-if="frame === 'f4'">
          <rect
            x="24"
            y="22"
            width="48"
            height="60"
            class="mid"
          />
          <rect
            x="48"
            y="22"
            width="24"
            height="60"
            class="soft2"
          />
          <circle
            cx="60"
            cy="40"
            r="7"
            class="acc"
          />
          <rect
            x="52"
            y="56"
            width="16"
            height="16"
            class="acc2"
          />
        </template>
        <template v-else>
          <circle
            cx="48"
            cy="48"
            r="22"
            class="acc"
          />
          <text
            x="48"
            y="55"
            text-anchor="middle"
            class="t-b t-onacc"
          >G</text>
        </template>
      </g>

      <text
        x="48"
        y="150"
        text-anchor="middle"
        class="t-sm"
      >{{ L[frame] }}</text>
      <path
        v-if="index < frames.length - 1"
        d="M 98 60 h 4"
        class="none s-acc"
        stroke-width="2"
      />
    </g>
  </svg>
</template>
