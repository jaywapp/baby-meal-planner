import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isDate, isRecord, isText, readBody, requireInput, withApiErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

// GET /api/meals?start=YYYY-MM-DD&end=YYYY-MM-DD
export const GET = withApiErrors('meals.GET', async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  if (!start || !end) return NextResponse.json({ error: 'start and end required' }, { status: 400 });
  requireInput(isDate(start) && isDate(end), 'Valid start and end dates required');
  const sql = getSql();
  const rows = await sql`SELECT date::text, slot, ingredients, note
    FROM meal_plans WHERE date BETWEEN ${start} AND ${end} ORDER BY date, slot`;
  return NextResponse.json(rows);
});

// PUT upserts one slot: { date, slot, ingredients, note? }
export const PUT = withApiErrors('meals.PUT', async (req: Request) => {
  const b = await readBody(req);
  if (!b.date || !b.slot || !Array.isArray(b.ingredients)) {
    return NextResponse.json({ error: 'date, slot, ingredients required' }, { status: 400 });
  }
  requireInput(isDate(b.date) && (b.slot === 'morning' || b.slot === 'evening'), 'Valid date and slot required');
  requireInput(b.note == null || typeof b.note === 'string', 'note must be text');
  requireInput(b.ingredients.every(ingredient => isRecord(ingredient) && isText(ingredient.name)
    && (ingredient.amount == null || typeof ingredient.amount === 'string')
    && typeof ingredient.type === 'string' && ['grain', 'veggie', 'protein', 'fruit', 'test', 'etc'].includes(ingredient.type)
    && (ingredient.test == null || typeof ingredient.test === 'boolean')), 'Invalid ingredients');
  const sql = getSql();
  if (b.ingredients.length === 0) {
    await sql`DELETE FROM meal_plans WHERE date = ${b.date} AND slot = ${b.slot}`;
  } else {
    await sql`INSERT INTO meal_plans (date, slot, ingredients, note)
      VALUES (${b.date}, ${b.slot}, ${JSON.stringify(b.ingredients)}::jsonb, ${b.note ?? null})
      ON CONFLICT (date, slot) DO UPDATE SET ingredients = EXCLUDED.ingredients, note = EXCLUDED.note`;
  }
  return NextResponse.json({ ok: true });
});
