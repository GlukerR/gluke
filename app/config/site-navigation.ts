/**
 * Навигация описывается маршрутом и ключом перевода, а не готовым путём:
 * публичный URL всегда собирается через `useLocalePath()`, поэтому `/ru`
 * нигде не пишется руками.
 */
export interface SiteNavigationItem {
  readonly labelKey: 'nav.projects' | 'nav.services' | 'nav.process' | 'nav.about'
  readonly route: 'index' | 'projects'
  readonly hash?: string
}

export const siteNavigation: readonly SiteNavigationItem[] = [
  { labelKey: 'nav.projects', route: 'projects' },
  { labelKey: 'nav.services', route: 'index', hash: '#services' },
  { labelKey: 'nav.process', route: 'index', hash: '#process' },
  { labelKey: 'nav.about', route: 'index', hash: '#about' },
] as const
