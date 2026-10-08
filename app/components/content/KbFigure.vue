<script setup lang="ts">
import type { Component } from 'vue'

/**
 * Схема в статье базы знаний.
 *
 * В markdown статьи пишется блоком MDC:
 *
 *   ::kb-figure{art="photo-angles" alt="Что нарисовано — для скринридера"}
 *   Подпись под схемой.
 *   ::
 *
 * Схема — SFC из `app/components/knowledge/art/` (`photo-angles` →
 * `PhotoAngles.vue`), это SVG прямо в разметке страницы. Цвета в ней — только
 * роли `--kb-*` из `main.css`, поэтому схема перекрашивается вместе с темой
 * сайта и ничего не весит как картинка. Что такая схема существует, проверяет
 * `pnpm validate:content`.
 */
const props = defineProps<{
  art: string
  alt: string
}>()

const ARTS = import.meta.glob<{ default: Component }>('../knowledge/art/*.vue')

function artPath(name: string): string {
  const pascal = name.replace(/(^|-)([a-z0-9])/g, (_, __, char: string) => char.toUpperCase())
  return `../knowledge/art/${pascal}.vue`
}

const art = computed(() => {
  const loader = ARTS[artPath(props.art)]
  return loader ? defineAsyncComponent(loader) : null
})
</script>

<template>
  <figure class="kb-figure">
    <div class="kb-figure__art">
      <component
        :is="art"
        v-if="art"
        :alt="props.alt"
      />
    </div>
    <figcaption
      v-if="$slots.default"
      class="kb-figure__caption text-body--sm"
    >
      <slot mdc-unwrap="p" />
    </figcaption>
  </figure>
</template>

<style>
/* Словарь классов схем: короткие имена, чтобы разметка SVG оставалась
   читаемой. Стили не scoped — схемы лежат в отдельных компонентах, а
   словарь у них общий. Цвет задаётся только через роли `--kb-*`, а они
   выведены из токенов сайта (`main.css`): своих цветов у схем нет. */
.kb-art {
  width: 100%;
  height: auto;
  font-family: inherit;
}

.kb-art * {
  transition: fill 180ms ease, stroke 180ms ease;
}

.kb-art .paper { fill: var(--kb-paper); }
.kb-art .soft { fill: var(--kb-soft); }
.kb-art .soft2 { fill: var(--kb-soft-strong); }
.kb-art .acc { fill: var(--kb-accent); }
.kb-art .acc2 { fill: var(--kb-accent-strong); }
.kb-art .inkf { fill: var(--kb-ink); }
.kb-art .mutf { fill: var(--kb-muted); }
.kb-art .linef { fill: var(--kb-line); }
.kb-art .none { fill: none; }
.kb-art .lit { fill: var(--kb-face-lit); }
.kb-art .mid { fill: var(--kb-face-mid); }
.kb-art .dark { fill: var(--kb-face-dark); }
.kb-art .shadow { fill: var(--kb-shadow); }
.kb-art .glow { fill: var(--kb-glow); }
.kb-art .clay-lit { fill: var(--kb-clay-lit); }
.kb-art .clay-mid { fill: var(--kb-clay-mid); }
.kb-art .clay-dark { fill: var(--kb-clay-dark); }

/* Градиенты: цвет у <stop> задаётся тем же словарём. */
.kb-art .stop-lit { stop-color: var(--kb-face-lit); }
.kb-art .stop-mid { stop-color: var(--kb-face-mid); }
.kb-art .stop-dark { stop-color: var(--kb-face-dark); }
.kb-art .stop-glow { stop-color: var(--kb-glow); }
.kb-art .stop-acc { stop-color: var(--kb-accent); }

.kb-art .s-ink { stroke: var(--kb-ink); }
.kb-art .s-acc { stroke: var(--kb-accent); }
.kb-art .s-mut { stroke: var(--kb-muted); }
.kb-art .s-line { stroke: var(--kb-line); }
.kb-art .s-paper { stroke: var(--kb-paper); }

.kb-art .dash { stroke-dasharray: 6 6; }
.kb-art .round { stroke-linecap: round; stroke-linejoin: round; }

.kb-art text {
  fill: var(--kb-ink);
  font-size: 16px;
  font-weight: 500;
}

.kb-art text.t-mut { fill: var(--kb-muted); }
.kb-art text.t-acc { fill: var(--kb-accent-text); }
.kb-art text.t-paper { fill: var(--kb-paper); }
.kb-art text.t-onacc { fill: var(--kb-on-accent); }
.kb-art text.t-b { font-weight: 700; }
.kb-art text.t-sm { font-size: 14px; }
.kb-art text.t-lg { font-size: 19px; }
</style>

<style scoped>
.kb-figure {
  margin-block: clamp(28px, 3.4vw, 44px);
}

.kb-figure__art {
  max-width: 640px;
  padding: clamp(12px, 2.4vw, 28px);
  border: var(--site-border);
  border-radius: var(--site-radius-md);
  background-color: var(--kb-paper);
  transition: background-color 180ms ease, border-color 180ms ease;
}

.kb-figure__caption {
  max-width: 640px;
  margin-block-start: 12px;
  color: var(--site-text-muted);
}

/* На телефоне схема выходит на всю ширину экрана, без рамки по бокам:
   подписи внутри SVG масштабируются вместе с ним, и каждый пиксель ширины
   делает их крупнее. */
@media (max-width: 600px) {
  .kb-figure__art {
    margin-inline: calc(-1 * var(--site-gutter));
    padding: 10px 8px;
    border-inline: 0;
    border-radius: 0;
  }
}
</style>
