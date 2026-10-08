<script setup lang="ts">
/* Путь модели от файла до экрана: файл GLB, загрузка по сети, видеокарта
   устройства, картинка, которая перерисовывается каждый кадр. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { file: 'файл GLB', fileNote: 'модель + текстуры', net: 'загрузка', netNote: 'по сети', gpu: 'видеокарта', gpuNote: 'рисует WebGL', screen: 'экран', screenNote: 'кадр за кадром' },
  en: { file: 'GLB file', fileNote: 'model + textures', net: 'download', netNote: 'over the network', gpu: 'GPU', gpuNote: 'draws via WebGL', screen: 'screen', screenNote: 'frame by frame' },
})

const steps = [
  { key: 'file', note: 'fileNote' },
  { key: 'net', note: 'netNote' },
  { key: 'gpu', note: 'gpuNote' },
  { key: 'screen', note: 'screenNote' },
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
      v-for="(step, index) in steps"
      :key="step.key"
      :transform="`translate(${8 + index * 130} 20)`"
    >
      <rect
        x="0"
        y="0"
        width="108"
        height="100"
        rx="12"
        :class="index === 3 ? 'soft2' : 'soft'"
        class="s-line"
        stroke-width="2"
      />
      <g
        class="none s-acc round"
        stroke-width="2.5"
      >
        <template v-if="step.key === 'file'">
          <path d="M 36 22 H 62 L 74 34 V 78 H 36 Z M 62 22 V 34 H 74" />
          <text
            x="55"
            y="64"
            text-anchor="middle"
            class="t-sm t-b t-acc"
            stroke-width="0"
          >GLB</text>
        </template>
        <template v-else-if="step.key === 'net'">
          <path d="M 54 24 V 70 M 40 56 L 54 70 L 68 56 M 34 80 H 74" />
        </template>
        <template v-else-if="step.key === 'gpu'">
          <rect
            x="30"
            y="30"
            width="48"
            height="40"
            rx="4"
          />
          <path d="M 38 30 V 22 M 50 30 V 22 M 62 30 V 22 M 38 78 V 70 M 50 78 V 70 M 62 78 V 70" />
          <rect
            x="42"
            y="42"
            width="24"
            height="16"
            class="acc"
            stroke-width="0"
          />
        </template>
        <template v-else>
          <rect
            x="34"
            y="18"
            width="40"
            height="66"
            rx="6"
          />
          <g
            class="s-ink"
            stroke-width="1.2"
            stroke-linejoin="round"
          >
            <polygon
              points="44,46 60,46 66,40 50,40"
              class="lit"
            />
            <polygon
              points="60,46 66,40 66,58 60,64"
              class="dark"
            />
            <rect
              x="44"
              y="46"
              width="16"
              height="18"
              class="mid"
            />
          </g>
          <path d="M 44 74 a 12 6 0 0 0 20 0" />
        </template>
      </g>
      <text
        x="54"
        y="136"
        text-anchor="middle"
        class="t-b"
      >{{ L[step.key] }}</text>
      <text
        x="54"
        y="158"
        text-anchor="middle"
        class="t-sm t-mut"
      >{{ L[step.note] }}</text>
      <path
        v-if="index < 3"
        d="M 112 50 H 124 M 118 44 L 124 50 L 118 56"
        class="none s-acc round"
        stroke-width="2"
      />
    </g>
  </svg>
</template>
