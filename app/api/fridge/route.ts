import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getSql();
  const rows = await sql`SELECT id, ingredient, size, count, made_date::text FROM fridge_stock ORDER BY count = 0, ingredient`;
  return NextResponse.json(rows);
}

// Add cubes: upsert by (ingredient, size), incrementing count
export async function POST(req: Request) {
  const b = await req.json();
  if (!b.ingredient || !b.count) return NextResponse.json({ error: 'ingredient and count required' }, { status: 400 });
  const sql = getSql();
  await sql`INSERT INTO fridge_stock (ingredient, size, count, made_date)
    VALUES (${b.ingredient}, ${b.size ?? 20}, ${b.count}, ${b.made_date ?? null})
    ON CONFLICT (ingredient, size)
    DO UPDATE SET count = fridge_stock.count + EXCLUDED.count, made_date = COALESCE(EXCLUDED.made_date, fridge_stock.made_date)`;
  return NextResponse.json({ ok: true });
}
