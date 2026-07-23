'use client';

import { useEffect, useState } from 'react';
import { api, ymd } from '@/components/ui';
import type { MealPlan } from '@/lib/types';

export default function NutritionPage() {
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const end = new Date();
    const start = new Date(end.getTime() - 6 * 86400000);
    api<MealPlan[]>(`/api/meals?start=${ymd(start)}&end=${ymd(end)}`)
      .then(setMeals)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  const all = meals.flatMap(m => m.ingredients);
  const counts = {
    grain: all.filter(i => i.type === 'grain').length,
    protein: all.filter(i => i.type === 'protein').length,
    veggie: new Set(all.filter(i => i.type === 'veggie').map(i => i.name)).size,
    slots: meals.length,
  };
  const pct = (v: number, target: number) => Math.min(100, Math.round((v / target) * 100));
  const bars = [
    { label: '탄수화물 (곡류 포함 끼니)', pct: pct(counts.grain, counts.slots || 1), color: 'var(--accent-mint)' },
    { label: '단백질 (단백질 포함 끼니)', pct: pct(counts.protein, Math.ceil((counts.slots || 1) / 2)), color: 'var(--accent-peach)' },
    { label: '채소 다양성 (주간 종류 수)', pct: pct(counts.veggie, 8), color: 'var(--accent-lavender)' },
    { label: '기록된 끼니 수', pct: pct(counts.slots, 14), color: 'var(--accent-green)' },
  ];
  const score = Math.round(bars.reduce((s, b) => s + b.pct, 0) / bars.length);

  return (
    <div>
      <div className="page-header">
        <h2>영양 분석 🥗</h2>
        <p>최근 7일 식단 기준 자동 계산</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="nutrition-score">
          <div className="nutrition-score-value">{score}</div>
          <div className="nutrition-score-label">이번 주 영양 점수</div>
        </div>
        <div className="nutrition-bars">
          {bars.map(b => (
            <div key={b.label}>
              <div className="nutrition-bar-label"><span>{b.label}</span><span style={{ color: b.color }}>{b.pct}%</span></div>
              <div className="nutrition-bar-track"><div className="nutrition-bar-fill" style={{ width: `${b.pct}%`, background: b.color }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
