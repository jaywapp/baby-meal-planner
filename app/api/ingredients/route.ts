import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getSql();
  const rows = await sql`SELECT id, name, category, excluded FROM tested_ingredients ORDER BY category, name`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const sql = getSql();
  await sql`INSERT INTO tested_ingredients (name, category, excluded)
    VALUES (${b.name}, ${b.category ?? '기타'}, ${b.excluded ?? false})
    ON CONFLICT (name) DO UPDATE SET category = EXCLUDED.category, excluded = EXCLUDED.excluded`;
  return NextResponse.json({ ok: true });
}
