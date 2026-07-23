import { neon } from '@neondatabase/serverless';

// Simplified signature: every query resolves to an array of rows.
type Sql = (strings: TemplateStringsArray, ...params: unknown[]) => Promise<Record<string, any>[]>;

let _sql: Sql | null = null;

export function getSql(): Sql {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    _sql = neon(url) as unknown as Sql;
  }
  return _sql;
}
