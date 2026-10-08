<script setup lang="ts">
/* Три вида продуктовой анимации и вопрос, на который отвечает каждый. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { built: 'Как устроено', builtNote: 'детали разлетаются', works: 'Как работает', worksNote: 'механизм в движении', assemble: 'Как собрать', assembleNote: 'шаг за шагом' },
  en: { built: 'How it is built', builtNote: 'parts fly apart', works: 'How it works', worksNote: 'the mechanism moves', assemble: 'How to assemble', assembleNote: 'step by step' },
})

const cards = [
  { key: 'built', note: 'builtNote', x: 0 },
  { key: 'works', note: 'worksNote', x: 176 },
  { key: 'assemble', note: 'assembleNote', x: 352 },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 230"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="card in cards"
      :key="card.key"
      :transform="`translate(${card.x} 0)`"
    >
      <rect
        x="2"
        y="2"
        width="164"
        height="224"
        rx="12"
        class="soft s-line"
        stroke-width="2"
      />

      <g
        class="s-ink"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <template v-if="card.key === 'built'">
          <polygon
            points="46,52 106,52 122,40 62,40"
            class="lit"
          />
          <polygon
            points="50,92 102,92 116,82 64,82"
            class="acc"
          />
          <polygon
            points="46,134 106,134 122,122 62,122"
            class="mid"
          />
          <rect
            x="46"
            y="134"
            width="60"
            height="18"
            class="dark"
          />
          <path
            d="M 84 56 V 78 M 84 96 V 118"
            class="none s-acc dash"
            stroke-width="1.5"
          />
        </template>
        <template v-else-if="card.key === 'works'">
          <rect
            x="34"
            y="60"
            width="96"
            height="76"
            rx="4"
            class="mid"
          />
          <rect
            x="60"
            y="80"
            width="88"
            height="36"
            rx="3"
            class="lit"
          />
          <path
            d="M 140 64 C 156 74 156 120 140 130"
            class="none s-acc round"
            stroke-width="2.5"
          />
          <path
            d="M 134 124 L 140 132 L 148 126"
            class="none s-acc round"
            stroke-width="2.5"
          />
        </template>
        <template v-else>
          <rect
            x="30"
            y="112"
            width="50"
            height="34"
            class="mid"
          />
          <rect
            x="88"
            y="112"
            width="50"
            height="34"
            class="mid"
          />
          <rect
            x="88"
            y="54"
            width="50"
            height="34"
            class="acc"
          />
          <path
            d="M 113 92 V 106 M 107 100 L 113 106 L 119 100"
            class="none s-acc round"
            stroke-width="2.5"
          />
          <circle
            cx="55"
            cy="80"
            r="14"
            class="acc"
          />
          <text
            x="55"
            y="86"
            text-anchor="middle"
            class="t-sm t-b t-onacc"
          >2</text>
        </template>
      </g>

      <text
        x="84"
        y="190"
        text-anchor="middle"
        class="t-b"
      >{{ L[card.key] }}</text>
      <text
        x="84"
        y="212"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[card.note] }}</text>
    </g>
  </svg>
</template>
