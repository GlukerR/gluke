<script setup lang="ts">
/* Когда LOD нужен, а когда хватит одной оптимизированной модели. Залитая
   плашка — LOD, контурная — одна модель. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'Игра: машины на улице', s2: 'Большая сцена: посёлок, завод', s3: 'Один товар во вьювере', s4: 'AR одного предмета', lod: 'LOD', one: 'одна модель' },
  en: { s1: 'A game: cars on a street', s2: 'A big scene: a village, a plant', s3: 'One product in a viewer', s4: 'AR of a single object', lod: 'LOD', one: 'one model' },
})

const rows = [
  { key: 's1', lod: true },
  { key: 's2', lod: true },
  { key: 's3', lod: false },
  { key: 's4', lod: false },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 220"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(row, index) in rows"
      :key="row.key"
      :transform="`translate(0 ${8 + index * 52})`"
    >
      <rect
        x="2"
        y="0"
        width="330"
        height="40"
        rx="20"
        class="soft s-line"
        stroke-width="2"
      />
      <text
        x="22"
        y="26"
        class="t-sm"
      >{{ L[row.key] }}</text>
      <path
        d="M 342 20 H 372 M 364 13 L 372 20 L 364 27"
        class="none s-acc round"
        stroke-width="2"
      />
      <rect
        x="382"
        y="0"
        width="130"
        height="40"
        rx="20"
        :class="row.lod ? 'acc' : 'paper'"
        class="s-acc"
        stroke-width="2"
      />
      <text
        x="447"
        y="26"
        text-anchor="middle"
        class="t-sm t-b"
        :class="row.lod ? 't-onacc' : 't-acc'"
      >{{ row.lod ? L.lod : L.one }}</text>
    </g>
  </svg>
</template>
