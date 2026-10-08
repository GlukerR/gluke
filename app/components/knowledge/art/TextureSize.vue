<script setup lang="ts">
/* Удвоение стороны текстуры — вчетверо больше пикселей, а значит и памяти.
   Квадраты в масштабе: 1024, 2048 и 4096 по стороне. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { x1: '× 1 памяти', x4: '× 4', x16: '× 16', note1: 'вдвое больше сторона —', note2: 'вчетверо больше памяти' },
  en: { x1: '× 1 memory', x4: '× 4', x16: '× 16', note1: 'twice the side means', note2: 'four times the memory' },
})
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <!-- 4096: квадрат 224, 2048: 112, 1024: 56 — стороны в масштабе. -->
    <rect
      x="16"
      y="12"
      width="224"
      height="224"
      class="soft s-acc"
      stroke-width="2"
    />
    <rect
      x="16"
      y="124"
      width="112"
      height="112"
      class="soft2 s-acc"
      stroke-width="2"
    />
    <rect
      x="16"
      y="180"
      width="56"
      height="56"
      class="acc"
    />
    <text
      x="232"
      y="34"
      text-anchor="end"
      class="t-b"
    >4096</text>
    <text
      x="120"
      y="146"
      text-anchor="end"
      class="t-b"
    >2048</text>
    <text
      x="44"
      y="214"
      text-anchor="middle"
      class="t-sm t-b t-onacc"
    >1024</text>

    <g transform="translate(270 70)">
      <text
        x="0"
        y="0"
        class="t-b"
      >1024 → {{ L.x1 }}</text>
      <text
        x="0"
        y="32"
        class="t-b"
      >2048 → {{ L.x4 }}</text>
      <text
        x="0"
        y="64"
        class="t-b t-acc"
      >4096 → {{ L.x16 }}</text>
      <text
        x="0"
        y="112"
        class="t-sm t-mut"
      >{{ L.note1 }}</text>
      <text
        x="0"
        y="134"
        class="t-sm t-mut"
      >{{ L.note2 }}</text>
    </g>
  </svg>
</template>
