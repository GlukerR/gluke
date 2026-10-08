<script setup lang="ts">
/* Карта ТЗ: шесть вопросов, на которые должна ответить постановка задачи.
   Номер — порядок, в котором их удобно обсуждать: от «где покажем» к
   деталям. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: {
    t1: 'Где покажем', h1: 'сайт · WB · печать',
    t2: 'Что показываем', h2: 'позиции, варианты',
    t3: 'Ракурсы', h3: 'одни на всю серию',
    t4: 'Фон и свет', h4: 'белый · прозрачный',
    t5: 'Размер', h5: 'пиксели, формат',
    t6: 'Референсы', h6: 'нравится / нет',
  },
  en: {
    t1: 'Where it goes', h1: 'site · marketplace',
    t2: 'What we show', h2: 'items, variants',
    t3: 'Angles', h3: 'one set per series',
    t4: 'Background', h4: 'white · transparent',
    t5: 'Size', h5: 'pixels, file type',
    t6: 'References', h6: 'like / dislike',
  },
})

const cards = [1, 2, 3, 4, 5, 6].map(index => ({
  index,
  x: ((index - 1) % 3) * 180,
  y: Math.floor((index - 1) / 3) * 136,
  title: `t${index}` as 't1' | 't2' | 't3' | 't4' | 't5' | 't6',
  hint: `h${index}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6',
}))
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 256"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="card in cards"
      :key="card.index"
      :transform="`translate(${card.x} ${card.y})`"
    >
      <rect
        x="1"
        y="1"
        width="158"
        height="118"
        rx="12"
        class="soft s-line"
        stroke-width="2"
      />
      <circle
        cx="28"
        cy="30"
        r="14"
        class="acc"
      />
      <text
        x="28"
        y="36"
        text-anchor="middle"
        class="t-sm t-b t-onacc"
      >{{ card.index }}</text>

      <!-- Иконки в правом верхнем углу карточки. -->
      <g
        class="none s-acc round"
        stroke-width="2"
        transform="translate(104 14)"
      >
        <template v-if="card.index === 1">
          <rect
            x="0"
            y="2"
            width="30"
            height="20"
            rx="2"
          />
          <rect
            x="26"
            y="10"
            width="12"
            height="20"
            rx="2"
          />
        </template>
        <template v-else-if="card.index === 2">
          <rect
            x="0"
            y="4"
            width="16"
            height="16"
          />
          <path d="M 22 6 H 38 M 22 12 H 38 M 22 18 H 34" />
        </template>
        <template v-else-if="card.index === 3">
          <rect
            x="0"
            y="2"
            width="16"
            height="12"
          />
          <rect
            x="20"
            y="2"
            width="16"
            height="12"
          />
          <rect
            x="0"
            y="18"
            width="16"
            height="12"
          />
          <rect
            x="20"
            y="18"
            width="16"
            height="12"
          />
        </template>
        <template v-else-if="card.index === 4">
          <circle
            cx="10"
            cy="10"
            r="6"
          />
          <rect
            x="16"
            y="14"
            width="20"
            height="16"
          />
        </template>
        <template v-else-if="card.index === 5">
          <path d="M 0 8 V 0 H 8 M 28 0 H 36 V 8 M 36 22 V 30 H 28 M 8 30 H 0 V 22" />
        </template>
        <template v-else>
          <rect
            x="0"
            y="4"
            width="16"
            height="16"
            rx="2"
          />
          <rect
            x="20"
            y="4"
            width="16"
            height="16"
            rx="2"
          />
          <path d="M 3 12 L 7 16 L 13 8" />
          <path
            d="M 24 8 L 32 16 M 32 8 L 24 16"
            class="s-mut"
          />
        </template>
      </g>

      <text
        x="16"
        y="80"
        class="t-b"
      >{{ L[card.title] }}</text>
      <text
        x="16"
        y="102"
        class="t-sm t-mut"
      >{{ L[card.hint] }}</text>
    </g>
  </svg>
</template>
