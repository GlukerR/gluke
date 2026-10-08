<script setup lang="ts">
import Camera from './parts/Camera.vue'
import Verdict from './parts/Verdict.vue'

/* Вид сбоку: фотоаппарат, изделие и рулетка той же высоты. Лучи от
   объектива показывают, что рулетка в плоскости изделия совпадает с ним
   в кадре, а рулетка ближе к камере «вырастает» и врёт о размере. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { ok: 'Рулетка вплотную к изделию', bad: 'Рулетка ближе к камере', size: '50 см', tape: 'рулетка', okNote: 'в кадре совпадают', badNote: 'изделие кажется меньше', taller: 'в кадре выше изделия' },
  en: { ok: 'Tape right against the product', bad: 'Tape closer to the camera', size: '50 cm', tape: 'tape', okNote: 'they match in the frame', badNote: 'the product looks smaller', taller: 'looks taller in frame' },
})

const ticks = Array.from({ length: 7 }, (_, index) => 90 + index * 10)
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 380"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="panel in [{ y: 0, ok: true }, { y: 192, ok: false }]"
      :key="panel.y"
      :transform="`translate(0 ${panel.y})`"
    >
      <Verdict
        :x="22"
        :y="26"
        :ok="panel.ok"
      />
      <text
        x="46"
        y="32"
        class="t-b"
      >{{ panel.ok ? L.ok : L.bad }}</text>

      <line
        x1="16"
        y1="160"
        x2="504"
        y2="160"
        class="s-line"
        stroke-width="2"
      />
      <Camera
        :x="44"
        :y="118"
      />

      <rect
        x="340"
        y="80"
        width="100"
        height="80"
        rx="4"
        class="mid s-ink"
        stroke-width="2"
      />
      <text
        x="390"
        y="126"
        text-anchor="middle"
        class="t-sm"
      >{{ L.size }}</text>

      <template v-if="panel.ok">
        <g
          class="s-acc dash"
          stroke-width="1.5"
        >
          <line
            x1="60"
            y1="118"
            x2="330"
            y2="80"
          />
          <line
            x1="60"
            y1="118"
            x2="330"
            y2="160"
          />
        </g>
        <rect
          x="326"
          y="80"
          width="9"
          height="80"
          class="acc"
        />
        <line
          v-for="tick in ticks"
          :key="tick"
          x1="326"
          :y1="tick"
          x2="331"
          :y2="tick"
          class="s-paper"
          stroke-width="1.5"
        />
        <text
          x="330"
          y="72"
          text-anchor="middle"
          class="t-sm t-acc"
        >{{ L.tape }}</text>
        <text
          x="390"
          y="184"
          text-anchor="middle"
          class="t-sm t-mut"
        >{{ L.okNote }}</text>
      </template>

      <template v-else>
        <g
          class="s-mut"
          stroke-width="1.5"
        >
          <line
            x1="60"
            y1="118"
            x2="200"
            y2="80"
          />
          <line
            x1="60"
            y1="118"
            x2="200"
            y2="160"
          />
        </g>
        <line
          x1="200"
          y1="80"
          x2="340"
          y2="42"
          class="s-mut dash"
          stroke-width="1.5"
        />
        <circle
          cx="340"
          cy="42"
          r="4"
          class="mutf"
        />
        <text
          x="350"
          y="47"
          class="t-sm t-mut"
        >{{ L.taller }}</text>
        <rect
          x="196"
          y="80"
          width="9"
          height="80"
          class="acc"
        />
        <line
          v-for="tick in ticks"
          :key="tick"
          x1="196"
          :y1="tick"
          x2="201"
          :y2="tick"
          class="s-paper"
          stroke-width="1.5"
        />
        <text
          x="200"
          y="72"
          text-anchor="middle"
          class="t-sm t-acc"
        >{{ L.tape }}</text>
        <text
          x="390"
          y="184"
          text-anchor="middle"
          class="t-sm t-mut"
        >{{ L.badNote }}</text>
      </template>
    </g>
    <line
      x1="16"
      y1="190"
      x2="504"
      y2="190"
      class="s-line"
      stroke-width="1"
    />
  </svg>
</template>
