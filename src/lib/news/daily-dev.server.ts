import 'server-only';
import { createNewsService } from './service';
// Never export the credential or pass it as a cache key or URL parameter.
export const getNews = createNewsService({ token: () => process.env.DAILY_DEV_TOKEN });
