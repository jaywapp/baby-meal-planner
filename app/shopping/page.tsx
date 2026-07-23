'use client';

import { useEffect, useState } from 'react';
import { api, ymd } from '@/components/ui';
import type { MealPlan, FridgeItem } from '@/lib/types';

export default function ShoppingPage() {
  const [needed, setNeeded] = useState<{ name: string; detail: string; inStock: boolean }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const start = new Date();
    const end = new Date(start.getTime() + 3 * 86400000);
    Promise.all([
      api<MealPlan[]>(`/api/meals?start=${ymd(start)}&end=${ymd(end)}`),
      api<FridgeItem[]>('/api/fridge'),
    ]).then(([meals, fridge]) => {
      const stock = new Map<string, number>();
      for (const f of fridge) stock.set(f.ingredient, (stock.get(f.ingredient) ?? 0) + f.count);

      const uses = new Map<string, Set<string>>();
      for (const m of meals) {
        for (const i of m.ingredients) {
          if (!uses.has(i.name)) uses.set(i.name, new Set());
          uses.get(i.name)!.add(`${m.date.slice(5).replace('-', '/')} ${m.slot === 'morning' ? '오전' : '저녁'}${i.amount ? ` ${i.amount}` : ''}`);
        }
      }
      const list = [...uses.entries()].map(([name, slots]) => ({
        name,
        detail: `${slots.size}끼 사용 예정`,
        inStock: (stock.get(name) ?? 0) >= slots.size,
      }));
      list.sort((a, b) => Number(a.inStock) - Number(b.inStock));
      setNeeded(list);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>장보기 🛒</h2>
        <p>앞으로 3일 식단 기준 필요 재료 (재고 대비 자동 계산)</p>
      </div>
      <div className="card">
        <div className="card-title">다음 죽 제작 시 필요한 재료</div>
        {needed.length === 0 && <div className="empty-state"><p>예정된 식단이 없어요</p></div>}
        <div className="fridge-items">
          {needed.map(n => (
            <div className="fridge-item" key={n.name}>
              <span className="fridge-item-name">{n.inStock ? '✅' : '🛒'} {n.name}</span>
              <span className={`fridge-item-count ${n.inStock ? '' : 'low'}`}>
                {n.detail}{n.inStock ? ' · 재고 있음' : ' · 재고 부족'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
