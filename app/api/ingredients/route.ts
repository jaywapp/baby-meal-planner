import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isText, readBody, requireInput, withApiErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('ingredients.GET', async () => {
  const sql = getSql();
  const rows = await sql`SELECT id, name, category, excluded FROM tested_ingredients ORDER BY category, name`;
  return NextResponse.json(rows);
});

export const POST = withApiErrors('ingredients.POST', async (req: Request) => {
  const b = await readBody(req);
  if (!b.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  requireInput(isText(b.name) && (b.category == null || isText(b.category)), 'Valid name and category required');
  requireInput(b.excluded == null || typeof b.excluded === 'boolean', 'excluded must be boolean');
  const sql = getSql();
  await sql`INSERT INTO tested_ingredients (name, category, excluded)
    VALUES (${b.name}, ${b.category ?? '기타'}, ${b.excluded ?? false})
    ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, excluded = EXCLUDED.excluded`;
  return NextResponse.json({ ok: true });
});
