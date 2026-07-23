'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ICONS: Record<string, React.ReactNode> = {
  home: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>,
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>,
  fridge: <><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="9" y1="6" x2="9" y2="8"/><line x1="9" y1="14" x2="9" y2="19"/></>,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
  chart: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>,
  globe: <><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20"/><path d="M2 12h20"/></>,
  cart: <><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>,
  gear: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
};

function Icon({ name }: { name: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">{ICONS[name]}</svg>;
}

const MENU = [
  { href: '/', icon: 'home', label: '홈 Dashboard', short: '홈' },
  { href: '/calendar', icon: 'calendar', label: '식단 캘린더', short: '식단' },
  { href: '/allergy', icon: 'star', label: '알러지 테스트', short: '테스트' },
  { href: '/fridge', icon: 'fridge', label: '냉장고 관리', short: '냉장고' },
  { href: '/ingredients', icon: 'shield', label: '먹어본 재료', short: '재료' },
  { href: '/growth', icon: 'chart', label: '성장 기록', short: '성장' },
  { href: '/nutrition', icon: 'globe', label: '영양 분석', short: '영양' },
  { href: '/shopping', icon: 'cart', label: '장보기', short: '장보기' },
  { href: '/settings', icon: 'gear', label: '설정', short: '설정' },
];

const BOTTOM = ['/', '/calendar', '/allergy', '/fridge', '/growth'];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h1>🍼 BabyMeal</h1>
        <p>이나의 이유식 플래너</p>
      </div>
      <nav className="sidebar-nav">
        {MENU.map(m => (
          <Link key={m.href} href={m.href} className={`nav-item ${pathname === m.href ? 'active' : ''}`}>
            <Icon name={m.icon} />
            {m.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav">
      {MENU.filter(m => BOTTOM.includes(m.href)).map(m => (
        <Link key={m.href} href={m.href} className={`bottom-nav-item ${pathname === m.href ? 'active' : ''}`}>
          <Icon name={m.icon} />
          <span>{m.short}</span>
        </Link>
      ))}
    </nav>
  );
}
