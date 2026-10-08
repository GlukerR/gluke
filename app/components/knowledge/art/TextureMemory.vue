<script setup lang="ts">
/* Размер файла и память видеокарты — разные вещи. JPEG и PNG компактны на
   диске, но видеокарта распаковывает их целиком. KTX2 остаётся сжатым и в
   памяти. Полоски — относительные, без чисел. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { disk: 'на диске', vram: 'в памяти видеокарты', jpeg: 'JPEG / PNG', ktx: 'KTX2', note: 'длина полосок — для сравнения, не в масштабе' },
  en: { disk: 'on disk', vram: 'in GPU memory', jpeg: 'JPEG / PNG', ktx: 'KTX2', note: 'bar lengths are for comparison, not to scale' },
})

const rows = [
  { key: 'jpeg', disk: 0.22, vram: 1 },
  { key: 'ktx', disk: 0.28, vram: 0.25 },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <g transform="translate(0 0)">
      <rect
        x="140"
        y="12"
        width="14"
        height="14"
        rx="3"
        class="soft2 s-acc"
        stroke-width="1.5"
      />
      <text
        x="162"
        y="24"
        class="t-sm"
      >{{ L.disk }}</text>
      <rect
        x="268"
        y="12"
        width="14"
        height="14"
        rx="3"
        class="acc"
      />
      <text
        x="290"
        y="24"
        class="t-sm"
      >{{ L.vram }}</text>
    </g>

    <g
      v-for="(row, index) in rows"
      :key="row.key"
      :transform="`translate(0 ${60 + index * 84})`"
    >
      <text
        x="12"
        y="30"
        class="t-b"
      >{{ L[row.key] }}</text>
      <rect
        x="140"
        y="0"
        :width="360 * row.disk"
        height="22"
        rx="6"
        class="soft2 s-acc"
        stroke-width="1.5"
      />
      <rect
        x="140"
        y="30"
        :width="360 * row.vram"
        height="22"
        rx="6"
        class="acc"
      />
    </g>

    <text
      x="12"
      y="236"
      class="t-sm t-mut"
    >{{ L.note }}</text>
  </svg>
</template>
