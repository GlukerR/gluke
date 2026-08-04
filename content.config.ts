import {
  defineCollection,
  defineContentConfig,
  z,
} from '@nuxt/content'

const MEDIA_PREFIX = '/media/'

const visualSchema = z.object({
  src: z.string().min(1).startsWith(MEDIA_PREFIX),
  alt: z.string().min(1),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  caption: z.string().min(1).optional(),
})

const mediaSchema = visualSchema.extend({
  kind: z.enum(['image', 'video']),
  poster: z.string().min(1).startsWith(MEDIA_PREFIX).optional(),
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

const serviceSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  title: z.string().min(1),
  description: z.string().min(1),
  proof: z.string().min(1),
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
      source: 'projects/*.md',
      schema: z.object({
        client: z.string().min(1),
        industry: z.string().min(1),
        position: z.number().int().positive(),
        featured: z.boolean(),
        status: z.enum(['draft', 'review', 'published']),
        period: z.string().min(1),
        engagement: z.enum(['active', 'completed']),
        year: z.number().int().min(2000).max(2100).optional(),
        duration: z.string().min(1).optional(),
        clientUrl: z.string().url().optional(),
        services: z.array(z.string().min(1)).min(1),
        deliverables: z.array(z.string().min(1)).min(1),
        cover: visualSchema,
        media: z.array(mediaSchema),
        metrics: z.array(metricSchema).min(1),
      }),
    }),
    site: defineCollection({
      type: 'data',
      source: 'site.yml',
      schema: z.object({
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
          secondaryCta: linkSchema,
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
        stats: z.array(metricSchema).min(1),
        services: z.array(serviceSchema).min(1),
        process: z.array(processStepSchema).min(1),
        audiences: z.array(z.string().min(1)).min(1),
        proofLinks: z.array(linkSchema).min(1),
      }),
    }),
  },
})
