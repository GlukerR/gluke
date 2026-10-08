<script setup lang="ts">
/* AR глазами посетителя: кнопка на странице, камера находит пол, модель
   встаёт в натуральную величину. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { s1: 'кнопка «В AR»', s2: 'камера ищет пол', s3: 'товар в комнате' },
  en: { s1: '"View in AR" button', s2: 'camera finds the floor', s3: 'product in the room' },
})

const steps = ['s1', 's2', 's3'] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 260"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="(step, index) in steps"
      :key="step"
      :transform="`translate(${24 + index * 172} 10)`"
    >
      <!-- Телефон. -->
      <rect
        x="0"
        y="0"
        width="120"
        height="200"
        rx="18"
        class="soft2 s-ink"
        stroke-width="2"
      />
      <rect
        x="8"
        y="14"
        width="104"
        height="172"
        rx="8"
        class="paper"
      />

      <template v-if="index === 0">
        <rect
          x="16"
          y="24"
          width="88"
          height="88"
          rx="6"
          class="soft"
        />
        <g
          class="s-ink"
          stroke-width="1.2"
          stroke-linejoin="round"
        >
          <polygon
            points="42,56 70,56 80,48 52,48"
            class="lit"
          />
          <polygon
            points="70,56 80,48 80,90 70,98"
            class="dark"
          />
          <rect
            x="42"
            y="56"
            width="28"
            height="42"
            class="mid"
          />
        </g>
        <rect
          x="22"
          y="124"
          width="76"
          height="28"
          rx="14"
          class="acc"
        />
        <text
          x="60"
          y="143"
          text-anchor="middle"
          class="t-sm t-b t-onacc"
        >AR</text>
      </template>

      <template v-else>
        <!-- Вид с камеры: стена, пол в перспективе. -->
        <rect
          x="8"
          y="14"
          width="104"
          height="80"
          class="soft"
        />
        <polygon
          points="8,94 112,94 112,186 8,186"
          class="lit"
          opacity="0.6"
        />
        <g
          class="s-acc"
          stroke-width="1"
          opacity="0.8"
        >
          <line
            x1="8"
            y1="120"
            x2="112"
            y2="120"
          />
          <line
            x1="8"
            y1="150"
            x2="112"
            y2="150"
          />
          <line
            x1="40"
            y1="94"
            x2="20"
            y2="186"
          />
          <line
            x1="80"
            y1="94"
            x2="100"
            y2="186"
          />
        </g>
        <template v-if="index === 1">
          <ellipse
            cx="60"
            cy="138"
            rx="26"
            ry="9"
            class="none s-acc"
            stroke-width="2.5"
            stroke-dasharray="6 4"
          />
        </template>
        <template v-else>
          <ellipse
            cx="60"
            cy="150"
            rx="26"
            ry="6"
            class="shadow"
          />
          <g
            class="s-ink"
            stroke-width="1.2"
            stroke-linejoin="round"
          >
            <polygon
              points="38,104 70,104 82,94 50,94"
              class="lit"
            />
            <polygon
              points="70,104 82,94 82,140 70,152"
              class="dark"
            />
            <rect
              x="38"
              y="104"
              width="32"
              height="48"
              class="mid"
            />
          </g>
        </template>
      </template>

      <text
        x="60"
        y="230"
        text-anchor="middle"
        class="t-sm"
        :class="index === 2 ? 't-b t-acc' : ''"
      >{{ L[step] }}</text>
      <path
        v-if="index < 2"
        d="M 132 100 H 156 M 148 93 L 156 100 L 148 107"
        class="none s-acc round"
        stroke-width="2.5"
      />
    </g>
  </svg>
</template>
