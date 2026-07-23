'use client';

import { useEffect, useState } from 'react';
import { api, Chip, ymd, DAY_NAMES } from '@/components/ui';
import type { Baby, GrowthRecord, FridgeItem, AllergyTest, MealPlan } from '@/lib/types';

export default function Dashboard() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [growth, setGrowth] = useState<GrowthRecord[]>([]);
  const [fridge, setFridge] = useState<FridgeItem[]>([]);
  const [tests, setTests] = useState<AllergyTest[]>([]);
  const [meals, setMeals] = useState<MealPlan[]>([]);
  const [error, setError] = useState<string | null>(null);

  const today = new Date();
  const todayYmd = ymd(today);

  useEffect(() => {
    const t = ymd(new Date());
    Promise.all([
      api<Baby>('/api/baby'),
      api<GrowthRecord[]>('/api/growth'),
      api<FridgeItem[]>('/api/fridge'),
      api<AllergyTest[]>('/api/allergy'),
      api<MealPlan[]>(`/api/meals?start=${t}&end=${t}`),
    ])
      .then(([b, g, f, a, m]) => { setBaby(b); setGrowth(g); setFridge(f); setTests(a); setMeals(m); })
      .catch(e => setError(String(e)));
  }, []);

  if (error) return <div className="empty-state"><div className="empty-icon">⚠️</div><p>데이터를 불러오지 못했어요: {error}</p></div>;
  if (!baby) return <div className="loading">불러오는 중...</div>;

  const months = (() => {
    const b = new Date(baby.birth_date);
    let m = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
    if (today.getDate() < b.getDate()) m--;
    return m;
  })();
  const daysSolid = Math.floor((today.getTime() - new Date(baby.start_date).getTime()) / 86400000) + 1;

  const latest = growth[growth.length - 1];
  const prev = growth.length > 1 ? growth[growth.length - 2] : null;
  const diff = latest && prev ? (latest.weight - prev.weight).toFixed(1) : null;

  const current = tests.find(t => t.status === 'in_progress');
  const testDay = current?.start_date
    ? Math.min(3, Math.max(1, Math.floor((today.getTime() - new Date(current.start_date).getTime()) / 86400000) + 1))
    : 1;
  const GRAMS = [3, 10, 20];

  const morning = meals.find(m => m.slot === 'morning');
  const evening = meals.find(m => m.slot === 'evening');

  return (
    <div>
      <div className="page-header">
        <h2>오늘의 이유식 🍼</h2>
        <p>{today.getFullYear()}년 {today.getMonth() + 1}월 {today.getDate()}일 ({DAY_NAMES[today.getDay()]})</p>
      </div>

      <div className="baby-info-bar">
        <div className="baby-info-main">
          <div className="baby-avatar">👶</div>
          <div className="baby-info-text">
            <h3>{baby.name}</h3>
            <p>{baby.stage} 이유식 진행 중</p>
          </div>
        </div>
        <div className="baby-info-stats">
          <div className="baby-stat"><div className="value">{months}</div><div className="label">개월</div></div>
          <div className="baby-stat"><div className="value">{daysSolid}일</div><div className="label">이유식 일차</div></div>
          <div className="baby-stat"><div className="value">{baby.weight}</div><div className="label">kg</div></div>
        </div>
      </div>

      <div className="card-grid">
        <div className="card">
          <div className="card-title">🍚 오늘 식단</div>
          <div className="meal-row">
            <div className="meal-slot">
              <div className="meal-slot-label morning">☀️ 오전</div>
              <div className="meal-ingredients">
                {morning ? morning.ingredients.map((i, k) => <Chip key={k} ing={i} />) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>식단 없음</span>}
              </div>
            </div>
            <div className="meal-slot">
              <div className="meal-slot-label evening">🌙 저녁</div>
              <div className="meal-ingredients">
                {evening ? evening.ingredients.map((i, k) => <Chip key={k} ing={i} />) : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>식단 없음</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-title">⭐ 알러지 테스트</div>
          {current ? (
            <div className="test-progress">
              <div className="test-day-circles">
                {[1, 2, 3].map(d => (
                  <div key={d} className={`day-circle ${d < testDay ? 'done' : d === testDay ? 'today' : 'future'}`}>{d}</div>
                ))}
              </div>
              <div className="test-info">
                <div className="test-name">{current.name}</div>
                <div className="test-amount">오늘 {testDay}일차 · {GRAMS[testDay - 1]}g</div>
              </div>
              <span className={`test-badge ${current.high_risk ? '' : 'low'}`}>{current.high_risk ? '고위험' : '저위험'}</span>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>진행 중인 테스트 없음</div>
          )}
        </div>

        <div className="card">
          <div className="card-title">🧊 냉장고 현황</div>
          <div className="fridge-items">
            {fridge.slice(0, 4).map(f => (
              <div className="fridge-item" key={f.id}>
                <span className="fridge-item-name">{f.ingredient} ({f.size}g)</span>
                <span className={`fridge-item-count ${f.count === 0 ? 'empty' : f.count <= 2 ? 'low' : ''}`}>
                  {f.count === 0 ? '0개 ⚠️' : `${f.count}개`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-title">📈 성장 기록</div>
          {latest && (
            <>
              <div className="growth-display">
                <span className="growth-value">{latest.weight}</span>
                <span className="growth-unit">kg</span>
                {diff !== null && <span className="growth-change">{Number(diff) >= 0 ? '+' : ''}{diff}</span>}
              </div>
              <p className="growth-date">{latest.date} 측정</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
