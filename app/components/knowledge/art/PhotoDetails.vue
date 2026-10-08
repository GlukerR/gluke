<script setup lang="ts">
/* Крупные планы: изделие в центре и четыре «лупы» вокруг — крепёж,
   фактура, маркировка, стык. Линия от лупы ведёт к месту на изделии. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { screw: 'крепёж', texture: 'фактура', label: 'маркировка', seam: 'стыки' },
  en: { screw: 'fasteners', texture: 'texture', label: 'markings', seam: 'joints' },
})

const uid = useId()

const R = 50

/* Лупы: центр, точка на изделии, подпись. Линия начинается на краю
   круга, а не в центре — считаем точку выхода по направлению к цели. */
const callouts = [
  { key: 'screw', cx: 80, cy: 80, tx: 200, ty: 180 },
  { key: 'texture', cx: 440, cy: 80, tx: 300, ty: 152 },
  { key: 'label', cx: 80, cy: 330, tx: 206, ty: 250 },
  { key: 'seam', cx: 440, cy: 330, tx: 300, ty: 284 },
] as const

function edge(item: typeof callouts[number]) {
  const angle = Math.atan2(item.ty - item.cy, item.tx - item.cx)
  /* Округляем: тригонометрия на сервере и в браузере расходится в последнем
     знаке, а атрибуты должны совпасть при гидратации. */
  return {
    x: Math.round((item.cx + R * Math.cos(angle)) * 10) / 10,
    y: Math.round((item.cy + R * Math.sin(angle)) * 10) / 10,
  }
}
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 420"
    role="img"
    :aria-label="alt"
  >
    <defs>
      <pattern
        :id="`${uid}-dots`"
        width="9"
        height="9"
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx="4.5"
          cy="4.5"
          r="2"
          class="dark"
        />
      </pattern>
      <pattern
        :id="`${uid}-dots-sm`"
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
      >
        <circle
          cx="3"
          cy="3"
          r="1.1"
          class="dark"
        />
      </pattern>
      <clipPath
        v-for="item in callouts"
        :id="`${uid}-${item.key}`"
        :key="item.key"
      >
        <circle
          :cx="item.cx"
          :cy="item.cy"
          :r="R"
        />
      </clipPath>
    </defs>

    <!-- Изделие. -->
    <polygon
      points="190,170 330,170 360,142 220,142"
      class="lit s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <polygon
      points="190,170 330,170 360,142 220,142"
      :fill="`url(#${uid}-dots-sm)`"
    />
    <polygon
      points="330,170 360,142 360,262 330,290"
      class="dark s-ink"
      stroke-width="2"
      stroke-linejoin="round"
    />
    <rect
      x="190"
      y="170"
      width="140"
      height="120"
      class="mid s-ink"
      stroke-width="2"
    />
    <line
      x1="300"
      y1="170"
      x2="300"
      y2="290"
      class="s-ink"
      stroke-width="2"
    />
    <circle
      v-for="[x, y] in [[200, 180], [290, 180], [200, 280], [290, 280]]"
      :key="`${x}-${y}`"
      :cx="x"
      :cy="y"
      r="4"
      class="lit s-ink"
      stroke-width="1.5"
    />
    <rect
      x="206"
      y="238"
      width="46"
      height="26"
      rx="3"
      class="lit s-ink"
      stroke-width="1.5"
    />

    <!-- Выноски. -->
    <line
      v-for="item in callouts"
      :key="`l-${item.key}`"
      :x1="edge(item).x"
      :y1="edge(item).y"
      :x2="item.tx"
      :y2="item.ty"
      class="s-acc"
      stroke-width="1.5"
    />
    <circle
      v-for="item in callouts"
      :key="`d-${item.key}`"
      :cx="item.tx"
      :cy="item.ty"
      r="4"
      class="acc"
    />

    <!-- Крепёж: головка винта с крестовым шлицем. -->
    <g :clip-path="`url(#${uid}-screw)`">
      <rect
        x="30"
        y="30"
        width="100"
        height="100"
        class="mid"
      />
      <circle
        cx="80"
        cy="80"
        r="26"
        class="lit s-ink"
        stroke-width="2"
      />
      <path
        d="M 66 80 H 94 M 80 66 V 94"
        class="none s-ink round"
        stroke-width="6"
      />
    </g>
    <!-- Фактура: шагрень. -->
    <g :clip-path="`url(#${uid}-texture)`">
      <rect
        x="390"
        y="30"
        width="100"
        height="100"
        class="lit"
      />
      <rect
        x="390"
        y="30"
        width="100"
        height="100"
        :fill="`url(#${uid}-dots)`"
      />
    </g>
    <!-- Маркировка: шильдик. -->
    <g :clip-path="`url(#${uid}-label)`">
      <rect
        x="30"
        y="280"
        width="100"
        height="100"
        class="mid"
      />
      <rect
        x="44"
        y="306"
        width="72"
        height="48"
        rx="5"
        class="lit s-ink"
        stroke-width="2"
      />
      <text
        x="80"
        y="327"
        text-anchor="middle"
        class="t-sm t-b"
      >SN 0042</text>
      <line
        x1="54"
        y1="340"
        x2="106"
        y2="340"
        class="s-mut"
        stroke-width="3"
        stroke-linecap="round"
      />
    </g>
    <!-- Стык: две панели и зазор между ними. -->
    <g :clip-path="`url(#${uid}-seam)`">
      <rect
        x="390"
        y="280"
        width="100"
        height="100"
        class="mid"
      />
      <rect
        x="436"
        y="280"
        width="8"
        height="100"
        class="dark"
      />
      <line
        x1="436"
        y1="280"
        x2="436"
        y2="380"
        class="s-ink"
        stroke-width="2"
      />
      <line
        x1="444"
        y1="280"
        x2="444"
        y2="380"
        class="s-ink"
        stroke-width="2"
      />
    </g>

    <circle
      v-for="item in callouts"
      :key="`c-${item.key}`"
      :cx="item.cx"
      :cy="item.cy"
      :r="R"
      class="none s-acc"
      stroke-width="3"
    />
    <text
      v-for="item in callouts"
      :key="`t-${item.key}`"
      :x="item.cx"
      :y="item.cy + R + 24"
      text-anchor="middle"
      class="t-b"
    >{{ L[item.key] }}</text>
  </svg>
</template>
