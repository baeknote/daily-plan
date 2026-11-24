import { z } from 'zod';
// Verified against https://api.daily.dev/public/v1/docs/json on 2026-11-24.
// The schema selects fields; author, explain and user state are never forwarded.
export const feedPostSchema = z.object({
  id: z.string().min(1).max(200), title: z.string().min(1).max(2000), url: z.string().max(4096),
  commentsPermalink: z.string().max(4096).nullish().catch(null),
  summary: z.string().max(12000).nullish().catch(null),
  image: z.string().max(4096).nullish().catch(null),
  publishedAt: z.string().nullish().catch(null),
  readTime: z.number().int().nonnegative().max(1440).nullish().catch(null),
  numUpvotes: z.number().int().nonnegative().nullish().catch(null),
  numComments: z.number().int().nonnegative().nullish().catch(null),
  source: z.object({ name: z.string().max(300) }).nullish().catch(null),
  tags: z.array(z.string().max(100)).max(100).default([]).catch([]),
});
export const feedSchema = z.object({
  data: z.array(z.unknown()).max(50),
  pagination: z.object({ hasNextPage: z.boolean(), cursor: z.string().nullable().optional() }),
});
