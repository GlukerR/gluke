<script setup lang="ts">
/* Значок «так — правильно / так — нет» в углу панели схемы. Правильный
   вариант — заливка акцентом с галочкой, неправильный — приглушённый
   кружок с крестом: цветом смысл не передаётся в одиночку, есть и форма. */
const props = defineProps<{ x: number, y: number, ok: boolean }>()
</script>

<template>
  <g :transform="`translate(${props.x} ${props.y})`">
    <circle
      r="14"
      :class="props.ok ? 'acc' : 'linef'"
    />
    <path
      v-if="props.ok"
      d="M -6 0 L -1.5 5 L 7 -5"
      class="none s-paper round"
      stroke-width="3"
    />
    <path
      v-else
      d="M -5 -5 L 5 5 M 5 -5 L -5 5"
      class="none s-ink round"
      stroke-width="3"
    />
  </g>
</template>
