'use client';
import { useEffect, useMemo, useState } from 'react';
import { BookOpen, FlaskConical, Search, RefreshCw, Sparkles, Zap, MessageCircle, ThumbsUp, Clock3, Newspaper } from 'lucide-react';
import type { Lane, NewsPost, NewsResponse } from '../../types/news';
const lanes = [
  { id: 'all', name: '전체', hint: '오늘의 발견', icon: Newspaper },
  { id: 'breaking', name: 'Breaking', hint: '새로 나온 소식', icon: Zap },
  { id: 'building', name: 'Worth Building', hint: '직접 만들어 보기', icon: FlaskConical },
  { id: 'deep', name: 'Deep Read', hint: '차분히 읽기', icon: BookOpen },
] as const;
const dateLabel = (value: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
function NewsCard({ post, featured = false }: { post: NewsPost; featured?: boolean }) {
  const lane = lanes.find(l => l.id === post.lane)!;
  const [imageFailed, setImageFailed] = useState(false);
  return <article className={'news-card ' + (featured ? 'news-featured' : '')}>
    {post.image && !imageFailed ? <img className="news-image" src={post.image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImageFailed(true)}/> : <div className="news-image news-placeholder" aria-hidden="true"><lane.icon size={featured ? 48 : 34}/><span>{lane.name}</span></div>}
    <div className="news-card-body"><div className="news-card-top"><span className={'lane-badge lane-' + post.lane}>{lane.name}</span><span className="news-source">{post.sourceName}</span></div>
      <h3><a href={post.originalUrl} target="_blank" rel="noopener noreferrer">{post.title}</a></h3>
      <p className="news-summary">{post.summary ?? '제공된 요약이 없어요. 원문에서 내용을 확인해 주세요.'}</p>
      <div className="news-tags">{post.tags.slice(0, 4).map(tag => <span key={tag}>#{tag}</span>)}</div>
      <div className="news-meta"><span>{post.publishedAt ? dateLabel(post.publishedAt) : '발행일 미제공'}</span>{post.readingTimeMinutes !== null && <span><Clock3 size={13}/>{post.readingTimeMinutes}분</span>}{post.upvotes !== null && <span><ThumbsUp size={13}/>{post.upvotes.toLocaleString('ko-KR')}</span>}{post.comments !== null && <span><MessageCircle size={13}/>{post.comments.toLocaleString('ko-KR')}</span>}</div>
      <details className="news-reasons"><summary>이 분류에 담긴 이유</summary><ul>{[...post.reasons, ...post.signals].map(reason => <li key={reason}>{reason}</li>)}</ul><p>제목·태그·제공된 요약에 따른 규칙 분류예요. 성능·가격·사용 조건은 원문에서 확인해 주세요.</p></details>
      <div className="news-card-actions"><a className="news-read" href={post.originalUrl} target="_blank" rel="noopener noreferrer">원문 읽기</a>{post.discussionUrl && <a href={post.discussionUrl} target="_blank" rel="noopener noreferrer">daily.dev 토론</a>}</div>
    </div>
  </article>;
}
export default function NewsBoard() {
  const [data, setData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0), [clock, setClock] = useState(Date.now());
  const [lane, setLane] = useState<'all' | Lane>('all'), [query, setQuery] = useState(''), [tag, setTag] = useState('');
  async function load(signal?: AbortSignal) {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/news', { signal, credentials: 'omit' });
      const body = await response.json();
      if (!response.ok) { setRetryAt(Date.now() + (body.error?.retryAfter ?? 60) * 1000); throw new Error(body.error?.message ?? '뉴스를 불러오지 못했어요.'); }
      setData(body); setRetryAt(0);
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setError(e instanceof Error ? e.message : '연결 상태를 확인해 주세요.'); }
    finally { if (!signal?.aborted) setLoading(false); }
  }
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, []);
  useEffect(() => { if (!retryAt) return; const timer = setInterval(() => setClock(Date.now()), 1000); return () => clearInterval(timer); }, [retryAt]);
  const wait = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of data?.posts ?? []) for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a,b) => b[1] - a[1]).slice(0, 8).map(([t]) => t);
  }, [data]);
  const posts = useMemo(() => (data?.posts ?? []).filter(p => (lane === 'all' || p.lane === lane) && (!tag || p.tags.includes(tag)) && (!query.trim() || [p.title, p.summary, p.sourceName, ...p.tags].join(' ').toLowerCase().includes(query.trim().toLowerCase()))), [data, lane, tag, query]);
  const featured = posts[0];
  return <>
    <section className="news-hero"><div><div className="news-eyebrow"><Sparkles size={15}/> A LITTLE CURIOSITY, EVERY DAY</div><h1>오늘의 발견이,<br/><span>내일의 가능성으로.</span></h1><p>지금 읽고, 테스트하고, 만들어 볼 AI 기술.<br/>나의 daily.dev 피드에서 한 걸음 더 골랐어요.</p></div><div className="news-hero-art" aria-hidden="true"><div className="news-orbit"/><FlaskConical size={58}/><span className="news-art-label">작은 실험 하나부터</span><Sparkles className="news-art-spark" size={25}/></div></section>
    <section className="news-toolbar" aria-label="뉴스 필터"><div className="news-lanes" role="group" aria-label="읽기 목적">{lanes.map(item => <button key={item.id} onClick={() => setLane(item.id)} aria-pressed={lane === item.id} className={lane === item.id ? 'active' : ''}><item.icon size={17}/><span>{item.name}<small>{item.hint}</small></span><b>{data?.posts.filter(p => item.id === 'all' || p.lane === item.id).length ?? '–'}</b></button>)}</div>
      <div className="news-search-row"><label className="news-search"><Search size={18}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="모델, API, 관심 있는 기술 찾기" aria-label="뉴스 검색" maxLength={200}/></label><button className="news-refresh" onClick={() => void load()} disabled={loading || wait > 0}><RefreshCw size={16} className={loading ? 'news-spin' : ''}/>{wait > 0 ? wait + '초 후 재시도' : '새로 확인'}</button></div>
      {!!tags.length && <div className="news-tag-filter" role="group" aria-label="태그 필터"><button aria-pressed={!tag} onClick={() => setTag('')}>모든 태그</button>{tags.map(t => <button key={t} aria-pressed={tag === t} onClick={() => setTag(tag === t ? '' : t)}>#{t}</button>)}</div>}
    </section>
    <div className="news-result-heading"><div><h2>{lane === 'all' ? '오늘 살펴볼 이야기' : lanes.find(l => l.id === lane)!.hint}</h2><span>{data ? posts.length + '개의 발견' : '개인화 피드'}</span></div>{data && <p>최근 확인 {dateLabel(data.fetchedAt)} · 서울</p>}</div>
    {error && <div className="news-state news-error" role="alert"><h3>잠깐, 연결을 확인하고 있어요</h3><p>{error}</p>{data && <p>아래는 이전에 받은 뉴스예요. 최신 정보는 원문에서 확인해 주세요.</p>}</div>}
    {data?.notice && <p className={'news-notice ' + (data.stale ? 'is-stale' : '')} role="status">{data.notice}</p>}
    {loading && !data ? <div className="news-grid" role="status" aria-label="뉴스를 불러오는 중">{[1,2,3].map(n => <div className="news-skeleton" key={n}><div/><span/><span/><span/></div>)}</div> : featured ? <><div className="news-pick-label"><FlaskConical size={16}/> 먼저 살펴볼 이야기 <span>실험 가능성·관련성·신선도를 함께 봤어요</span></div><NewsCard post={featured} featured/><div className="news-grid">{posts.slice(1).map(post => <NewsCard key={post.id} post={post}/>)}</div></> : !error && <div className="news-state"><Search size={28}/><h3>{data?.posts.length ? '조건에 맞는 글이 없어요' : '아직 담긴 AI 소식이 없어요'}</h3><p>{data?.posts.length ? '검색어나 태그를 바꿔 다른 발견을 찾아보세요.' : '개인화 피드에 AI 관련 글이 들어오면 여기에 표시돼요.'}</p>{(query || tag || lane !== 'all') && <button onClick={() => { setQuery(''); setTag(''); setLane('all'); }}>필터 초기화</button>}</div>}
    <details className="news-method"><summary>어떻게 고르고 분류하나요?</summary><p>개인화 피드 최근 50개 글의 제목·태그·제공된 요약으로 AI 관련 글을 선별해요. 최근 48시간 이내 발행되고 출시 신호가 있으면 Breaking, 구현할 도구·기법과 사용 단서가 있으면 Worth Building, 나머지는 Deep Read에 담아요. 각 글은 한 분류에만 들어가요.</p><p>원문 전문은 수집하지 않아요. 요약은 daily.dev 제공 내용이며, 분류는 자동 규칙이므로 원문 확인이 필요해요. 확인할 때 캐시가 만료됐다면 새 데이터를 요청하며, 화면을 닫아 두면 수집하지 않아요.</p>{data?.hasMore && <p>개인화 피드의 첫 50개 글만 확인했어요. 전체 AI 뉴스를 빠짐없이 제공하는 서비스는 아니에요.</p>}</details>
  </>;
}
