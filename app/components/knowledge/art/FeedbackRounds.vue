<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Правки россыпью от разных людей между версиями против одного сводного
   списка за раунд. Во втором случае противоречия разобраны до того, как
   их получил исполнитель. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: 'Россыпью от разных людей', ok: 'Один список за раунд', round: 'сводный список', v1: 'версия 1', v2: 'версия 2' },
  en: { bad: 'Scattered, from several people', ok: 'One list per round', round: 'combined list', v1: 'version 1', v2: 'version 2' },
})

/* Сообщения россыпью: время (x), автор (оттенок), высота пузыря. */
const scattered = [
  { x: 120, y: 80, tone: 'acc' },
  { x: 160, y: 108, tone: 'soft2' },
  { x: 200, y: 74, tone: 'acc' },
  { x: 236, y: 112, tone: 'lit' },
  { x: 282, y: 86, tone: 'soft2' },
  { x: 318, y: 70, tone: 'acc' },
  { x: 352, y: 106, tone: 'lit' },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 340"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="panel in [{ y: 0, ok: false }, { y: 170, ok: true }]"
      :key="panel.y"
      :transform="`translate(0 ${panel.y})`"
    >
      <Verdict
        :x="22"
        :y="22"
        :ok="panel.ok"
      />
      <text
        x="46"
        y="28"
        class="t-b"
      >{{ panel.ok ? L.ok : L.bad }}</text>

      <line
        x1="60"
        y1="136"
        x2="460"
        y2="136"
        class="s-line"
        stroke-width="2"
      />
      <g
        v-for="(version, index) in ['v1', 'v2'] as const"
        :key="version"
        :transform="`translate(${index === 0 ? 60 : 460} 136)`"
      >
        <circle
          r="9"
          class="acc"
        />
        <text
          y="28"
          text-anchor="middle"
          class="t-sm t-mut"
        >{{ L[version] }}</text>
      </g>

      <template v-if="!panel.ok">
        <g
          v-for="(item, index) in scattered"
          :key="index"
        >
          <line
            :x1="item.x"
            :y1="item.y + 14"
            :x2="item.x"
            y2="136"
            class="s-line dash"
            stroke-width="1.5"
          />
          <rect
            :x="item.x - 16"
            :y="item.y - 12"
            width="32"
            height="24"
            rx="6"
            :class="item.tone"
            class="s-ink"
            stroke-width="1"
          />
          <line
            :x1="item.x - 9"
            :y1="item.y - 2"
            :x2="item.x + 9"
            :y2="item.y - 2"
            class="s-ink"
            stroke-width="1.5"
            opacity="0.6"
          />
          <line
            :x1="item.x - 9"
            :y1="item.y + 4"
            :x2="item.x + 4"
            :y2="item.y + 4"
            class="s-ink"
            stroke-width="1.5"
            opacity="0.6"
          />
        </g>
      </template>
      <template v-else>
        <line
          x1="260"
          y1="122"
          x2="260"
          y2="136"
          class="s-acc"
          stroke-width="2"
        />
        <rect
          x="200"
          y="50"
          width="120"
          height="72"
          rx="8"
          class="soft2 s-acc"
          stroke-width="2"
        />
        <line
          v-for="row in 4"
          :key="row"
          x1="214"
          :y1="56 + row * 12"
          :x2="row === 4 ? 270 : 306"
          :y2="56 + row * 12"
          class="s-ink"
          stroke-width="2"
          stroke-linecap="round"
          opacity="0.7"
        />
        <text
          x="334"
          y="90"
          class="t-sm t-acc"
        >{{ L.round }}</text>
      </template>
    </g>
    <line
      x1="16"
      y1="168"
      x2="504"
      y2="168"
      class="s-line"
      stroke-width="1"
    />
  </svg>
</template>
