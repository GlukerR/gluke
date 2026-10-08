<script setup lang="ts">
/* Фотоаппарат в схемах: корпус и объектив смотрят вдоль +X, поэтому
   `angle` (градусы) — направление взгляда. `strong` — акцентный вариант
   для главных ракурсов. */
const props = withDefaults(defineProps<{
  x: number
  y: number
  angle?: number
  strong?: boolean
  scale?: number
}>(), { angle: 0, strong: true, scale: 1 })
</script>

<template>
  <g :transform="`translate(${props.x} ${props.y}) rotate(${props.angle}) scale(${props.scale})`">
    <rect
      x="-16"
      y="-12"
      width="22"
      height="24"
      rx="4"
      :class="props.strong ? 'acc' : 'soft2'"
    />
    <rect
      x="-11"
      y="-17"
      width="9"
      height="6"
      rx="2"
      :class="props.strong ? 'acc' : 'soft2'"
    />
    <path
      d="M 6 -7 L 16 -11 L 16 11 L 6 7 Z"
      :class="props.strong ? 'acc2' : 'soft2'"
    />
  </g>
</template>
