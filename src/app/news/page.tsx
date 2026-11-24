import type { Metadata } from 'next';
import Link from 'next/link';
import { BatteryCharging } from 'lucide-react';
import AppNavigation from '../../components/app-navigation';
import NewsBoard from '../../components/news/news-board';
import './news.css';
export const metadata: Metadata = { title: 'AI 뉴스' };
export default function NewsPage() {
  return <div className="app-shell news-shell">
    <header className="topbar"><Link className="brand" href="/"><span className="brand-mark"><BatteryCharging size={19}/></span><span>하루 배터리</span></Link><AppNavigation active="news"/><span className="news-header-note">발견하고, 작게 시작해요</span></header>
    <main className="news-main"><NewsBoard/></main>
    <footer className="news-footer">뉴스 메타데이터 제공: daily.dev · 기사 저작권은 각 출처에 있어요.<br/>내 일정은 이 브라우저에만 저장되며 뉴스 제공처로 전송되지 않아요.</footer>
  </div>;
}
