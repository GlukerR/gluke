<script setup lang="ts">
/* Взрыв-схема отвечает «из чего состоит», разрез — «как всё расположено
   внутри». Для котла или фильтра нужен разрез, для набора деталей —
   взрыв-схема. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { explode: 'Взрыв-схема', explodeNote: 'из чего состоит', cut: 'Разрез', cutNote: 'как устроено внутри' },
  en: { explode: 'Exploded view', explodeNote: 'what it is made of', cut: 'Cutaway', cutNote: 'how it sits inside' },
})
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 270"
    role="img"
    :aria-label="alt"
  >
    <!-- Взрыв-схема: три детали разнесены по вертикали. -->
    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <polygon
        points="50,60 150,60 180,40 80,40"
        class="lit"
      />
      <polygon
        points="50,60 150,60 150,70 50,70"
        class="dark"
      />
      <polygon
        points="150,60 180,40 180,50 150,70"
        class="dark"
      />

      <polygon
        points="60,118 140,118 162,102 82,102"
        class="acc"
      />
      <polygon
        points="60,118 140,118 140,138 60,138"
        class="acc2"
      />
      <polygon
        points="140,118 162,102 162,122 140,138"
        class="acc2"
      />

      <polygon
        points="50,186 150,186 180,166 80,166"
        class="mid"
      />
      <polygon
        points="50,186 150,186 150,224 50,224"
        class="dark"
      />
      <polygon
        points="150,186 180,166 180,204 150,224"
        class="dark"
        opacity="0.85"
      />
    </g>
    <g
      class="s-acc dash"
      stroke-width="1.2"
    >
      <line
        x1="115"
        y1="72"
        x2="115"
        y2="100"
      />
      <line
        x1="115"
        y1="140"
        x2="115"
        y2="164"
      />
    </g>
    <text
      x="115"
      y="250"
      text-anchor="middle"
      class="t-b"
    >{{ L.explode }}</text>
    <text
      x="115"
      y="20"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.explodeNote }}</text>

    <!-- Разрез: корпус с вырезанной четвертью, внутри видно начинку. -->
    <g
      class="s-ink"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <polygon
        points="320,70 440,70 480,40 360,40"
        class="lit"
      />
      <polygon
        points="320,70 380,70 380,224 320,224"
        class="mid"
      />
      <polygon
        points="440,70 480,40 480,194 440,224"
        class="dark"
      />
      <polygon
        points="380,70 440,70 440,224 380,224"
        class="soft"
      />
      <polygon
        points="380,70 410,48 410,202 380,224"
        class="soft2"
      />
      <circle
        cx="410"
        cy="110"
        r="16"
        class="acc"
      />
      <rect
        x="386"
        y="150"
        width="48"
        height="30"
        rx="4"
        class="acc2"
      />
      <path
        d="M 392 196 h 36 M 392 206 h 36"
        class="none s-acc"
        stroke-width="3"
        stroke-linecap="round"
      />
    </g>
    <text
      x="400"
      y="250"
      text-anchor="middle"
      class="t-b"
    >{{ L.cut }}</text>
    <text
      x="400"
      y="20"
      text-anchor="middle"
      class="t-sm t-mut"
    >{{ L.cutNote }}</text>
  </svg>
</template>
