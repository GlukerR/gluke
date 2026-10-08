<script setup lang="ts">
/* Схема-уравнение: форма + внешний вид = 3D-модель. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { shape: 'Форма', shape1: 'CAD, чертежи,', shape2: 'образец', look: 'Внешний вид', look1: 'фото, RAL,', look2: 'образцы', model: '3D-модель', model1: 'точная', model2: 'и похожая' },
  en: { shape: 'Shape', shape1: 'CAD, drawings,', shape2: 'sample', look: 'Look', look1: 'photos, RAL,', look2: 'swatches', model: '3D model', model1: 'accurate', model2: 'and true to life' },
})
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 240"
    role="img"
    :aria-label="alt"
  >
    <!-- Форма: каркас с размерной линией. -->
    <g
      class="none round"
      stroke-width="2"
    >
      <path
        d="M 44 70 L 80 50 L 116 70 L 80 90 Z M 44 70 L 44 116 L 80 136 L 116 116 L 116 70 M 80 90 L 80 136"
        class="s-ink"
      />
      <path
        d="M 44 128 L 80 148 M 44 122 L 44 134 M 80 142 L 80 154"
        class="s-acc"
        stroke-width="1.5"
      />
    </g>

    <text
      x="170"
      y="108"
      text-anchor="middle"
      class="t-acc t-b"
      style="font-size: 34px"
    >+</text>

    <!-- Внешний вид: веер образцов цвета. -->
    <g
      class="s-ink"
      stroke-width="2"
    >
      <rect
        x="236"
        y="54"
        width="40"
        height="80"
        rx="6"
        class="dark"
        transform="rotate(-18 256 134)"
      />
      <rect
        x="240"
        y="54"
        width="40"
        height="80"
        rx="6"
        class="mid"
      />
      <rect
        x="244"
        y="54"
        width="40"
        height="80"
        rx="6"
        class="lit"
        transform="rotate(18 264 134)"
      />
      <circle
        cx="282"
        cy="78"
        r="6"
        class="acc"
        stroke-width="0"
      />
    </g>

    <text
      x="350"
      y="108"
      text-anchor="middle"
      class="t-acc t-b"
      style="font-size: 34px"
    >=</text>

    <!-- 3D-модель: тот же каркас, но с гранями и деталями. -->
    <g
      class="s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    >
      <polygon
        points="404,70 440,50 476,70 440,90"
        class="lit"
      />
      <polygon
        points="404,70 440,90 440,136 404,116"
        class="mid"
      />
      <polygon
        points="440,90 476,70 476,116 440,136"
        class="dark"
      />
      <circle
        cx="422"
        cy="104"
        r="7"
        class="acc"
        stroke-width="1.5"
      />
      <path
        d="M 450 92 L 466 83"
        class="none round"
        stroke-width="2"
      />
    </g>

    <g text-anchor="middle">
      <text
        x="80"
        y="182"
        class="t-b t-lg"
      >{{ L.shape }}</text>
      <text
        x="80"
        y="206"
        class="t-sm t-mut"
      >{{ L.shape1 }}</text>
      <text
        x="80"
        y="226"
        class="t-sm t-mut"
      >{{ L.shape2 }}</text>

      <text
        x="260"
        y="182"
        class="t-b t-lg"
      >{{ L.look }}</text>
      <text
        x="260"
        y="206"
        class="t-sm t-mut"
      >{{ L.look1 }}</text>
      <text
        x="260"
        y="226"
        class="t-sm t-mut"
      >{{ L.look2 }}</text>

      <text
        x="440"
        y="182"
        class="t-b t-lg t-acc"
      >{{ L.model }}</text>
      <text
        x="440"
        y="206"
        class="t-sm t-mut"
      >{{ L.model1 }}</text>
      <text
        x="440"
        y="226"
        class="t-sm t-mut"
      >{{ L.model2 }}</text>
    </g>
  </svg>
</template>
