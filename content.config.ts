import {
  defineCollection,
  defineContentConfig,
  z,
} from '@nuxt/content'
import { LOCALE_CODES } from './shared/i18n'

const MEDIA_PREFIX = '/media/'

/* Локаль документа берётся из явного поля, а не из пути файла:
   генерируемый Nuxt Content `path` остаётся внутренним и не используется публично. */
const localeSchema = z.enum(LOCALE_CODES)

const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)

const visualSchema = z.object({
  src: z.string().min(1).startsWith(MEDIA_PREFIX),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().min(1).optional(),
})

const mediaSchema = visualSchema.extend({
  kind: z.enum(['image', 'video', '3d']),
  poster: z.string().min(1).startsWith(MEDIA_PREFIX).optional(),
  /* Фоновые зацикленные анимации: без контролов, autoplay + muted + loop. */
  loop: z.boolean().optional(),
  /* Видео с автозапуском: играет само, звук выключен, контролы видны сразу. */
  autoplay: z.boolean().optional(),
  /* Стартовая секунда: видео начинает играть не с 0:00, а с этой точки,
     чтобы соседние ролики в галерее не стартовали синхронно. */
  startAt: z.number().min(0).optional(),
  /* Явный полноширинный материал (например, финальная картинка галереи). */
  wide: z.boolean().optional(),
  /* Компактный материал для ряда из четырёх (например, видео с тремя картинками рядом). */
  quad: z.boolean().optional(),
  /* Материал для ряда из трёх на всю ширину (квадратные картинки, не резать). */
  triple: z.boolean().optional(),
  /* 3D-вьювер: автоповорот модели (по умолчанию включён в компоненте). */
  autoRotate: z.boolean().optional(),
  /* 3D: программный взрыв-вид по иерархии деталей (для кейсов со сборкой). */
  explode: z.boolean().optional(),
  /* 3D: автопроигрывание запечённой анимации из GLB. */
  playAnimation: z.boolean().optional(),
})

const metricSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
})

const linkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1).regex(/^(https:\/\/|mailto:|tel:|#)/),
})

const contactSchema = z.object({
  channel: z.enum(['telegram', 'email', 'phone']),
  label: z.string().min(1),
  value: z.string().min(1),
  href: z.string().min(1).regex(/^(https:\/\/|mailto:|tel:|#)/),
  primary: z.boolean(),
})

/* Компания из блока «Где применяли»: `slug` добавляется, если по клиенту
   есть кейс на сайте — тогда название становится ссылкой на кейс. */
const proofCompanySchema = z.object({
  label: z.string().min(1),
  slug: z.string().min(1).optional(),
})

const serviceSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  proof: z.array(proofCompanySchema).min(1),
})

const processStepSchema = z.object({
  position: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
})

export default defineContentConfig({
  collections: {
    projects: defineCollection({
      type: 'page',
      source: 'projects/**/*.md',
      schema: z.object({
        locale: localeSchema,
        slug: slugSchema,
        client: z.string().min(1),
        industry: z.string().min(1),
        /* Профили, к которым относится кейс (массив — кейс может быть в двух сразу). */
        categories: z.array(z.enum(['orgtech', 'industrial', 'furniture', 'gameready'])).optional(),
        position: z.number().int().positive(),
        featured: z.boolean(),
        status: z.enum(['draft', 'review', 'published']),
        period: z.string().min(1),
        engagement: z.enum(['active', 'completed']),
        year: z.number().int().min(2000).max(2100).optional(),
        duration: z.string().min(1).optional(),
        clientUrl: z.string().url().optional(),
        services: z.array(z.string().min(1)).min(1),
        deliverables: z.array(z.string().min(1)).optional(),
        about: z.string().min(1).optional(),
        cover: visualSchema,
        /* 3D-модель вместо обложки в hero кейса; постером вьювера служит сама обложка.
           Визуальные параметры вьювера — каждая модель может переопределять
           дефолты компонента (в скобках — значения по умолчанию). */
        model: visualSchema.extend({
          autoRotate: z.boolean().optional(),
          /* Максимальная интенсивность пульсации свечения (эмишн) (5). */
          emissivePulse: z.number().min(0).max(20).optional(),
          /* Частота пульсации свечения, Гц (0.7). */
          emissivePulseHz: z.number().min(0).max(5).optional(),
          /* Множитель металличности: 1 = как в GLB, меньше = менее «зеркально» (0.88). */
          metalness: z.number().min(0).max(1).optional(),
          /* Подъём «чёрного» диффузной текстуры: тёмные участки становятся
             тёмно-серыми, светлые почти не меняются (30). */
          diffuseLift: z.number().min(0).max(120).optional(),
          /* Разворот модели вокруг Y в градусах: каждая GLB может быть
             экспортирована своей стороной к камере (0). */
          rotation: z.number().min(-360).max(360).optional(),
          /* Скорость автоповорота OrbitControls (1.2). */
          autoRotateSpeed: z.number().min(0).max(10).optional(),
          /* Интенсивность студийного окружения RoomEnvironment (0.5). */
          environmentIntensity: z.number().min(0).max(2).optional(),
          /* Ступор зума OrbitControls в долях от кадрирующей дистанции:
             zoomMin — как близко можно приблизить (0.9), zoomMax — как далеко
             отъехать (1.4). */
          zoomMin: z.number().min(0.1).max(5).optional(),
          zoomMax: z.number().min(0.1).max(5).optional(),
          /* Интенсивности источников света: полусфера (0.5), ключевой (0.8),
             мягкая подсветка (0.4). */
          hemisphereLight: z.number().min(0).max(3).optional(),
          keyLight: z.number().min(0).max(3).optional(),
          fillLight: z.number().min(0).max(3).optional(),
        }).optional(),
        media: z.array(mediaSchema),
        metrics: z.array(metricSchema).min(1),
      }),
    }),
    site: defineCollection({
      type: 'data',
      source: 'site/*.yml',
      schema: z.object({
        locale: localeSchema,
        brand: z.object({
          name: z.string().min(1),
          descriptor: z.string().min(1),
          founder: z.string().min(1),
        }),
        hero: z.object({
          eyebrow: z.string().min(1),
          title: z.string().min(1),
          description: z.string().min(1),
          primaryCta: linkSchema,
        }),
        about: z.object({
          title: z.string().min(1),
          description: z.string().min(1),
          team: z.string().min(1),
        }),
        contacts: z.array(contactSchema).min(1),
        pricing: z.object({
          summary: z.string().min(1),
          note: z.string().min(1),
        }),
        /* У статистики главной может быть ссылка в подписи (например, «Kwork»). */
        stats: z.array(metricSchema.extend({ link: linkSchema.optional() })).min(1),
        services: z.array(serviceSchema).min(1),
        process: z.array(processStepSchema).min(1),
        audiences: z.array(z.string().min(1)).min(1),
        proofLinks: z.array(linkSchema).min(1),
      }),
    }),
  },
})
