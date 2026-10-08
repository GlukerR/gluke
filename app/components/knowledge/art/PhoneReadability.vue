<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Карточку смотрят с телефона в ленте, где она размером с почтовую марку.
   Слева мелкий товар и много мелкого текста, справа крупный товар и одна
   короткая надпись. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: 'Мелко и много текста', ok: 'Крупно и коротко' },
  en: { bad: 'Small, lots of text', ok: 'Large and short' },
})

const phones = [
  { x: 0, ok: false },
  { x: 264, ok: true },
]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 300"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="phone in phones"
      :key="phone.x"
      :transform="`translate(${phone.x} 0)`"
    >
      <Verdict
        :x="22"
        :y="20"
        :ok="phone.ok"
      />
      <text
        x="44"
        y="26"
        class="t-b"
      >{{ phone.ok ? L.ok : L.bad }}</text>

      <!-- Телефон и лента из двух карточек. -->
      <rect
        x="40"
        y="44"
        width="170"
        height="248"
        rx="22"
        class="soft2 s-ink"
        stroke-width="2"
      />
      <rect
        x="52"
        y="64"
        width="146"
        height="216"
        rx="8"
        class="paper"
      />
      <rect
        v-for="col in [0, 1]"
        :key="col"
        :x="58 + col * 70"
        y="70"
        width="64"
        height="86"
        rx="4"
        class="soft s-line"
        stroke-width="1"
      />

      <template v-if="!phone.ok">
        <g
          v-for="col in [0, 1]"
          :key="`b-${col}`"
        >
          <rect
            :x="80 + col * 70"
            y="112"
            width="18"
            height="24"
            class="mid s-ink"
            stroke-width="1"
          />
          <line
            v-for="row in 5"
            :key="row"
            :x1="62 + col * 70"
            :y1="76 + row * 6"
            :x2="114 + col * 70"
            :y2="76 + row * 6"
            class="s-mut"
            stroke-width="2"
          />
          <line
            v-for="row in 2"
            :key="`r-${row}`"
            :x1="62 + col * 70"
            :y1="140 + row * 5"
            :x2="104 + col * 70"
            :y2="140 + row * 5"
            class="s-mut"
            stroke-width="2"
          />
        </g>
      </template>
      <template v-else>
        <g
          v-for="col in [0, 1]"
          :key="`g-${col}`"
        >
          <g
            class="s-ink"
            stroke-width="1"
            stroke-linejoin="round"
          >
            <polygon
              :points="`${68 + col * 70},96 ${100 + col * 70},96 ${110 + col * 70},88 ${78 + col * 70},88`"
              class="lit"
            />
            <polygon
              :points="`${100 + col * 70},96 ${110 + col * 70},88 ${110 + col * 70},138 ${100 + col * 70},146`"
              class="dark"
            />
            <rect
              :x="68 + col * 70"
              y="96"
              width="32"
              height="50"
              class="mid"
            />
          </g>
          <rect
            :x="62 + col * 70"
            y="74"
            width="40"
            height="9"
            rx="2"
            class="acc"
          />
        </g>
      </template>

      <!-- Ниже в ленте — ещё карточки, чтобы был виден масштаб. -->
      <rect
        v-for="col in [0, 1]"
        :key="`n-${col}`"
        :x="58 + col * 70"
        y="164"
        width="64"
        height="86"
        rx="4"
        class="soft s-line"
        stroke-width="1"
        opacity="0.6"
      />
    </g>
  </svg>
</template>
