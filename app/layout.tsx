import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Sidebar, BottomNav } from '@/components/Nav';

export const metadata: Metadata = {
  title: 'BabyMeal Planner 🍼',
  description: '이나의 이유식 플래너',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1a1a2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="app-container">
          <Sidebar />
          <main className="main-content">{children}</main>
          <BottomNav />
        </div>
      </body>
    </html>
  );
}
