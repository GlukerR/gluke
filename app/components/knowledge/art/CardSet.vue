<script setup lang="ts">
/* Комплект слайдов карточки маркетплейса из одной модели: обложка,
   ракурсы, деталь, устройство, размеры, в интерьере. Все кадры 3:4. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { cover: 'обложка', angles: 'ракурсы', detail: 'деталь', inside: 'устройство', size: 'размеры', room: 'в интерьере' },
  en: { cover: 'cover', angles: 'angles', detail: 'detail', inside: 'inside', size: 'dimensions', room: 'in a room' },
})

const slides = ['cover', 'angles', 'detail', 'inside', 'size', 'room'] as const
const W = 72
const H = 96
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <!-- Модель в центре сверху и стрелки к слайдам. -->
    <g transform="translate(260 30)">
      <rect
        x="-50"
        y="-18"
        width="100"
        height="36"
        rx="18"
        class="acc"
      />
      <text
        x="0"
        y="6"
        text-anchor="middle"
        class="t-sm t-b t-onacc"
      >3D</text>
    </g>
    <line
      v-for="(slide, index) in slides"
      :key="`l-${slide}`"
      x1="260"
      y1="48"
      :x2="16 + index * 84 + W / 2"
      y2="84"
      class="s-acc dash"
      stroke-width="1.2"
    />

    <g
      v-for="(slide, index) in slides"
      :key="slide"
      :transform="`translate(${16 + index * 84} 88)`"
    >
      <rect
        x="0"
        y="0"
        :width="W"
        :height="H"
        rx="6"
        :class="slide === 'room' ? 'soft2' : slide === 'cover' ? 'soft' : 'paper'"
        class="s-line"
        stroke-width="1.5"
      />

      <!-- Товар в каждом слайде: свой кадр. -->
      <g
        class="s-ink"
        stroke-width="1.2"
        stroke-linejoin="round"
      >
        <template v-if="slide === 'cover' || slide === 'room' || slide === 'angles'">
          <polygon
            :points="slide === 'angles' ? '26,40 46,40 46,74 26,74' : '22,40 46,40 54,32 30,32'"
            :class="slide === 'angles' ? 'mid' : 'lit'"
          />
          <template v-if="slide !== 'angles'">
            <polygon
              points="46,40 54,32 54,66 46,74"
              class="dark"
            />
            <rect
              x="22"
              y="40"
              width="24"
              height="34"
              class="mid"
            />
          </template>
        </template>
        <template v-else-if="slide === 'detail'">
          <circle
            cx="36"
            cy="50"
            r="22"
            class="mid"
          />
          <circle
            cx="36"
            cy="50"
            r="10"
            class="lit"
          />
          <circle
            cx="36"
            cy="50"
            r="4"
            class="acc"
          />
        </template>
        <template v-else-if="slide === 'inside'">
          <polygon
            points="22,30 50,30 50,36 22,36"
            class="lit"
          />
          <polygon
            points="24,46 48,46 48,54 24,54"
            class="acc"
          />
          <polygon
            points="22,64 50,64 50,78 22,78"
            class="mid"
          />
        </template>
        <template v-else>
          <rect
            x="24"
            y="38"
            width="24"
            height="36"
            class="mid"
          />
        </template>
      </g>
      <path
        v-if="slide === 'size'"
        d="M 24 82 H 48 M 24 78 V 86 M 48 78 V 86 M 56 38 V 74 M 52 38 H 60 M 52 74 H 60"
        class="none s-acc"
        stroke-width="1.5"
      />
      <rect
        v-if="slide === 'cover'"
        x="10"
        y="8"
        width="40"
        height="8"
        rx="2"
        class="acc"
      />
      <path
        v-if="slide === 'room'"
        d="M 0 74 H 72"
        class="none s-line"
        stroke-width="1.5"
      />

      <text
        :x="W / 2"
        :y="H + 22"
        text-anchor="middle"
        class="t-sm"
      >{{ L[slide] }}</text>
    </g>
  </svg>
</template>
