'use client';

import { useEffect, useState } from 'react';
import { api } from '@/components/ui';
import type { Baby } from '@/lib/types';

const STAGES = ['초기1', '초기2', '중기', '후기', '완료기'];

export default function SettingsPage() {
  const [baby, setBaby] = useState<Baby | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<Baby>('/api/baby').then(setBaby);
  }, []);

  if (!baby) return <div className="loading">불러오는 중...</div>;

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/baby', { method: 'PUT', body: JSON.stringify(baby) });
      alert('✅ 설정이 저장되었어요!');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header"><h2>설정 ⚙️</h2></div>
      <div className="card">
        <div className="settings-section">
          <div className="settings-section-title">👶 아기 정보</div>
          <div className="settings-row">
            <span className="settings-row-label">이름</span>
            <input className="settings-input" value={baby.name} onChange={e => setBaby({ ...baby, name: e.target.value })} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">생년월일</span>
            <input className="settings-input" type="date" value={baby.birth_date} onChange={e => setBaby({ ...baby, birth_date: e.target.value })} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">이유식 시작일</span>
            <input className="settings-input" type="date" value={baby.start_date} onChange={e => setBaby({ ...baby, start_date: e.target.value })} />
          </div>
          <div className="settings-row">
            <span className="settings-row-label">현재 단계</span>
            <select className="settings-input" value={baby.stage} onChange={e => setBaby({ ...baby, stage: e.target.value })}>
              {STAGES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-row-label">최근 몸무게 (kg)</span>
            <input className="settings-input" type="number" step="0.1" value={baby.weight}
              onChange={e => setBaby({ ...baby, weight: parseFloat(e.target.value) || 0 })} />
          </div>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? '저장 중...' : '저장'}</button>
        </div>
      </div>
    </div>
  );
}
