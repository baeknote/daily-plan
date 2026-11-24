import type { NewsPost } from '../../types/news';
type BasePost = Omit<NewsPost, 'lane' | 'reasons' | 'signals'>;
const AI_TAGS = new Set(['ai', 'artificial-intelligence', 'machine-learning', 'ml', 'llm', 'llms', 'generative-ai', 'deep-learning', 'rag', 'ai-agents', 'mcp', 'openai', 'anthropic', 'huggingface', 'ollama', 'claude', 'gemini']);
const AI_TEXT = /\b(llms?|generative ai|artificial intelligence|machine learning|neural networks?|embeddings?|retrieval.augmented|fine.tun(?:e|ing)|openai|anthropic|hugging face|ollama|gpt[- ]?\d|claude|gemini|mcp|ai (?:agent|model|tool|api|sdk|coding|inference)|agentic)\b|생성형\s*AI|인공지능|언어\s*모델/i;
const ARTIFACT = /\b(api|sdk|library|framework|cli|model|agent|mcp|embedding|inference|rag|fine.tun\w*|eval\w*)\b|라이브러리|모델|추론|에이전트/i;
const ACTION = /\b(build|building|implement\w*|integrat\w*|deploy\w*|tutorial|how.to|quickstart|open.source|code|github|quick.start|examples?|documentation|benchmark|releas\w*|launch\w*)\b|구현|튜토리얼|실습|배포|출시|공개/i;
const RELEASE = /\b(releas(?:e|es|ed|ing)|launch(?:es|ed|ing)?|introduc(?:e|es|ed|ing)|announc(?:e|es|ed|ing)|now available|roll(?:s|ed|ing)? out)\b|출시|정식\s*공개|발표/i;
const ANALYSIS = /\b(tutorial|how.to|guide|explained|deep.dive|understanding|lessons|analysis|opinion|comparison)\b|분석|해설|가이드|튜토리얼/i;
export function classifyPost(post: BasePost, now = Date.now()): NewsPost | null {
  const tag = post.tags.map(t => t.toLowerCase()).find(t => AI_TAGS.has(t));
  const content = `${post.title} ${post.summary ?? ''}`;
  if (!tag && !AI_TEXT.test(content)) return null;
  const age = post.publishedAt ? now - Date.parse(post.publishedAt) : NaN;
  const recent = Number.isFinite(age) && age >= 0 && age <= 48 * 3600000;
  const practical = ARTIFACT.test(content) && ACTION.test(content);
  const signals = [tag ? `AI 태그: ${tag}` : '제목·요약의 구체적인 AI 용어', ...(practical ? ['API·도구·모델과 구현·사용 신호'] : [])];
  if (recent && RELEASE.test(post.title) && ARTIFACT.test(content) && !ANALYSIS.test(post.title)) {
    return { ...post, lane: 'breaking', signals, reasons: ['발행 후 48시간 이내', '제목에 구체적인 출시·발표 신호'] };
  }
  if (practical) return { ...post, lane: 'building', signals, reasons: ['API·도구·모델 관련 내용', '구현·사용·실험으로 이어질 단서'] };
  return { ...post, lane: 'deep', signals, reasons: [ANALYSIS.test(content) ? '분석·설명·학습 중심의 내용' : 'AI 관련 읽을거리 · 실험 가능성은 원문 확인 필요', ...(!post.publishedAt ? ['발행일 미제공 · 속보에서 제외'] : [])] };
}
export function rankPosts(posts: NewsPost[], now = Date.now()): NewsPost[] {
  const score = (p: NewsPost) => {
    const age = p.publishedAt ? (now - Date.parse(p.publishedAt)) / 3600000 : Infinity;
    return (p.lane === 'building' ? 6 : p.lane === 'breaking' ? 5 : 1) + (age >= 0 && age < 72 ? 2 : 0) + (p.summary ? 1 : 0) + Math.min(1, Math.log10(1 + (p.upvotes ?? 0)) / 3);
  };
  return [...posts].sort((a, b) => score(b) - score(a) || a.id.localeCompare(b.id));
}
export function uniquePosts(posts: NewsPost[]): NewsPost[] {
  const ids = new Set<string>(), urls = new Set<string>();
  return posts.filter(post => {
    const url = new URL(post.originalUrl); url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^utm_|^(fbclid|gclid|ref)$/i.test(key)) url.searchParams.delete(key);
    const key = url.href.replace(/\/$/, '');
    if (ids.has(post.id) || urls.has(key)) return false;
    ids.add(post.id); urls.add(key); return true;
  });
}
