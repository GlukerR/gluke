export interface SiteNavigationItem {
  readonly label: string
  readonly to: string
}

export const siteNavigation: readonly SiteNavigationItem[] = [
  { label: 'Проекты', to: '/#projects' },
  { label: 'Услуги', to: '/#services' },
  { label: 'Процесс', to: '/#process' },
  { label: 'О студии', to: '/#about' },
] as const
