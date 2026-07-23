'use client';

import type { MealIngredient } from '@/lib/types';

export function Chip({ ing }: { ing: MealIngredient }) {
  const cls = ing.test ? 'chip-test' : `chip-${ing.type ?? 'veggie'}`;
  return (
    <span className={`ingredient-chip ${cls}`}>
      {ing.name}{ing.amount ? ` ${ing.amount}` : ''}{ing.test ? ' (테스트)' : ''}
    </span>
  );
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
