/* Типы блока «Услуги» объявлены явно, а не через сгенерированный
   SiteCollectionItem из @nuxt/content: в production-сборке (Vercel)
   сгенерированные типы контента могут отставать от схемы (например, описывать
   proof как string[]), поэтому компонент и страница не должны зависеть от их
   актуальности. */

export interface ServiceProofCompany {
  label: string
  slug?: string
}

export interface HomeService {
  id: string
  title: string
  description: string
  proof: ServiceProofCompany[]
}
