import type { Metadata, Viewport } from 'next';
import ServiceWorker from '../components/service-worker';
import './globals.css';
import '../style.css';
export const metadata: Metadata = {
  title: { default: '하루 배터리', template: '%s · 하루 배터리' },
  description: '나의 하루를 계획하고, 오늘 읽고 만들어 볼 AI 기술을 발견하세요.',
  manifest: '/manifest.webmanifest', icons: { icon: '/icon.svg' },
};
export const viewport: Viewport = { themeColor: '#f7f8f5' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ko"><body>{children}<ServiceWorker /></body></html>;
}
