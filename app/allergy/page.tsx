'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ymd } from '@/components/ui';
import type { AllergyTest, TestedIngredient } from '@/lib/types';

const GRAMS = [3, 10, 20];

export default function AllergyPage() {
  const [tests, setTests] = useState<AllergyTest[]>([]);
  const [tested, setTested] = useState<TestedIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    Promise.all([
      api<AllergyTest[]>('/api/allergy'),
      api<TestedIngredient[]>('/api/ingredients'),
    ]).then(([a, t]) => { setTests(a); setTested(t); }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div className="loading">불러오는 중...</div>;

  const current = tests.filter(t => t.status === 'in_progress');
  const queued = tests.filter(t => t.status === 'queued').sort((a, b) => (a.queue_order ?? 99) - (b.queue_order ?? 99));
  const today = new Date();

  const complete = async (t: AllergyTest) => {
    if (!confirm(`${t.name} 테스트를 완료 처리할까요? (먹어본 재료에 추가됩니다)`)) return;
    await api('/api/allergy', { method: 'POST', body: JSON.stringify({ action: 'complete', id: t.id }) });
    reload();
  };

  const start = async (t: AllergyTest) => {
    const date = prompt('시작일 (YYYY-MM-DD)', ymd(new Date()));
    if (!date) return;
    await api('/api/allergy', { method: 'POST', body: JSON.stringify({ action: 'start', id: t.id, start_date: date }) });
    reload();
  };

  const addTest = async () => {
    const name = prompt('테스트할 재료명');
    if (!name) return;
    const highRisk = confirm('고위험 식품인가요? (달걀·새우·조개·메밀·호두 등 — 확인=고위험, 취소=저위험)');
    await api('/api/allergy', { method: 'POST', body: JSON.stringify({ action: 'add', name, high_risk: highRisk }) });
    reload();
  };

  return (
    <div>
      <div className="page-header">
        <h2>알러지 테스트 🧪</h2>
        <p>3일 사이클 · 1일차 3g → 2일차 10g → 3일차 20g</p>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>🔄 진행 중</div>
        <div className="test-queue">
          {current.length === 0 && <div className="empty-state"><p>진행 중인 테스트가 없어요</p></div>}
          {current.map(t => {
            const day = t.start_date
              ? Math.min(3, Math.max(1, Math.floor((today.getTime() - new Date(t.start_date).getTime()) / 86400000) + 1))
              : 1;
            const end = t.start_date ? new Date(new Date(t.start_date).getTime() + 2 * 86400000) : null;
            return (
              <div className="test-queue-item active-test" key={t.id}>
                <div className="test-queue-order">🌟</div>
                <div className="test-queue-info">
                  <div className="test-queue-name">
                    {t.name} <span className={`test-badge ${t.high_risk ? '' : 'low'}`}>{t.high_risk ? '고위험' : '저위험'}</span>
                  </div>
                  <div className="test-queue-status">
                    Day {day} / 3 · 오늘 오전 {GRAMS[day - 1]}g
                    {t.start_date && end && ` · ${t.start_date.slice(5).replace('-', '/')}~${end.getMonth() + 1}/${end.getDate()}`}
                  </div>
                </div>
                <button className="test-complete-btn" onClick={() => complete(t)}>완료</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginBottom: 24 }}>
        <div className="card-title" style={{ marginBottom: 12 }}>⏳ 다음 테스트 순서</div>
        <div className="test-queue">
          {queued.map((t, i) => (
            <div className="test-queue-item" key={t.id}>
              <div className="test-queue-order">{i + 2}</div>
              <div className="test-queue-info">
                <div className="test-queue-name">
                  {t.name} <span className={`test-badge ${t.high_risk ? '' : 'low'}`}>{t.high_risk ? '고위험' : '저위험'}</span>
                </div>
                <div className="test-queue-status">{t.high_risk ? '⚠️ 평일만 · ' : ''}일정 미정</div>
              </div>
              <button className="test-complete-btn" onClick={() => start(t)}>시작</button>
            </div>
          ))}
        </div>
        <button className="add-btn" style={{ marginTop: 12 }} onClick={addTest}>＋ 테스트 추가</button>
      </div>

      <div>
        <div className="card-title" style={{ marginBottom: 12 }}>✅ 테스트 완료 ({tested.length}가지)</div>
        <div className="ingredient-tags">
          {tested.map(t => <div key={t.id} className="ingredient-tag tested">{t.name}</div>)}
        </div>
      </div>
    </div>
  );
}
