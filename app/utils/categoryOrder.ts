/* Порядок кейсов внутри профиля (страница /projects?category=…).

   `position` нумерует архив целиком: он ведёт сетку всех кейсов, главную и
   sitemap, и по нему же кейс-новинка уезжает в конец. Для подборки профиля
   этого мало: «Интерактив и WebGL» собирается из кейсов с разными `position`
   и из кросс-листингов (Getic и SoftLogic лежат ещё и в «Оргтехнике»),
   поэтому нужный порядок подборки задаётся явно — полем `categoryOrder`.

   Правило сортировки, от сильного к слабому:

   1. `categoryOrder[category]` — кейсы с явным порядком идут первыми, по
      возрастанию; кейс без него не может встать выше кейса с ним;
   2. профиль, для которого кейс основной: `categories` упорядочен, и первый
      профиль в списке сильнее кросс-листинга — иначе Getic и SoftLogic
      обгоняли бы по общей нумерации кейсы, ради которых профиль и заведён;
   3. `position` — внутри равных ступеней.

   Модуль отдельный, потому что порядок должен проверяться тестом, а не
   глазами: правило здесь, а не в разметке страницы. */

export const PROJECT_CATEGORIES = [
  'orgtech',
  'industrial',
  'furniture',
  'exteriors',
  'cinematics',
  'gameready',
  'webgl',
] as const

export type ProjectCategory = (typeof PROJECT_CATEGORIES)[number]

/* Минимум полей, которых требует правило: сама страница приносит полный
   `ProjectsCollectionItem`, тесты — только эти поля. */
export interface CategoryOrderedProject {
  categories?: readonly string[] | null
  position: number
  categoryOrder?: Record<string, number> | null
}

/** Сравнение двух кейсов внутри одного профиля. */
export function compareWithinCategory(
  a: CategoryOrderedProject,
  b: CategoryOrderedProject,
  category: ProjectCategory,
): number {
  const explicitA = a.categoryOrder?.[category]
  const explicitB = b.categoryOrder?.[category]

  if (explicitA !== undefined || explicitB !== undefined) {
    /* Явный порядок сильнее всего: кейс без него стоит ниже любого с ним. */
    if (explicitA === undefined) return 1
    if (explicitB === undefined) return -1
    if (explicitA !== explicitB) return explicitA - explicitB
  }

  const rank = (project: CategoryOrderedProject) => project.categories?.indexOf(category) ?? 0
  return rank(a) - rank(b) || a.position - b.position
}

/** Кейсы профиля в порядке показа. */
export function orderCategoryProjects<T extends CategoryOrderedProject>(
  projects: readonly T[],
  category: ProjectCategory,
): T[] {
  return projects
    .filter(project => project.categories?.includes(category))
    .sort((a, b) => compareWithinCategory(a, b, category))
}
