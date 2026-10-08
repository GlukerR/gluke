<script setup lang="ts">
/* Какой файл нужен для AR на каком устройстве. Вьювер на странице сам
   отдаёт телефону подходящий. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { ios: 'iPhone и iPad', iosNote: 'просмотр AR Quick Look', android: 'Android', androidNote: 'Scene Viewer, нужен ARCore', viewer: 'вьювер на странице выбирает файл сам' },
  en: { ios: 'iPhone and iPad', iosNote: 'AR Quick Look viewer', android: 'Android', androidNote: 'Scene Viewer, needs ARCore', viewer: 'the page viewer picks the file itself' },
})

const rows = [
  { key: 'ios', note: 'iosNote', format: 'USDZ' },
  { key: 'android', note: 'androidNote', format: 'GLB' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 200"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(row, index) in rows"
      :key="row.key"
      :transform="`translate(0 ${10 + index * 76})`"
    >
      <rect
        x="2"
        y="0"
        width="330"
        height="60"
        rx="14"
        class="soft s-line"
        stroke-width="2"
      />
      <rect
        x="18"
        y="10"
        width="24"
        height="40"
        rx="5"
        class="none s-acc"
        stroke-width="2"
      />
      <text
        x="58"
        y="26"
        class="t-b"
      >{{ L[row.key] }}</text>
      <text
        x="58"
        y="47"
        class="t-sm t-mut"
      >{{ L[row.note] }}</text>
      <path
        d="M 342 30 H 382 M 374 23 L 382 30 L 374 37"
        class="none s-acc round"
        stroke-width="2"
      />
      <rect
        x="392"
        y="9"
        width="120"
        height="42"
        rx="21"
        class="acc"
      />
      <text
        x="452"
        y="36"
        text-anchor="middle"
        class="t-b t-onacc"
      >{{ row.format }}</text>
    </g>
    <text
      x="2"
      y="186"
      class="t-sm t-mut"
    >{{ L.viewer }}</text>
  </svg>
</template>
