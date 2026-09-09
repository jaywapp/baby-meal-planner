import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { isCount, isId, readBody, requireInput, withApiErrors } from '@/lib/api-validation';

export const dynamic = 'force-dynamic';

// Set absolute count (0 allowed). Delete row with { delete: true }.
export const PATCH = withApiErrors('fridge.PATCH', async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const b = await readBody(req);
  requireInput(isId(id), 'Valid id required');
  requireInput(b.delete == null || typeof b.delete === 'boolean', 'delete must be boolean');
  requireInput(b.delete === true || isCount(b.count), 'count must be a nonnegative integer');
  const sql = getSql();
  if (b.delete) {
    await sql`DELETE FROM fridge_stock WHERE id = ${id}`;
  } else {
    await sql`UPDATE fridge_stock SET count = ${b.count} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
});
