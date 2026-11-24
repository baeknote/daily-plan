import { getNews } from '../../../lib/news/daily-dev.server';
import { NewsError } from '../../../lib/news/service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
const messages: Record<string, string> = {
  CONFIG: '뉴스 연결을 준비 중이에요. 관리자가 서버 연결 설정을 완료하면 이용할 수 있어요.',
  TOKEN_FORMAT: '뉴스 연결 토큰의 저장 형식을 확인해야 해요. 관리자의 설정 변경이 필요해요.',
  AUTH_INVALID: 'daily.dev에서 인증을 거부했어요. 관리자가 연결 토큰의 유효기간과 등록 값을 확인해야 해요.',
  ACCESS_DENIED: 'daily.dev 피드 접근이 거부됐어요. 관리자가 계정의 API 접근 권한과 이용 제한을 확인해야 해요.',
  RATE_LIMIT: '뉴스 요청 한도에 도달했어요. 잠시 후 다시 확인해 주세요.',
  INVALID_DATA: '뉴스 제공처의 응답을 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
  UNAVAILABLE: '지금은 뉴스를 불러올 수 없어요. 잠시 후 다시 시도해 주세요.',
};
export async function GET(request: Request) {
  // A single canonical cache key prevents arbitrary cursors and refresh abuse.
  if (new URL(request.url).search) return Response.json({ error: { code: 'BAD_REQUEST', message: '지원하지 않는 요청이에요.' } }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  try {
    const data = await getNews();
    return Response.json(data, { headers: {
      'Cache-Control': 'no-store',
      // Public by design: only curated article metadata, never account data.
      'Vercel-CDN-Cache-Control': data.stale ? 'no-store' : 'public, s-maxage=300',
      'X-Content-Type-Options': 'nosniff',
    } });
  } catch (error) {
    const safe = error instanceof NewsError ? error : new NewsError('UNAVAILABLE', 503);
    return Response.json({ error: { code: safe.code, message: messages[safe.code] ?? messages.UNAVAILABLE, retryAfter: safe.retryAfter } }, {
      status: safe.status, headers: { 'Cache-Control': 'no-store', 'Vercel-CDN-Cache-Control': 'no-store', 'Retry-After': String(safe.retryAfter) },
    });
  }
}
