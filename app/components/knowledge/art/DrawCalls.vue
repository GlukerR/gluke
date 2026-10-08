<script setup lang="ts">
import Verdict from './parts/Verdict.vue'

/* Вызовы отрисовки: каждая отдельная деталь со своим материалом — отдельное
   задание видеокарте. Слева двенадцать деталей — двенадцать заданий,
   справа детали сведены в три материала — три задания. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: '12 материалов', ok: '3 материала', gpu: 'видеокарта', badNote: '12 заданий', okNote: '3 задания' },
  en: { bad: '12 materials', ok: '3 materials', gpu: 'GPU', badNote: '12 jobs', okNote: '3 jobs' },
})

const many = Array.from({ length: 12 }, (_, index) => ({ x: 20 + (index % 4) * 34, y: 52 + Math.floor(index / 4) * 34 }))
const few = [
  { y: 52, h: 26 },
  { y: 86, h: 26 },
  { y: 120, h: 26 },
]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 220"
    role="img"
    :aria-label="alt"
  >
    <!-- Много: каждая деталь — своя стрелка к видеокарте. -->
    <Verdict
      :x="20"
      :y="22"
      :ok="false"
    />
    <text
      x="42"
      y="28"
      class="t-b"
    >{{ L.bad }}</text>
    <rect
      v-for="(item, index) in many"
      :key="`m-${index}`"
      :x="item.x"
      :y="item.y"
      width="26"
      height="26"
      rx="4"
      :class="['lit', 'mid', 'dark', 'soft2'][index % 4]"
      class="s-ink"
      stroke-width="1"
    />
    <line
      v-for="(item, index) in many"
      :key="`ml-${index}`"
      :x1="item.x + 26"
      :y1="item.y + 13"
      x2="200"
      y2="112"
      class="s-mut"
      stroke-width="1"
    />
    <rect
      x="200"
      y="82"
      width="56"
      height="60"
      rx="6"
      class="soft2 s-ink"
      stroke-width="1.5"
    />
    <text
      x="228"
      y="166"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.badNote }}</text>

    <!-- Мало: три группы — три стрелки. -->
    <g transform="translate(250 0)">
      <Verdict
        :x="20"
        :y="22"
        :ok="true"
      />
      <text
        x="42"
        y="28"
        class="t-b"
      >{{ L.ok }}</text>
      <rect
        v-for="(group, index) in few"
        :key="`f-${index}`"
        x="20"
        :y="group.y"
        width="128"
        :height="group.h"
        rx="6"
        :class="['lit', 'mid', 'acc'][index]"
        class="s-ink"
        stroke-width="1"
      />
      <line
        v-for="(group, index) in few"
        :key="`fl-${index}`"
        x1="148"
        :y1="group.y + 13"
        x2="184"
        y2="112"
        class="s-acc"
        stroke-width="2"
      />
      <rect
        x="184"
        y="82"
        width="56"
        height="60"
        rx="6"
        class="soft2 s-acc"
        stroke-width="2"
      />
      <text
        x="212"
        y="166"
        text-anchor="middle"
        class="t-sm t-acc"
      >{{ L.okNote }}</text>
    </g>

    <text
      x="228"
      y="204"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.gpu }}</text>
    <text
      x="462"
      y="204"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.gpu }}</text>
  </svg>
</template>
