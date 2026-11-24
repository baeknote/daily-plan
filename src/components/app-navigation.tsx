import Link from 'next/link';
export default function AppNavigation({ active }: { active: 'planner' | 'news' }) {
  return <nav className="app-tabs" aria-label="주 메뉴">
    <Link href="/" prefetch={false} aria-current={active === 'planner' ? 'page' : undefined}>내 일정</Link>
    <Link href="/news" prefetch={false} aria-current={active === 'news' ? 'page' : undefined}>AI 뉴스</Link>
  </nav>;
}
