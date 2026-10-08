<script setup lang="ts">
import Camera from './parts/Camera.vue'

/* Вид сверху: изделие в центре, фотоаппарат обходит его по кругу.
   Четыре главных ракурса — строго по сторонам, четыре «три четверти» —
   между ними, плюс отдельные кадры сверху и снизу. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { item: 'изделие', front: 'перед', s1: 'спереди', s2: 'сзади', s3: 'слева', s4: 'справа', top: '+ сверху', bottom: '+ снизу' },
  en: { item: 'product', front: 'front', s1: 'front', s2: 'back', s3: 'left', s4: 'right', top: '+ from above', bottom: '+ from below' },
})

const C = { x: 260, y: 215 }
const R = 150

function onCircle(deg: number, radius = R) {
  const rad = (deg * Math.PI) / 180
  return { x: Math.round(C.x + radius * Math.cos(rad)), y: Math.round(C.y + radius * Math.sin(rad)) }
}

const diagonals = [45, 135, 225, 315].map(deg => ({ deg, cam: onCircle(deg), mark: onCircle(deg, R + 30) }))
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 420"
    role="img"
    :aria-label="alt"
  >
    <circle
      :cx="C.x"
      :cy="C.y"
      :r="R"
      class="none s-line dash"
      stroke-width="2"
    />

    <!-- Лучи главных ракурсов: строго перпендикулярно стороне изделия. -->
    <g
      class="s-acc dash"
      stroke-width="1.5"
    >
      <line
        x1="260"
        y1="349"
        x2="260"
        y2="254"
      />
      <line
        x1="260"
        y1="81"
        x2="260"
        y2="176"
      />
      <line
        x1="126"
        y1="215"
        x2="201"
        y2="215"
      />
      <line
        x1="394"
        y1="215"
        x2="319"
        y2="215"
      />
    </g>

    <rect
      x="205"
      y="180"
      width="110"
      height="70"
      rx="10"
      class="soft2 s-ink"
      stroke-width="2"
    />
    <line
      x1="212"
      y1="250"
      x2="308"
      y2="250"
      class="s-acc"
      stroke-width="5"
      stroke-linecap="round"
    />
    <text
      x="260"
      y="212"
      text-anchor="middle"
      class="t-sm"
    >{{ L.item }}</text>
    <text
      x="260"
      y="236"
      text-anchor="middle"
      class="t-sm t-acc"
    >{{ L.front }}</text>

    <Camera
      :x="260"
      :y="365"
      :angle="-90"
    />
    <Camera
      :x="260"
      :y="65"
      :angle="90"
    />
    <Camera
      :x="110"
      :y="215"
      :angle="0"
    />
    <Camera
      :x="410"
      :y="215"
      :angle="180"
    />
    <Camera
      v-for="item in diagonals"
      :key="item.deg"
      :x="item.cam.x"
      :y="item.cam.y"
      :angle="item.deg + 180"
      :strong="false"
    />

    <text
      x="286"
      y="371"
      class="t-b"
    >1 · {{ L.s1 }}</text>
    <text
      x="286"
      y="71"
      class="t-b"
    >2 · {{ L.s2 }}</text>
    <text
      x="110"
      y="258"
      text-anchor="middle"
      class="t-b"
    >3 · {{ L.s3 }}</text>
    <text
      x="410"
      y="258"
      text-anchor="middle"
      class="t-b"
    >4 · {{ L.s4 }}</text>
    <text
      v-for="item in diagonals"
      :key="`m-${item.deg}`"
      :x="item.mark.x"
      :y="item.mark.y + 6"
      text-anchor="middle"
      class="t-mut t-b"
    >¾</text>

    <Camera
      :x="30"
      :y="34"
      :angle="90"
      :scale="0.8"
    />
    <text
      x="52"
      y="40"
      class="t-sm"
    >{{ L.top }}</text>
    <Camera
      :x="30"
      :y="392"
      :angle="-90"
      :scale="0.8"
    />
    <text
      x="52"
      y="398"
      class="t-sm"
    >{{ L.bottom }}</text>
  </svg>
</template>
