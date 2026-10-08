<script setup lang="ts">
/* Две корзины правок. Ошибка — расхождение с изделием или ТЗ, её
   исправляют без обсуждения. Пожелание — вопрос вкуса, его стоит пометить
   так, чтобы исполнитель мог предложить вариант. */
defineProps<{ alt: string }>()

const L = useArtText({
  ru: { errors: 'Ошибки', errorsNote: 'не как в изделии или ТЗ', wishes: 'Пожелания', wishesNote: 'вопрос вкуса', e1: 'не та форма ручки', e2: 'нет винта сбоку', e3: 'цвет не по RAL', w1: 'свет потеплее', w2: 'ракурс чуть выше', w3: 'фон светлее' },
  en: { errors: 'Errors', errorsNote: 'differs from product or brief', wishes: 'Wishes', wishesNote: 'a matter of taste', e1: 'wrong knob shape', e2: 'side screw missing', e3: 'color off the RAL', w1: 'warmer light', w2: 'slightly higher angle', w3: 'lighter background' },
})

const columns = [
  { x: 0, title: 'errors', note: 'errorsNote', items: ['e1', 'e2', 'e3'], strong: true },
  { x: 264, title: 'wishes', note: 'wishesNote', items: ['w1', 'w2', 'w3'], strong: false },
] as const
</script>

<template>
  <svg
    class="kb-art"
    viewBox="0 0 520 250"
    role="img"
    :aria-label="alt"
  >
    <g
      v-for="column in columns"
      :key="column.title"
      :transform="`translate(${column.x} 0)`"
    >
      <rect
        x="2"
        y="2"
        width="252"
        height="244"
        rx="12"
        :class="column.strong ? 'soft2' : 'soft'"
        class="s-line"
        stroke-width="2"
      />
      <text
        x="22"
        y="38"
        class="t-b t-lg"
      >{{ L[column.title] }}</text>
      <text
        x="22"
        y="62"
        class="t-sm t-mut"
      >{{ L[column.note] }}</text>
      <g
        v-for="(item, index) in column.items"
        :key="item"
        :transform="`translate(22 ${90 + index * 50})`"
      >
        <rect
          x="0"
          y="0"
          width="212"
          height="38"
          rx="19"
          :class="column.strong ? 'acc' : 'paper'"
          :stroke-width="column.strong ? 0 : 2"
          class="s-acc"
        />
        <text
          x="18"
          y="25"
          class="t-sm"
          :class="column.strong ? 't-onacc t-b' : ''"
        >{{ L[item] }}</text>
      </g>
    </g>
  </svg>
</template>
