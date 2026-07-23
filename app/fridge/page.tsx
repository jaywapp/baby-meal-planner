'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ymd } from '@/components/ui';
import type { FridgeItem } from '@/lib/types';

const EMOJIS: Record<string, string> = {
  소고기: '🥩', 닭고기: '🍗', 쌀미음: '🌾', 오트밀: '🌾', 브로콜리: '🥦',
  애호박: '🥒', 당근: '🥕', 감자: '🥔', 무: '🫒', 시금치: '🥬',
  단호박: '🎃', 양송이버섯: '🍄', 양파: '🧅',
};

export default function FridgePage() {
  const [items, setItems] = useState<FridgeItem[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ingredient: '', size: 20, count: '', made_date: ymd(new Date()) });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    api<FridgeItem[]>('/api/fridge').then(setItems).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const edit = async (f: FridgeItem) => {
    const v = prompt(`${f.ingredient} (${f.size}g) 현재 개수: ${f.count}\n새 개수를 입력하세요 (비우려면 삭제 입력):`, String(f.count));
    if (v === null) return;
    if (v.trim() === '삭제') {
      await api(`/api/fridge/${f.id}`, { method: 'PATCH', body: JSON.stringify({ delete: true }) });
    } else {
      await api(`/api/fridge/${f.id}`, { method: 'PATCH', body: JSON.stringify({ count: parseInt(v) || 0 }) });
    }
    reload();
  };

  const save = async () => {
    if (!form.ingredient || !form.count) return alert('재료와 개수를 입력해주세요');
    await api('/api/fridge', {
      method: 'POST',
      body: JSON.stringify({ ...form, count: parseInt(form.count) }),
    });
    setShowAdd(false);
    setForm({ ingredient: '', size: 20, count: '', made_date: ymd(new Date()) });
    reload();
  };

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>냉장고 관리 🧊</h2>
        <p>큐브 재고 현황 — 카드를 누르면 수량 수정</p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <button className="add-btn" onClick={() => setShowAdd(true)}>＋ 큐브 추가</button>
      </div>
      <div className="fridge-grid">
        {items.map(f => (
          <div
            key={f.id}
            className={`fridge-card-item ${f.count === 0 ? 'out-of-stock' : f.count <= 2 ? 'low-stock' : ''}`}
            onClick={() => edit(f)}
          >
            <div className="fi-emoji">{EMOJIS[f.ingredient] ?? '🧊'}</div>
            <div className="fi-name">{f.ingredient}</div>
            <div className={`fi-count ${f.count === 0 ? 'empty' : ''}`}>{f.count}</div>
            <div className="fi-unit">{f.size}g 큐브</div>
            {f.made_date && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>{f.made_date}</div>}
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            <div className="modal-title">🧊 큐브 추가</div>
            <div className="form-group">
              <label className="form-label">재료</label>
              <input className="form-input" value={form.ingredient} placeholder="예: 소고기"
                onChange={e => setForm(f => ({ ...f, ingredient: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">큐브 크기</label>
              <select className="form-select" value={form.size} onChange={e => setForm(f => ({ ...f, size: parseInt(e.target.value) }))}>
                <option value={20}>20g 큐브</option>
                <option value={30}>30g 큐브</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">개수</label>
              <input className="form-input" type="number" min={1} value={form.count} placeholder="예: 6"
                onChange={e => setForm(f => ({ ...f, count: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">제작일</label>
              <input className="form-input" type="date" value={form.made_date}
                onChange={e => setForm(f => ({ ...f, made_date: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={save}>저장</button>
          </div>
        </div>
      )}
    </div>
  );
}
