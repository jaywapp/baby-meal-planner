'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Chip, ymd, DAY_NAMES } from '@/components/ui';
import type { MealPlan, MealIngredient, TestedIngredient, ChipType } from '@/lib/types';

type View = 'week' | 'day' | 'month';
type MealMap = Record<string, { morning?: MealPlan; evening?: MealPlan }>;

const SLOT_LABEL = { morning: '☀️ 오전', evening: '🌙 저녁' } as const;
const TYPE_OPTIONS: { value: ChipType; label: string }[] = [
  { value: 'grain', label: '곡류' },
  { value: 'veggie', label: '채소' },
  { value: 'protein', label: '단백질' },
  { value: 'fruit', label: '과일' },
  { value: 'test', label: '테스트' },
  { value: 'etc', label: '기타' },
];

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function weekStart(d: Date): Date {
  return addDays(d, -d.getDay());
}

export default function CalendarPage() {
  const [view, setView] = useState<View>('week');
  const [anchor, setAnchor] = useState<Date | null>(null);
  const [meals, setMeals] = useState<MealMap>({});
  const [tested, setTested] = useState<TestedIngredient[]>([]);
  const [editing, setEditing] = useState<{ date: string; slot: 'morning' | 'evening' } | null>(null);
  const [loading, setLoading] = useState(true);

  const todayYmd = anchor ? ymd(new Date()) : '';
  const selectedYmd = anchor ? ymd(anchor) : '';

  // Range to load: whole month of anchor plus a week padding on both sides.
  const range = useMemo(() => {
    if (!anchor) return null;
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    return { start: ymd(addDays(first, -7)), end: ymd(addDays(last, 7)) };
  }, [anchor]);

  const reload = useCallback(() => {
    if (!range) return;
    setLoading(true);
    api<MealPlan[]>(`/api/meals?start=${range.start}&end=${range.end}`)
      .then(rows => {
        const map: MealMap = {};
        for (const r of rows) {
          map[r.date] = map[r.date] ?? {};
          map[r.date][r.slot] = r;
        }
        setMeals(map);
      })
      .finally(() => setLoading(false));
  }, [range]);

  useEffect(() => { setAnchor(new Date()); }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { api<TestedIngredient[]>('/api/ingredients').then(setTested).catch(() => {}); }, []);

  if (!anchor) {
    return (
      <div>
        <div className="page-header">
          <h2>식단 캘린더 📅</h2>
          <p>3일 사이클 기준 이유식 식단</p>
        </div>
        <div className="loading">캘린더 불러오는 중...</div>
      </div>
    );
  }

  const move = (n: number) => {
    if (view === 'week') setAnchor(a => addDays(a ?? new Date(), n * 7));
    else if (view === 'day') setAnchor(a => addDays(a ?? new Date(), n));
    else setAnchor(a => {
      const date = a ?? new Date();
      return new Date(date.getFullYear(), date.getMonth() + n, 1);
    });
  };

  const navTitle = view === 'month'
    ? `${anchor.getFullYear()}년 ${anchor.getMonth() + 1}월`
    : view === 'day'
      ? `${anchor.getMonth() + 1}월 ${anchor.getDate()}일 (${DAY_NAMES[anchor.getDay()]})`
      : (() => {
          const s = weekStart(anchor);
          const e = addDays(s, 6);
          return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
        })();

  return (
    <div>
      <div className="page-header">
        <h2>식단 캘린더 📅</h2>
        <p>3일 사이클 기준 이유식 식단</p>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
        <div className="calendar-tabs">
          {(['week', 'day', 'month'] as View[]).map(v => (
            <button key={v} className={`tab-btn ${view === v ? 'active' : ''}`} onClick={() => setView(v)}>
              {v === 'week' ? '주간' : v === 'day' ? '일간' : '월간'}
            </button>
          ))}
        </div>
        <div className="cal-nav" style={{ marginBottom: 0 }}>
          <button className="cal-nav-btn" onClick={() => move(-1)}>‹</button>
          <span className="cal-nav-title">{navTitle}</span>
          <button className="cal-nav-btn" onClick={() => move(1)}>›</button>
          <button className="cal-nav-btn" style={{ width: 'auto', padding: '0 10px', fontSize: 12 }} onClick={() => setAnchor(new Date())}>오늘</button>
        </div>
      </div>

      {view === 'week' && (
        <>
          <div className="week-calendar">
            {Array.from({ length: 7 }, (_, i) => {
              const d = addDays(weekStart(anchor), i);
              const key = ymd(d);
              const dayMeals = meals[key];
              return (
                <div
                  key={key}
                  className={`week-day ${key === todayYmd ? 'today' : ''} ${key === selectedYmd ? 'selected' : ''}`}
                  onClick={() => setAnchor(d)}
                >
                  <div className="week-day-label">{DAY_NAMES[d.getDay()]}</div>
                  <div className="week-day-num">{d.getDate()}</div>
                  <div className="week-day-dots">
                    {dayMeals?.morning && <div className="week-dot" style={{ background: 'var(--accent-peach)' }} />}
                    {dayMeals?.evening && <div className="week-dot" style={{ background: 'var(--accent-lavender)' }} />}
                  </div>
                </div>
              );
            })}
          </div>
          <DayDetail date={selectedYmd} meals={meals[selectedYmd]} onEdit={(slot) => setEditing({ date: selectedYmd, slot })} />
        </>
      )}

      {view === 'day' && (
        <DayDetail date={selectedYmd} meals={meals[selectedYmd]} onEdit={(slot) => setEditing({ date: selectedYmd, slot })} />
      )}

      {view === 'month' && (
        <MonthGrid
          anchor={anchor}
          meals={meals}
          todayYmd={todayYmd}
          onPick={(d) => { setAnchor(d); setView('day'); }}
        />
      )}

      {loading && <div className="loading">불러오는 중...</div>}

      {editing && (
        <SlotEditor
          date={editing.date}
          slot={editing.slot}
          initial={meals[editing.date]?.[editing.slot]}
          tested={tested}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </div>
  );
}

function DayDetail({ date, meals, onEdit }: {
  date: string;
  meals?: { morning?: MealPlan; evening?: MealPlan };
  onEdit: (slot: 'morning' | 'evening') => void;
}) {
  const d = new Date(date + 'T00:00:00');
  const note = meals?.morning?.note ?? meals?.evening?.note;
  return (
    <div className="day-detail-card">
      <div className="day-detail-head">
        <span className="day-detail-title">{d.getMonth() + 1}월 {d.getDate()}일 ({DAY_NAMES[d.getDay()]})</span>
        {note && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{note}</span>}
      </div>
      <div className="meal-row">
        {(['morning', 'evening'] as const).map(slot => {
          const plan = meals?.[slot];
          return (
            <div className="meal-slot" key={slot}>
              <div className={`meal-slot-label ${slot}`} style={{ justifyContent: 'space-between' }}>
                <span>{SLOT_LABEL[slot]}</span>
                <button className="edit-btn" style={{ fontSize: 10, padding: '3px 10px' }} onClick={() => onEdit(slot)}>
                  {plan ? '수정' : '추가'}
                </button>
              </div>
              <div className="meal-ingredients">
                {plan
                  ? plan.ingredients.map((i, k) => <Chip key={k} ing={i} />)
                  : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>식단 없음</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ anchor, meals, todayYmd, onPick }: {
  anchor: Date;
  meals: MealMap;
  todayYmd: string;
  onPick: (d: Date) => void;
}) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = addDays(first, -first.getDay());
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div>
      <div className="month-grid" style={{ marginBottom: 6 }}>
        {DAY_NAMES.map(n => <div key={n} className="month-grid-head">{n}</div>)}
      </div>
      <div className="month-grid">
        {cells.map(d => {
          const key = ymd(d);
          const dayMeals = meals[key];
          const testIng = dayMeals?.morning?.ingredients.find(i => i.test);
          return (
            <div
              key={key}
              className={`month-cell ${d.getMonth() !== anchor.getMonth() ? 'other-month' : ''} ${key === todayYmd ? 'today' : ''}`}
              onClick={() => onPick(d)}
            >
              <div className="month-cell-num">{d.getDate()}</div>
              <div className="month-cell-dots">
                {dayMeals?.morning && <div className="week-dot" style={{ background: 'var(--accent-peach)' }} />}
                {dayMeals?.evening && <div className="week-dot" style={{ background: 'var(--accent-lavender)' }} />}
              </div>
              {testIng && <div className="month-cell-test">🧪 {testIng.name}</div>}
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
        <span style={{ color: 'var(--accent-peach)' }}>●</span> 오전 죽 &nbsp;
        <span style={{ color: 'var(--accent-lavender)' }}>●</span> 저녁 죽 — 날짜를 누르면 일간 보기로 이동해요
      </p>
    </div>
  );
}

function SlotEditor({ date, slot, initial, tested, onClose, onSaved }: {
  date: string;
  slot: 'morning' | 'evening';
  initial?: MealPlan;
  tested: TestedIngredient[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<MealIngredient[]>(initial?.ingredients ?? []);
  const [note, setNote] = useState(initial?.note ?? '');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<ChipType>('veggie');
  const [saving, setSaving] = useState(false);

  const add = () => {
    if (!name.trim()) return;
    setItems(prev => [...prev, { name: name.trim(), amount: amount.trim() || undefined, type, test: type === 'test' }]);
    setName(''); setAmount('');
  };

  const save = async () => {
    setSaving(true);
    try {
      await api('/api/meals', {
        method: 'PUT',
        body: JSON.stringify({ date, slot, ingredients: items, note: note || null }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay show" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>
        <div className="modal-title">{SLOT_LABEL[slot]} 식단 편집 — {date}</div>

        <div className="form-group">
          <label className="form-label">재료 (누르면 삭제)</label>
          <div className="chip-editor">
            {items.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>재료 없음 — 아래에서 추가하세요. 전부 비우고 저장하면 식단이 삭제돼요.</span>}
            {items.map((i, k) => (
              <span key={k} onClick={() => setItems(prev => prev.filter((_, j) => j !== k))}>
                <Chip ing={i} />
              </span>
            ))}
          </div>
          <div className="chip-add-row">
            <input className="form-input" placeholder="재료명" value={name} list="tested-list"
              onChange={e => setName(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            <input className="form-input" placeholder="양 (예: 40g)" value={amount} style={{ width: 110, flex: 'none' }}
              onChange={e => setAmount(e.target.value)} onKeyDown={e => e.key === 'Enter' && add()} />
            <select className="form-select" value={type} onChange={e => setType(e.target.value as ChipType)}>
              {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button className="chip-add-btn" onClick={add}>＋</button>
          </div>
          <datalist id="tested-list">
            {tested.filter(t => !t.excluded).map(t => <option key={t.id} value={t.name} />)}
          </datalist>
        </div>

        <div className="form-group">
          <label className="form-label">메모 (사이클 등)</label>
          <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="예: 사이클 1 · 참깨 테스트" />
        </div>

        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
