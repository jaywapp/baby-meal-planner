import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getSql();
  const rows = await sql`SELECT name, birth_date::text, start_date::text, stage, weight::float FROM baby WHERE id = 1`;
  return NextResponse.json(rows[0] ?? null);
}

export async function PUT(req: Request) {
  const b = await req.json();
  const sql = getSql();
  await sql`UPDATE baby SET
    name = ${b.name}, birth_date = ${b.birth_date}, start_date = ${b.start_date},
    stage = ${b.stage}, weight = ${b.weight}
    WHERE id = 1`;
  return NextResponse.json({ ok: true });
}
