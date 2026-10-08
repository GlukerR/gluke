<script setup lang="ts">
/* Что лежит в передаче проекта: пять типов файлов и для чего каждый
   пригодится. Номера совпадают со списком в статье. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { renders: 'Рендеры', rendersNote: 'полный размер + для сайта', model: '3D-модель', modelNote: 'GLB / FBX', textures: 'Текстуры', texturesNote: 'карты материалов', source: 'Исходник сцены', sourceNote: 'свет, камеры, материалы', video: 'Видео', videoNote: 'если делали' },
  en: { renders: 'Renders', rendersNote: 'full size + web', model: '3D model', modelNote: 'GLB / FBX', textures: 'Textures', texturesNote: 'material maps', source: 'Scene source', sourceNote: 'lights, cameras, materials', video: 'Video', videoNote: 'if made' },
})

const items = [
  { key: 'renders', note: 'rendersNote' },
  { key: 'model', note: 'modelNote' },
  { key: 'textures', note: 'texturesNote' },
  { key: 'source', note: 'sourceNote' },
  { key: 'video', note: 'videoNote' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <!-- Папка проекта. -->
    <path
      d="M 16 70 V 252 a 10 10 0 0 0 10 10 H 168 a 10 10 0 0 0 10 -10 V 92 a 10 10 0 0 0 -10 -10 H 92 L 76 60 H 26 a 10 10 0 0 0 -10 10 Z"
      class="soft2 s-acc"
      stroke-width="2"
    />
    <g transform="translate(36 108)">
      <rect
        x="0"
        y="0"
        width="54"
        height="40"
        rx="4"
        class="lit s-ink"
        stroke-width="1.5"
      />
      <rect
        x="18"
        y="18"
        width="54"
        height="40"
        rx="4"
        class="mid s-ink"
        stroke-width="1.5"
      />
      <rect
        x="36"
        y="36"
        width="54"
        height="40"
        rx="4"
        class="dark s-ink"
        stroke-width="1.5"
      />
      <path
        d="M 44 66 l 12 -12 l 10 8 l 14 -14 l 8 8"
        class="none s-ink round"
        stroke-width="1.5"
      />
    </g>

    <path
      d="M 186 164 H 214"
      class="none s-acc round"
      stroke-width="2"
    />

    <g
      v-for="(item, index) in items"
      :key="item.key"
      :transform="`translate(226 ${18 + index * 54})`"
    >
      <rect
        x="0"
        y="0"
        width="290"
        height="44"
        rx="10"
        class="soft s-line"
        stroke-width="1.5"
      />
      <circle
        cx="22"
        cy="22"
        r="12"
        class="acc"
      />
      <text
        x="22"
        y="27"
        text-anchor="middle"
        class="t-sm t-b t-onacc"
      >{{ index + 1 }}</text>
      <text
        x="44"
        y="20"
        class="t-sm t-b"
      >{{ L[item.key] }}</text>
      <text
        x="44"
        y="37"
        class="t-sm t-mut"
      >{{ L[item.note] }}</text>
    </g>
  </svg>
</template>
