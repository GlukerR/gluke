<script setup lang="ts">
/* Ситуации и что в них обычно выигрывает: 3D или фотосъёмка. Справа —
   плашка с ответом: залитая — 3D, контурная — фото. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'Товара ещё нет, только чертежи', s2: 'Много цветов и комплектаций', s3: 'Серия в едином стиле', s4: 'Показать устройство внутри', s5: 'Люди, эмоции, живая сцена', s6: 'Один кадр, образец под рукой', render: '3D', photo: 'Фото' },
  en: { s1: 'No product yet, only drawings', s2: 'Many colors and configurations', s3: 'A series in one style', s4: 'Show what is inside', s5: 'People, emotion, a live scene', s6: 'One shot, sample at hand', render: '3D', photo: 'Photo' },
})

const rows = [
  { key: 's1', render: true },
  { key: 's2', render: true },
  { key: 's3', render: true },
  { key: 's4', render: true },
  { key: 's5', render: false },
  { key: 's6', render: false },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 330"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(row, index) in rows"
      :key="row.key"
      :transform="`translate(0 ${8 + index * 54})`"
    >
      <rect
        x="2"
        y="0"
        width="360"
        height="42"
        rx="21"
        class="soft s-line"
        stroke-width="2"
      />
      <text
        x="22"
        y="27"
        class="t-sm"
      >{{ L[row.key] }}</text>
      <path
        d="M 372 21 H 400 M 392 14 L 400 21 L 392 28"
        class="none s-acc round"
        stroke-width="2"
      />
      <rect
        x="412"
        y="0"
        width="100"
        height="42"
        rx="21"
        :class="row.render ? 'acc' : 'paper'"
        class="s-acc"
        stroke-width="2"
      />
      <text
        x="462"
        y="27"
        text-anchor="middle"
        class="t-b"
        :class="row.render ? 't-onacc' : 't-acc'"
      >{{ row.render ? L.render : L.photo }}</text>
    </g>
  </svg>
</template>
