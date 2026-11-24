import type { NewsResponse } from '../../types/news';
import { feedSchema } from './schema';
import { normalizePost } from './normalize';
import { classifyPost, rankPosts, uniquePosts } from './classify';

export class NewsError extends Error {
  constructor(public code: string, public status: number, public retryAfter = 60) { super(code); }
}
const TTL = 300_000, MAX_STALE = 900_000;
const CONNECTION_ERRORS = new Set(['AUTH_INVALID', 'ACCESS_DENIED', 'TOKEN_FORMAT', 'CONFIG']);
const ENDPOINT = 'https://api.daily.dev/public/v1/feeds/foryou?limit=50';

// One fixed feed, no arbitrary proxy, pagination or cache-busting query inputs.
// CDN provides cross-instance reuse. Memory only reduces warm-instance bursts.
export function createNewsService({ fetcher = fetch, now = Date.now, token }: {
  fetcher?: typeof fetch; now?: () => number; token: () => string | undefined;
}) {
  let saved: { value: NewsResponse; time: number } | undefined;
  let pending: Promise<NewsResponse> | undefined;
  let blockedUntil = 0;
  let lastError: NewsError | undefined;
  const stale = (error: NewsError) => {
    if (saved && now() - saved.time <= MAX_STALE && !CONNECTION_ERRORS.has(error.code)) {
      return { ...saved.value, stale: true, notice: '연결이 원활하지 않아 마지막으로 받은 뉴스를 보여드려요. 갱신 시각을 확인해 주세요.' };
    }
    throw error;
  };
  function readCredential(): string {
    const secret = token()?.trim();
    if (!secret) throw new NewsError('CONFIG', 503);
    // Only the credential belongs in this variable, never a shell assignment or
    // a complete Authorization header. Do not echo the rejected value.
    if (/^Bearer\b|^DAILY_DEV_TOKEN\s*=|[\s"'\\]/i.test(secret)) throw new NewsError('TOKEN_FORMAT', 503, 300);
    return secret;
  }
  async function load(): Promise<NewsResponse> {
    const secret = readCredential();
    let response: Response;
    try {
      response = await fetcher(ENDPOINT, {
        method: 'GET', headers: { Authorization: 'Bearer ' + secret, Accept: 'application/json' },
        redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(8000),
      });
    } catch { throw new NewsError('UNAVAILABLE', 503); }
    if (response.status === 401) throw new NewsError('AUTH_INVALID', 503, 300);
    if (response.status === 403) throw new NewsError('ACCESS_DENIED', 503, 300);
    if (response.status === 429) {
      // RateLimitError.retryAfter is documented in the OpenAPI response body.
      let seconds = Number(response.headers.get('retry-after'));
      try { const body = await response.json(); if (Number.isFinite(body.retryAfter)) seconds = body.retryAfter; } catch {}
      throw new NewsError('RATE_LIMIT', 429, Number.isFinite(seconds) && seconds > 0 ? Math.min(86400, Math.ceil(seconds)) : 300);
    }
    if (!response.ok) throw new NewsError('UNAVAILABLE', 503);
    let raw: unknown;
    try {
      // Bound the upstream payload without fetching publisher articles.
      if (Number(response.headers.get('content-length')) > 2_000_000) throw new Error();
      const reader = response.body?.getReader();
      if (!reader) throw new Error();
      const decoder = new TextDecoder(); let body = '', size = 0;
      try {
        while (true) {
          const item = await reader.read(); if (item.done) break;
          size += item.value.byteLength;
          if (size > 2_000_000) { await reader.cancel(); throw new Error(); }
          body += decoder.decode(item.value, { stream: true });
        }
        body += decoder.decode();
      } finally { reader.releaseLock(); }
      raw = JSON.parse(body);
    } catch { throw new NewsError('INVALID_DATA', 502); }
    const result = feedSchema.safeParse(raw);
    if (!result.success) throw new NewsError('INVALID_DATA', 502);
    const timestamp = now();
    const normalized = result.data.data.map(normalizePost).filter(p => p !== null);
    if (result.data.data.length && !normalized.length) throw new NewsError('INVALID_DATA', 502);
    const posts = rankPosts(uniquePosts(normalized.map(p => classifyPost(p, timestamp)).filter(p => p !== null)), timestamp);
    // Defense in depth: an upstream echo of this credential must never reach clients.
    const value: NewsResponse = { posts, fetchedAt: new Date(timestamp).toISOString(), stale: false,
      hasMore: result.data.pagination.hasNextPage,
      notice: posts.length ? null : '개인화 피드의 최근 50개 글에서 AI 관련 글을 찾지 못했어요. daily.dev 관심 태그를 확인해 보세요.' };
    if (JSON.stringify(value).includes(secret)) throw new NewsError('INVALID_DATA', 502);
    saved = { value, time: timestamp }; lastError = undefined; blockedUntil = 0;
    return value;
  }
  return async function getNews(): Promise<NewsResponse> {
    try { readCredential(); } catch (error) { saved = undefined; throw error; }
    if (blockedUntil > now() && lastError) return stale(lastError);
    if (saved && now() - saved.time < TTL) return saved.value;
    if (!pending) {
      pending = load().catch(error => {
        const safe = error instanceof NewsError ? error : new NewsError('UNAVAILABLE', 503);
        if (CONNECTION_ERRORS.has(safe.code)) saved = undefined;
        lastError = safe; blockedUntil = now() + safe.retryAfter * 1000;
        return stale(safe);
      }).finally(() => { pending = undefined; });
    }
    return pending;
  };
}
