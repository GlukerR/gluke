<script setup lang="ts">
/* Исходник сцены — это слои, которые можно менять по отдельности:
   модель, материалы, свет, камеры. Экспорт (GLB, рендер) — готовый
   результат, где всё уже сведено вместе. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { source: 'Исходник сцены', sourceNote: 'каждый слой правится', export: 'Экспорт: GLB, рендер', exportNote: 'готовый результат', l1: 'камеры', l2: 'свет', l3: 'материалы', l4: 'модель' },
  en: { source: 'Scene source', sourceNote: 'each layer is editable', export: 'Export: GLB, render', exportNote: 'a finished result', l1: 'cameras', l2: 'lights', l3: 'materials', l4: 'model' },
})

const layers = ['l1', 'l2', 'l3', 'l4'] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <text
      x="16"
      y="24"
      class="t-b"
    >{{ L.source }}</text>
    <g
      v-for="(layer, index) in layers"
      :key="layer"
      :transform="`translate(${16 + index * 10} ${44 + index * 40})`"
    >
      <polygon
        points="0,16 160,16 190,0 30,0"
        :class="index === 3 ? 'acc' : 'soft2'"
        class="s-acc"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
      <rect
        x="0"
        y="16"
        width="160"
        height="14"
        :class="index === 3 ? 'acc2' : 'soft'"
        class="s-acc"
        stroke-width="1.5"
      />
      <text
        x="200"
        y="22"
        class="t-sm"
        :class="index === 3 ? 't-acc t-b' : ''"
      >{{ L[layer] }}</text>
    </g>
    <text
      x="16"
      y="228"
      class="t-sm t-mut"
    >{{ L.sourceNote }}</text>

    <path
      d="M 300 120 H 330 M 322 113 L 330 120 L 322 127"
      class="none s-acc round"
      stroke-width="2.5"
    />

    <text
      x="348"
      y="24"
      class="t-b"
    >{{ L.export }}</text>
    <g
      transform="translate(348 64)"
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <polygon
        points="20,40 100,40 140,14 60,14"
        class="lit"
      />
      <polygon
        points="100,40 140,14 140,98 100,124"
        class="dark"
      />
      <rect
        x="20"
        y="40"
        width="80"
        height="84"
        class="mid"
      />
    </g>
    <text
      x="348"
      y="228"
      class="t-sm t-mut"
    >{{ L.exportNote }}</text>
  </svg>
</template>
