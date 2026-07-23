'use client';

import { useEffect, useState } from 'react';
import { api } from '@/components/ui';
import type { TestedIngredient } from '@/lib/types';

export default function IngredientsPage() {
  const [items, setItems] = useState<TestedIngredient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<TestedIngredient[]>('/api/ingredients').then(setItems).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">불러오는 중...</div>;

  const byCategory = items.reduce<Record<string, TestedIngredient[]>>((acc, i) => {
    (acc[i.category] = acc[i.category] ?? []).push(i);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h2>먹어본 재료 🥦</h2>
        <p>알러지 테스트 완료 · 총 {items.length}가지</p>
      </div>
      {Object.entries(byCategory).map(([cat, list]) => (
        <div className="ingredient-category-section" key={cat}>
          <div className="ingredient-category-title">✅ {cat}</div>
          <div className="ingredient-tags">
            {list.map(i => (
              <div key={i.id} className={`ingredient-tag tested ${i.excluded ? 'excluded' : ''}`}>
                {i.name}{i.excluded ? ' (제외)' : ''}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
