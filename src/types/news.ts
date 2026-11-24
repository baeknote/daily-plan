export type Lane = 'breaking' | 'building' | 'deep';
export interface NewsPost {
  id: string; title: string; summary: string | null; sourceName: string;
  originalUrl: string; discussionUrl: string | null; image: string | null;
  publishedAt: string | null; readingTimeMinutes: number | null;
  tags: string[]; upvotes: number | null; comments: number | null;
  lane: Lane; reasons: string[]; signals: string[];
}
export interface NewsResponse {
  posts: NewsPost[]; fetchedAt: string; stale: boolean;
  hasMore: boolean; notice: string | null;
}
