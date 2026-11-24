import { isIP } from 'node:net';
import type { NewsPost } from '../../types/news';
import { feedPostSchema } from './schema';
function text(value: string, max: number): string {
  return value.replace(/dda_[A-Za-z0-9_-]+/g, '[비공개]').replace(/<[^>]*>/g, '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
export function safeUrl(value: unknown, image = false): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (isIP(host) || !host.includes('.') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host)) return null;
    if (image && (url.protocol !== 'https:' || host !== 'media.daily.dev')) return null;
    if (/dda_/i.test(url.href)) return null;
    return url.href;
  } catch { return null; }
}
export function normalizePost(value: unknown): Omit<NewsPost, 'lane' | 'reasons' | 'signals'> | null {
  const parsed = feedPostSchema.safeParse(value);
  if (!parsed.success) return null;
  const raw = parsed.data, originalUrl = safeUrl(raw.url), title = text(raw.title, 500);
  if (!originalUrl || !title || /dda_/i.test(raw.id)) return null;
  const discussion = safeUrl(raw.commentsPermalink);
  const discussionUrl = discussion && ['app.daily.dev', 'daily.dev'].includes(new URL(discussion).hostname) ? discussion : null;
  const date = raw.publishedAt ? Date.parse(raw.publishedAt) : NaN;
  return {
    id: raw.id, title, originalUrl, discussionUrl,
    summary: raw.summary ? text(raw.summary, 1400) || null : null,
    sourceName: raw.source?.name ? text(raw.source.name, 120) : '출처 미상',
    image: safeUrl(raw.image, true), publishedAt: Number.isFinite(date) ? new Date(date).toISOString() : null,
    readingTimeMinutes: raw.readTime ?? null, tags: [...new Set(raw.tags.map(t => text(t, 60)).filter(Boolean))].slice(0, 20),
    upvotes: raw.numUpvotes ?? null, comments: raw.numComments ?? null,
  };
}
