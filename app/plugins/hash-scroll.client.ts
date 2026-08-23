export default defineNuxtPlugin((nuxtApp) => {
  const router = useRouter()
  let observer: MutationObserver | null = null
  let timeoutId: number | null = null

  history.scrollRestoration = 'manual'

  const stopWaiting = () => {
    observer?.disconnect()
    observer = null
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  const scrollToTarget = (target: HTMLElement) => {
    const margin = Number.parseFloat(getComputedStyle(target).scrollMarginTop) || 0
    const top = Math.max(0, target.getBoundingClientRect().top + window.scrollY - margin)
    window.scrollTo({ top, behavior: 'auto' })
  }

  const scrollToHash = async (hash: string) => {
    stopWaiting()
    if (!hash) return

    await nextTick()

    const findTarget = () => document.querySelector<HTMLElement>(hash)
    const target = findTarget()
    if (target) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToTarget(target))
      })
      return
    }

    observer = new MutationObserver(() => {
      const mountedTarget = findTarget()
      if (!mountedTarget) return
      stopWaiting()
      requestAnimationFrame(() => {
        requestAnimationFrame(() => scrollToTarget(mountedTarget))
      })
    })
    observer.observe(document.body, { childList: true, subtree: true })

    timeoutId = window.setTimeout(stopWaiting, 3000)
  }

  router.afterEach((to) => {
    if (to.hash) void scrollToHash(to.hash)
  })

  nuxtApp.hook('app:mounted', () => {
    void scrollToHash(router.currentRoute.value.hash)
  })
})
