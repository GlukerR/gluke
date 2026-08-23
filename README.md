# GLUKE

Commercial portfolio website of the 3D product visualization studio GLUKE.

## Stack

- Nuxt 4 (`app/` directory structure)
- Vue 3 Composition API, TypeScript (strict, `typeCheck` enabled)
- Nuxt UI 4 (includes Tailwind CSS)
- `@nuxt/image`, `@nuxt/content`, `@nuxt/fonts`
- ESLint (flat config) with ESLint Stylistic

## Requirements

- Node.js >= 22 (see `.nvmrc`)
- pnpm

## Setup

```bash
pnpm install
```

## Content

Project cases live in `content/projects/{ru,en}/`. To add a new case, follow
[CASE_TEMPLATE.md](./CASE_TEMPLATE.md) — it describes the frontmatter fields,
media preparation rules and the publish checklist.

## Commands

```bash
pnpm dev        # development server on http://localhost:3000
pnpm build      # production build
pnpm generate   # static generation
pnpm preview    # preview production build
pnpm lint       # ESLint check
pnpm lint:fix   # ESLint autofix
pnpm typecheck  # TypeScript check
pnpm check      # lint + typecheck + build
```
