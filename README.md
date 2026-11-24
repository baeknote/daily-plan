# 하루 배터리 + AI 뉴스

Next.js 15 App Router, TypeScript, Tailwind CSS. Deploy to Vercel.

## Local development

Use Node.js 22.11+ (Node 24 LTS recommended).

1. Run npm ci.
2. Copy .env.example to .env.local and set DAILY_DEV_TOKEN locally. Never commit this file.
3. Run npm run dev. Open http://localhost:3000 and select AI ??.
4. Run npm test, npm run typecheck and npm run build before deployment.

The existing planner remains in src/planner.jsx to preserve its IndexedDB and JSON backup contracts. New routes, API, validation, classification and UI are TypeScript. No schedule data is sent to daily.dev.

## Vercel

Import baeknote/daily-plan or use its existing Vercel project to preserve the current domain. vercel.json explicitly sets Next.js, npm ci, npm run build and .next, replacing the previous Vite output. If the existing dashboard overrides these settings, reset those overrides to the repository settings. Use Node 24.x in the project.

Add DAILY_DEV_TOKEN in Project Settings -> Environment Variables, Production only unless a preview needs access. Mark it sensitive. Redeploy after changes. Never add NEXT_PUBLIC_ to this variable. Do not put real credentials in GitHub, build logs, issues or screenshots.

A missing or invalid token produces a clear setup/unavailable state; the application never fabricates live stories. Check /api/news after deployment. Its response must contain posts, fetchedAt, stale, hasMore and notice, with no account information or credentials.

The repository is public. Anyone visiting the news tab receives the SAME selected article metadata from the owner's feed. There is no bookmark access, account data, interest-profile response, or public write API. Vercel access protection is required if this selected reading feed itself must be private.

## Data and classification

Browser -> GET /api/news -> GET https://api.daily.dev/public/v1/feeds/foryou?limit=50.

OpenAPI verified 2026-11-24: https://api.daily.dev/public/v1/docs/json (OpenAPI 3.0.3, API 1.0.0). Operation getFeedsForyou. Params: limit integer 1?50 (default 20), cursor string, explain boolean (default false). For You has no tag parameter. The app intentionally reads only the first 50 posts and filters AI locally on the server. No scheduled or background ingestion.

Mapping: id -> id; title -> title; summary -> summary; source.name -> sourceName; url -> originalUrl; commentsPermalink -> discussionUrl; image -> image; publishedAt -> publishedAt; readTime -> readingTimeMinutes; tags -> tags; numUpvotes -> upvotes; numComments -> comments. createdAt is NOT publication time. Missing summaries, images, dates, read times and engagement become null. Unsafe URLs and unusable posts are omitted. Publisher articles are never fetched or reproduced.

AI relevance uses specific tags and terms. Every included post has exactly one lane, with reasons:
- Breaking: published in the last 48 hours AND title indicates a concrete tool/model/API release, excluding guide/analysis titles.
- Worth Building: a practical artifact plus a usage/implementation signal.
- Deep Read: remaining AI analysis/explanations/reading candidates. Weak evidence is disclosed.

This is a transparent heuristic, not factual verification. Price, access conditions, capabilities and benchmark claims must be checked at the original source. Ranking favors practical work, freshness and metadata completeness; engagement is a small tie-breaker. Duplicate IDs and article URLs (excluding tracking parameters) collapse.

## Security and cache

- Token read only via process.env.DAILY_DEV_TOKEN in a server-only module. Only the fixed daily.dev HTTPS endpoint receives it; redirects are rejected.
- No request headers, raw upstream responses or credentials are logged. Response fields are explicitly selected and credential echoes are rejected.
- 8-second upstream timeout, 2 MB payload limit, response validation, credential/local/unsafe URL rejection. Images only from media.daily.dev, lazy-loaded without referrers. Browser CSP blocks unapproved images and connections.
- Success responses use Vercel-CDN-Cache-Control: public, s-maxage=300. Browser Cache-Control is no-store. The shared CDN contains ONLY selected public news metadata.
- Warm-instance memory caches successes for 5 minutes and coalesces concurrent requests. It is NOT a globally durable cache; separate instances/regions may still call upstream. No database or storage service.
- On outage a warm last success can be returned for up to 15 minutes with stale=true. Stale responses/errors are not put into the CDN. Cold instances cannot recover a stale snapshot. Authentication failures clear warm snapshots. Errors use sanitized codes and per-instance backoff; 429 reads documented retryAfter.
- /api/news accepts no query parameters and no writes, avoiding arbitrary proxying or pagination-based quota abuse. Configure Vercel Firewall rate limits for public traffic; origin/CORS checks alone do not prevent direct requests.
- Free API quota may be insufficient for frequent visitors even with caching. Monitor daily.dev quota and Vercel usage. No promise of a global 1-request-per-5-minute ceiling.
- Service worker excludes /api, /news and RSC requests. Only the planner shell and static assets are available offline. Returning to the planner while offline may require a full page navigation.
- CSP permits inline scripts/styles required by this static Next.js shell; no HTML injection APIs are used. This is not a nonce-based CSP.
- PostCSS is overridden to a patched compatible version; lockfile included. Run npm audit when updating dependencies.

Keep the current origin to preserve IndexedDB daybattery-v1, version 2, stores days/templates/categories. For a domain change, export JSON from the OLD site and restore on the new site. The app does not silently transfer local data between domains.

## Acceptance checks

1. Existing dates, midnight sleep, drag/resize, templates and JSON backup/restore still work.
2. News renders loading, empty, auth, quota and outage states without fake fallback stories.
3. Search/tag/lane filters make no new upstream requests.
4. Inspect the original source for one new useful AI capability and decide whether its cost/access/usage makes it worth testing. Do not treat a heuristic label as verified capability.
5. Inspect browser network/static chunks for credential leaks and verify CDN hits at the deployed canonical URL.

Out of scope: newsletter, RSS, Netlify Blobs, scheduled ingestion, CLI, second AI-summary API and bookmark writes.

## Connection troubleshooting

The value of DAILY_DEV_TOKEN must contain only the token, without Bearer, quotes, a shell assignment, embedded whitespace or a trailing backslash. The server adds the Bearer header. Keep the value out of chats and logs.

The news API exposes only safe diagnostic codes:
- CONFIG: the runtime variable is empty.
- TOKEN_FORMAT: the variable contains obvious copy/paste formatting. No request is sent.
- AUTH_INVALID: daily.dev returned 401; check expiration, revocation or an incorrectly copied token.
- ACCESS_DENIED: daily.dev returned 403; check account/endpoint access and plan limits. Do not assume buying Plus is required without verifying the account.

Set the token for the correct Vercel project/environment, redeploy, and open the newest production deployment. Environment changes do not alter older deployment URLs. After a failed upstream request a warm instance backs off for up to five minutes; a new deployment resets that memory.

Reference: https://docs.daily.dev/public-api/#authentication
