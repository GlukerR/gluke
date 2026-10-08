<script setup lang="ts">
/* Одна и та же правка формы на разных этапах. Чем позже она пришла, тем
   больше слоёв работы над этой формой приходится переделать: материалы
   ложатся на форму, свет — на материалы, финальный рендер — на всё. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { title: 'Сколько переделывать, если поменять форму', layer1: 'форма', layer2: 'материалы', layer3: 'свет', layer4: 'рендер', at: 'правка на этапе' },
  en: { title: 'How much is redone if the shape changes', layer1: 'shape', layer2: 'materials', layer3: 'light', layer4: 'render', at: 'change at stage' },
})

const LAYERS = ['layer1', 'layer2', 'layer3', 'layer4'] as const
const BASE = 212
const BLOCK = 34
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 260"
    role="img"
    :aria-label="alt"
  >
    <text
      x="8"
      y="24"
      class="t-b"
    >{{ L.title }}</text>
    <line
      x1="8"
      :y1="BASE + 2"
      x2="512"
      :y2="BASE + 2"
      class="s-line"
      stroke-width="2"
    />

    <g
      v-for="stage in 4"
      :key="stage"
      :transform="`translate(${(stage - 1) * 128 + 12} 0)`"
    >
      <g
        v-for="layer in stage"
        :key="layer"
      >
        <rect
          x="0"
          :y="BASE - layer * (BLOCK + 4)"
          width="104"
          :height="BLOCK"
          rx="6"
          class="acc"
        />
        <text
          x="52"
          :y="BASE - layer * (BLOCK + 4) + 22"
          text-anchor="middle"
          class="t-sm t-b t-onacc"
        >{{ L[LAYERS[layer - 1]!] }}</text>
      </g>
      <text
        x="52"
        :y="BASE + 32"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L.at }} {{ stage }}</text>
    </g>
  </svg>
</template>
