import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getSql();
  const rows = await sql`SELECT id, date::text, weight::float, height::float FROM growth_records ORDER BY date ASC, id ASC`;
  return NextResponse.json(rows);
}

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.date || !b.weight) return NextResponse.json({ error: 'date and weight required' }, { status: 400 });
  const sql = getSql();
  await sql`INSERT INTO growth_records (date, weight, height) VALUES (${b.date}, ${b.weight}, ${b.height ?? null})`;
  await sql`UPDATE baby SET weight = ${b.weight} WHERE id = 1`;
  return NextResponse.json({ ok: true });
}
