// Idempotent schema init + seed for BabyMeal Planner.
// Usage: DATABASE_URL must be set (reads .env.local as fallback).
import { neon } from '@neondatabase/serverless';
import { readFileSync, existsSync } from 'node:fs';

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)="?([^"\r\n]*)"?$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

await sql`CREATE TABLE IF NOT EXISTS baby (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  start_date DATE NOT NULL,
  stage TEXT NOT NULL,
  weight NUMERIC(4,1) NOT NULL
)`;

await sql`CREATE TABLE IF NOT EXISTS growth_records (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  weight NUMERIC(4,1) NOT NULL,
  height NUMERIC(5,1)
)`;

await sql`CREATE TABLE IF NOT EXISTS fridge_stock (
  id SERIAL PRIMARY KEY,
  ingredient TEXT NOT NULL,
  size INT NOT NULL,
  count INT NOT NULL DEFAULT 0,
  made_date DATE,
  UNIQUE (ingredient, size)
)`;

await sql`CREATE TABLE IF NOT EXISTS allergy_tests (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  high_risk BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL CHECK (status IN ('in_progress','queued','completed')),
  queue_order INT,
  start_date DATE
)`;

await sql`CREATE TABLE IF NOT EXISTS tested_ingredients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  excluded BOOLEAN NOT NULL DEFAULT false
)`;

await sql`CREATE TABLE IF NOT EXISTS meal_plans (
  date DATE NOT NULL,
  slot TEXT NOT NULL CHECK (slot IN ('morning','evening')),
  ingredients JSONB NOT NULL DEFAULT '[]',
  note TEXT,
  PRIMARY KEY (date, slot)
)`;

// ---------- seed (only when empty) ----------
const [{ count: babyCount }] = await sql`SELECT COUNT(*)::int AS count FROM baby`;
if (babyCount === 0) {
  console.log('Seeding baby / growth / fridge...');
  await sql`INSERT INTO baby (id, name, birth_date, start_date, stage, weight)
    VALUES (1, '이나', '2025-12-03', '2026-07-01', '중기', 10.0)`;
  await sql`INSERT INTO growth_records (date, weight, height) VALUES ('2026-07-23', 10.0, NULL)`;

  const fridge = [
    ['소고기', 20, 4, '2026-07-08'],
    ['닭고기', 20, 3, '2026-07-01'],
    ['쌀미음', 30, 0, null],
    ['오트밀', 30, 0, null],
    ['브로콜리', 20, 7, '2026-06-30'],
    ['애호박', 20, 1, '2026-06-30'],
    ['당근', 20, 0, null],
    ['감자', 20, 1, '2026-06-30'],
    ['무', 20, 1, null],
  ];
  for (const [ingredient, size, count, made] of fridge) {
    await sql`INSERT INTO fridge_stock (ingredient, size, count, made_date)
      VALUES (${ingredient}, ${size}, ${count}, ${made})
      ON CONFLICT (ingredient, size) DO NOTHING`;
  }
}

const [{ count: testCount }] = await sql`SELECT COUNT(*)::int AS count FROM allergy_tests`;
if (testCount === 0) {
  console.log('Seeding allergy tests...');
  await sql`INSERT INTO allergy_tests (name, high_risk, status, queue_order, start_date) VALUES
    ('참깨', false, 'in_progress', NULL, '2026-07-24'),
    ('메밀', true, 'queued', 1, NULL),
    ('밀', true, 'queued', 2, NULL),
    ('달걀노른자', true, 'queued', 3, NULL),
    ('새우', true, 'queued', 4, NULL),
    ('조개', true, 'queued', 5, NULL)
    ON CONFLICT (name) DO NOTHING`;
}

const [{ count: ingCount }] = await sql`SELECT COUNT(*)::int AS count FROM tested_ingredients`;
if (ingCount === 0) {
  console.log('Seeding tested ingredients...');
  const cats = {
    곡류: ['쌀', '오트밀', '현미'],
    단백질: ['소고기', '닭고기', '흰살생선', '땅콩', '서리태'],
    채소: ['감자', '애호박', '당근', '시금치', '브로콜리', '청경채', '무', '단호박', '아스파라거스', '콜리플라워', '양송이버섯', '김', '양상추', '비트', '고구마', '양파', '양배추', '배추'],
    과일: ['사과', '배'],
    기타: ['게'],
  };
  const excluded = new Set(['브로콜리', '게', '흰살생선']);
  for (const [category, names] of Object.entries(cats)) {
    for (const name of names) {
      await sql`INSERT INTO tested_ingredients (name, category, excluded)
        VALUES (${name}, ${category}, ${excluded.has(name)})
        ON CONFLICT (name) DO NOTHING`;
    }
  }
}

const [{ count: mealCount }] = await sql`SELECT COUNT(*)::int AS count FROM meal_plans`;
if (mealCount === 0) {
  console.log('Seeding meal plans (cycles 1-3)...');
  const g = (name, amount) => ({ name, amount, type: 'grain' });
  const v = (name, amount) => ({ name, amount, type: 'veggie' });
  const p = (name, amount) => ({ name, amount, type: 'protein' });
  const t = (name) => ({ name, type: 'test', test: true });

  const plans = [];
  const addRange = (from, to, slot, ingredients, note) => {
    const d = new Date(from + 'T00:00:00Z');
    const end = new Date(to + 'T00:00:00Z');
    while (d <= end) {
      plans.push([d.toISOString().slice(0, 10), slot, ingredients, note ?? null]);
      d.setUTCDate(d.getUTCDate() + 1);
    }
  };

  // Cycle 1
  addRange('2026-07-24', '2026-07-26', 'morning',
    [g('쌀', '75g'), t('참깨'), v('단호박'), g('오트밀'), v('양파')], '사이클 1 · 참깨 테스트');
  addRange('2026-07-23', '2026-07-25', 'evening',
    [g('쌀', '75g'), p('소고기', '40g'), v('감자', '15g'), v('양송이버섯', '40g'), v('양파', '30g')], '사이클 1');
  // Cycle 2
  addRange('2026-07-27', '2026-07-29', 'morning',
    [g('쌀', '75g'), t('메밀'), v('애호박', '40g'), v('당근', '30g'), v('양파', '15g')], '사이클 2 · 메밀 테스트(고위험·평일)');
  addRange('2026-07-26', '2026-07-28', 'evening',
    [g('쌀', '75g'), p('소고기', '40g'), v('무', '30g'), v('양배추', '30g'), v('양파', '15g')], '사이클 2');
  // Cycle 3
  addRange('2026-07-30', '2026-08-01', 'morning',
    [g('쌀', '75g'), t('밀'), v('양송이버섯', '40g'), v('감자', '30g')], '사이클 3 · 밀 테스트(고위험·평일)');
  addRange('2026-07-29', '2026-07-31', 'evening',
    [g('쌀', '75g'), p('소고기', '40g'), v('애호박', '40g'), v('당근', '30g')], '사이클 3');

  for (const [date, slot, ingredients, note] of plans) {
    await sql`INSERT INTO meal_plans (date, slot, ingredients, note)
      VALUES (${date}, ${slot}, ${JSON.stringify(ingredients)}::jsonb, ${note})
      ON CONFLICT (date, slot) DO NOTHING`;
  }
}

console.log('DB init complete.');
