import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePost, safeUrl } from '../src/lib/news/normalize';
import { classifyPost, uniquePosts } from '../src/lib/news/classify';
import { createNewsService } from '../src/lib/news/service';
const now = Date.parse('2026-11-24T03:00:00Z');
const raw = (overrides: Record<string, unknown> = {}) => ({
  id: 'sample', title: 'OpenAI releases a new model API', url: 'https://openai.com/index/new-model/',
  commentsPermalink: 'https://app.daily.dev/posts/sample', summary: 'An API SDK for building an AI agent.',
  source: { name: 'OpenAI' }, publishedAt: '2026-11-24T01:00:00Z', createdAt: '2026-11-24T02:00:00Z',
  tags: ['ai', 'api'], numUpvotes: 12, numComments: 0, readTime: 4, ...overrides,
});
const post = (overrides: Record<string, unknown> = {}) => normalizePost(raw(overrides))!;
const feed = (rows: unknown[] = [raw()]) => Response.json({ data: rows, pagination: { hasNextPage: true, cursor: 'private-cursor' } });
const credential = 'test-only-credential';

test('normalization only returns UI fields and preserves null rather than inventing metadata', () => {
  const p = post({ summary: null, image: null, publishedAt: null, readTime: null, numUpvotes: undefined, numComments: null, author: { email: 'private' }, explain: { score: 99 }, content: 'full article' });
  for (const key of ['summary','image','publishedAt','readingTimeMinutes','upvotes','comments'] as const) assert.equal(p[key], null);
  for (const key of ['author','explain','content','createdAt']) assert.ok(!(key in p));
  assert.equal(p.discussionUrl, 'https://app.daily.dev/posts/sample');
});
test('unsafe, credential-bearing and local URLs are rejected; images are allowlisted', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,bad', 'https://u:p@example.com/', 'http://127.0.0.1', 'http://[::1]', 'https://localhost/', 'https://foo.internal', 'https://example.com/dda_sensitive']) assert.equal(safeUrl(url), null);
  assert.equal(normalizePost(raw({url:'javascript:alert(1)'})), null);
  assert.equal(post({image:'https://tracker.example.com/pixel'}).image, null);
  assert.equal(post({image:'https://media.daily.dev/a.jpg'}).image, 'https://media.daily.dev/a.jpg');
});
test('markup and accidental credential-shaped strings are not forwarded', () => {
  const p = post({title:'<b>AI model</b>', summary:'dda_testsecret <script>alert(1)</script>'});
  assert.equal(p.title, 'AI model'); assert.ok(!p.summary!.includes('dda_')); assert.ok(!p.summary!.includes('<script>'));
});
test('a genuine recent release is Breaking', () => assert.equal(classifyPost(post(), now)?.lane, 'breaking'));
test('recent feed registration does not make an old release Breaking', () => assert.equal(classifyPost(post({publishedAt:'2025-01-01T00:00:00Z'}), now)?.lane, 'building'));
test('missing or future publication date cannot be Breaking', () => {
  for (const publishedAt of [null, 'invalid', '2027-01-01T00:00:00Z']) assert.notEqual(classifyPost(post({publishedAt}), now)?.lane, 'breaking');
});
test('implementation guides go to Worth Building, analysis to Deep Read, unrelated news is omitted', () => {
  assert.equal(classifyPost(post({title:'How to build an AI agent with the model API'}),now)?.lane,'building');
  assert.equal(classifyPost(post({title:'Understanding artificial intelligence',summary:'An analysis of its social impact.',tags:['ai']}),now)?.lane,'deep');
  assert.equal(classifyPost(post({title:'A new CSS layout',summary:'Flexbox tutorial',tags:['css']}),now),null);
});
test('duplicates with tracking parameters collapse to one card', () => {
  const a=classifyPost(post(),now)!,b=classifyPost(post({id:'other',url:'https://openai.com/index/new-model/?utm_source=test#part'}),now)!;
  assert.equal(uniquePosts([a,b]).length,1);
});
test('single-flight and five minute cache keep repeated reads off the upstream', async () => {
  let calls=0,time=now;
  const get=createNewsService({token:()=>credential,now:()=>time,fetcher:async(input,init)=>{
    calls++; assert.equal(input,'https://api.daily.dev/public/v1/feeds/foryou?limit=50');
    assert.equal(init?.redirect,'error');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+credential);
    await new Promise(r=>setTimeout(r,10));return feed();
  }});
  const results=await Promise.all([get(),get(),get()]);await get();assert.equal(calls,1);
  assert.equal(results[0].posts.length,1);assert.ok(!JSON.stringify(results).includes(credential));assert.ok(!JSON.stringify(results).includes('private-cursor'));
  time+=300001;await get();assert.equal(calls,2);
});
test('missing token never makes an upstream request', async () => {
  let calls=0;const get=createNewsService({token:()=>undefined,fetcher:async()=>{calls++;return feed();}});
  await assert.rejects(get(),{code:'CONFIG',status:503});assert.equal(calls,0);
});
test('authentication failures are sanitized and back off', async () => {
  for(const status of [401,403]){
    let calls=0;const get=createNewsService({token:()=>credential,now:()=>now,fetcher:async()=>{calls++;return new Response('private upstream '+credential,{status});}});
    for(let i=0;i<2;i++)await assert.rejects(get(),{code:'AUTH',status:503});assert.equal(calls,1);
  }
});
test('rate limiting uses documented retryAfter without exposing raw errors', async () => {
  let calls=0;const get=createNewsService({token:()=>credential,now:()=>now,fetcher:async()=>{calls++;return Response.json({retryAfter:120,message:credential},{status:429});}});
  for(let i=0;i<2;i++)await assert.rejects(get(),{code:'RATE_LIMIT',status:429,retryAfter:120});assert.equal(calls,1);
});
test('failed responses do not become successful empty feeds', async () => {
  for(const response of [Response.json({wrong:[]}),feed([{bad:true}]),new Response('down',{status:500})]){
    const get=createNewsService({token:()=>credential,fetcher:async()=>response});await assert.rejects(get());
  }
});
test('empty upstream feed is valid, and missing AI matches are explicitly empty', async () => {
  const get=createNewsService({token:()=>credential,fetcher:async()=>feed([])});assert.equal((await get()).posts.length,0);
});
test('last success is marked stale on outage and expires after fifteen minutes', async () => {
  let time=now,calls=0;const get=createNewsService({token:()=>credential,now:()=>time,fetcher:async()=>{calls++;return calls===1?feed():new Response('down',{status:500});}});
  await get();time+=300001;assert.equal((await get()).stale,true);time=now+900001;await assert.rejects(get(),{code:'UNAVAILABLE'});
});
test('an upstream credential echo is rejected even outside credential-shaped strings', async () => {
  const get=createNewsService({token:()=>credential,fetcher:async()=>feed([raw({summary:credential})])});await assert.rejects(get(),{code:'INVALID_DATA'});
});

test('Korean publication signals and publisher text stay intact', () => {
  const p = post({title:'새 AI 모델 API 출시',summary:'에이전트를 구현할 수 있는 SDK입니다.',source:{name:'기술 소식'}});
  assert.equal(p.title,'새 AI 모델 API 출시');assert.equal(p.sourceName,'기술 소식');assert.equal(classifyPost(p,now)?.lane,'breaking');
});
