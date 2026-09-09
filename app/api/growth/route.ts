import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isDate, isNumber, readBody, requireInput, withApiErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

export const GET = withApiErrors('growth.GET', async () => {
  const sql = getSql();
  const rows = await sql`SELECT id, date::text, weight::float, height::float FROM growth_records ORDER BY date ASC, id ASC`;
  return NextResponse.json(rows);
});

export const POST = withApiErrors('growth.POST', async (req: Request) => {
  const b = await readBody(req);
  if (!b.date || !b.weight) return NextResponse.json({ error: 'date and weight required' }, { status: 400 });
  requireInput(isDate(b.date) && isNumber(b.weight), 'Valid date and numeric weight required');
  requireInput(b.height == null || isNumber(b.height), 'height must be numeric');
  const sql = getSql();
  await sql`INSERT INTO growth_records (date, weight, height) VALUES (${b.date}, ${b.weight}, ${b.height ?? null})`;
  await sql`UPDATE baby SET weight = ${b.weight} WHERE id = 1`;
  return NextResponse.json({ ok: true });
});
