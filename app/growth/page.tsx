'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ymd } from '@/components/ui';
import type { GrowthRecord } from '@/lib/types';

export default function GrowthPage() {
  const [records, setRecords] = useState<GrowthRecord[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: ymd(new Date()), weight: '', height: '' });
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    api<GrowthRecord[]>('/api/growth').then(setRecords).finally(() => setLoading(false));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const save = async () => {
    if (!form.date || !form.weight) return alert('날짜와 몸무게를 입력해주세요');
    await api('/api/growth', {
      method: 'POST',
      body: JSON.stringify({
        date: form.date,
        weight: parseFloat(form.weight),
        height: form.height ? parseFloat(form.height) : null,
      }),
    });
    setShowAdd(false);
    setForm({ date: ymd(new Date()), weight: '', height: '' });
    reload();
  };

  if (loading) return <div className="loading">불러오는 중...</div>;

  return (
    <div>
      <div className="page-header">
        <h2>성장 기록 📈</h2>
        <p>이나의 성장 변화 추적</p>
      </div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">📊 성장 차트</div>
        <GrowthChart records={records} />
        <div className="growth-records-list">
          {[...records].reverse().map(r => (
            <div className="growth-record-row" key={r.id}>
              <span className="growth-record-date">📅 {r.date}</span>
              <span className="growth-record-val">⚖️ {r.weight} kg {r.height ? `· 📏 ${r.height} cm` : ''}</span>
            </div>
          ))}
        </div>
      </div>
      <button className="add-btn" onClick={() => setShowAdd(true)}>＋ 성장 기록 추가</button>

      {showAdd && (
        <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div className="modal">
            <button className="modal-close" onClick={() => setShowAdd(false)}>✕</button>
            <div className="modal-title">📏 성장 기록 추가</div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input className="form-input" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">몸무게 (kg)</label>
              <input className="form-input" type="number" step="0.1" value={form.weight} placeholder="예: 10.0"
                onChange={e => setForm(f => ({ ...f, weight: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">키 (cm, 선택)</label>
              <input className="form-input" type="number" step="0.1" value={form.height} placeholder="예: 68.0"
                onChange={e => setForm(f => ({ ...f, height: e.target.value }))} />
            </div>
            <button className="btn-primary" onClick={save}>저장</button>
          </div>
        </div>
      )}
    </div>
  );
}

function GrowthChart({ records }: { records: GrowthRecord[] }) {
  if (records.length < 2) {
    return <div className="growth-chart-placeholder">📈 기록이 2개 이상 쌓이면 그래프가 보여요</div>;
  }
  const W = 600, H = 180, PAD = 30;
  const weights = records.map(r => r.weight);
  const min = Math.min(...weights) - 0.3;
  const max = Math.max(...weights) + 0.3;
  const x = (i: number) => PAD + (i / (records.length - 1)) * (W - PAD * 2);
  const y = (w: number) => H - PAD - ((w - min) / (max - min)) * (H - PAD * 2);
  const path = records.map((r, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(r.weight)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', marginBottom: 16 }}>
      <path d={path} fill="none" stroke="var(--accent-mint)" strokeWidth="2.5" strokeLinecap="round" />
      {records.map((r, i) => (
        <g key={r.id}>
          <circle cx={x(i)} cy={y(r.weight)} r="4" fill="var(--accent-mint)" />
          <text x={x(i)} y={y(r.weight) - 10} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">{r.weight}</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{r.date.slice(5)}</text>
        </g>
      ))}
    </svg>
  );
}
