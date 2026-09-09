import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isDate, isNumber, isText, readBody, requireInput, withApiErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('baby.GET', async () => {
  const sql = getSql();
  const rows = await sql`SELECT name, birth_date::text, start_date::text, stage, weight::float FROM baby WHERE id = 1`;
  return NextResponse.json(rows[0] ?? null);
});

export const PUT = withApiErrors('baby.PUT', async (req: Request) => {
  const b = await readBody(req);
  requireInput(isText(b.name) && isText(b.stage) && isDate(b.birth_date)
    && isDate(b.start_date) && isNumber(b.weight), 'Valid baby fields required');
  const sql = getSql();
  await sql`UPDATE baby SET
    name = ${b.name}, birth_date = ${b.birth_date}, start_date = ${b.start_date},
    stage = ${b.stage}, weight = ${b.weight}
    WHERE id = 1`;
  return NextResponse.json({ ok: true });
});
