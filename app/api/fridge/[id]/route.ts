import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

// Set absolute count (0 allowed). Delete row with { delete: true }.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const sql = getSql();
  if (b.delete) {
    await sql`DELETE FROM fridge_stock WHERE id = ${id}`;
  } else {
    await sql`UPDATE fridge_stock SET count = ${b.count} WHERE id = ${id}`;
  }
  return NextResponse.json({ ok: true });
}
