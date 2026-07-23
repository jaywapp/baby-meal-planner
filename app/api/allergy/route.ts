import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const sql = getSql();
  const rows = await sql`SELECT id, name, high_risk, status, queue_order, start_date::text
    FROM allergy_tests ORDER BY status, queue_order NULLS FIRST, id`;
  return NextResponse.json(rows);
}

// Actions: { action: 'complete', id } finishes current test, promotes next in queue and
// registers the ingredient as tested; { action: 'start', id, start_date } starts a queued test.
export async function POST(req: Request) {
  const b = await req.json();
  const sql = getSql();

  if (b.action === 'complete') {
    const [test] = await sql`UPDATE allergy_tests SET status = 'completed', queue_order = NULL WHERE id = ${b.id} RETURNING name`;
    if (test) {
      await sql`INSERT INTO tested_ingredients (name, category, excluded)
        VALUES (${test.name}, ${b.category ?? '기타'}, false)
        ON CONFLICT (name) DO NOTHING`;
    }
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'start') {
    await sql`UPDATE allergy_tests SET status = 'in_progress', queue_order = NULL,
      start_date = ${b.start_date} WHERE id = ${b.id}`;
    return NextResponse.json({ ok: true });
  }

  if (b.action === 'add') {
    const [{ max }] = await sql`SELECT COALESCE(MAX(queue_order), 0)::int AS max FROM allergy_tests WHERE status = 'queued'`;
    await sql`INSERT INTO allergy_tests (name, high_risk, status, queue_order)
      VALUES (${b.name}, ${b.high_risk ?? false}, 'queued', ${max + 1})
      ON CONFLICT (name) DO NOTHING`;
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 });
}
