<script setup lang="ts">
import Camera from './parts/Camera.vue'
import Verdict from './parts/Verdict.vue'

/* Перспективные искажения: слева схема (камера, угол обзора, изделие),
   справа — что получится на снимке. Вплотную на широкий угол верх изделия
   сильно сходится вдаль; издалека с зумом снимок почти как чертёж. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { bad: 'Вплотную, широкий угол 0,5×', ok: 'С 2–3 м, зум 2–3×', badNote: 'пропорции искажены', okNote: 'почти как на чертеже' },
  en: { bad: 'Up close, ultra-wide 0.5×', ok: 'From 2–3 m, zoom 2–3×', badNote: 'proportions distorted', okNote: 'almost like a drawing' },
})

/* Клин поля зрения: от объектива в сторону центра изделия на ±half
   градусов. Объектив стоит в 16 px перед корпусом камеры. */
const TARGET = { x: 255, y: 130 }

function view(camera: { x: number, y: number }, half: number, length: number) {
  const angle = Math.atan2(TARGET.y - camera.y, TARGET.x - camera.x)
  const lens = { x: camera.x + 16 * Math.cos(angle), y: camera.y + 16 * Math.sin(angle) }
  const point = (offset: number) => {
    const rad = angle + (offset * Math.PI) / 180
    return `${(lens.x + length * Math.cos(rad)).toFixed(1)},${(lens.y + length * Math.sin(rad)).toFixed(1)}`
  }
  return {
    camera,
    /* Округление обязательно: Math.atan2 на сервере и в браузере расходится
       в последнем знаке, и атрибут transform не совпадал бы при гидратации. */
    angleDeg: Math.round((angle * 180) / Math.PI * 100) / 100,
    wedge: `${lens.x.toFixed(1)},${lens.y.toFixed(1)} ${point(-half)} ${point(half)}`,
  }
}

const panels = [
  { y: 0, ok: false, ...view({ x: 172, y: 96 }, 45, 120) },
  { y: 200, ok: true, ...view({ x: 36, y: 112 }, 8, 270) },
]
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 400"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="panel in panels"
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

      <polygon
        :points="panel.wedge"
        class="soft"
      />
      <rect
        x="230"
        y="105"
        width="50"
        height="50"
        rx="3"
        class="mid s-ink"
        stroke-width="2"
      />
      <Camera
        :x="panel.camera.x"
        :y="panel.camera.y"
        :angle="panel.angleDeg"
      />

      <rect
        x="330"
        y="48"
        width="170"
        height="124"
        rx="8"
        class="paper s-line"
        stroke-width="2"
      />
      <template v-if="panel.ok">
        <polygon
          points="370,108 460,108 456,92 374,92"
          class="lit s-ink"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <polygon
          points="370,108 460,108 460,158 370,158"
          class="mid s-ink"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </template>
      <template v-else>
        <polygon
          points="365,96 465,96 445,64 385,64"
          class="lit s-ink"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <polygon
          points="365,96 465,96 456,160 374,160"
          class="mid s-ink"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </template>
      <text
        x="415"
        y="192"
        text-anchor="middle"
        class="t-sm"
        :class="panel.ok ? 't-acc' : 't-mut'"
      >
        {{ panel.ok ? L.okNote : L.badNote }}
      </text>
    </g>
    <line
      x1="16"
      y1="198"
      x2="504"
      y2="198"
      class="s-line"
      stroke-width="1"
    />
  </svg>
</template>
