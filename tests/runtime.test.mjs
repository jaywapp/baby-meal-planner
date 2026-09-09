import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import ts from 'typescript';

const require = createRequire(import.meta.url);
function load(file, overrides = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  } });
  const result = { exports: {} };
  new Function('require', 'module', 'exports', output.outputText)(
    id => Object.hasOwn(overrides, id) ? overrides[id] : require(id), result, result.exports,
  );
  return result.exports;
}
const validation = load('lib/api-validation.ts');
const { countNutrition } = load('lib/nutrition.ts');
function route(name, query = async () => []) {
  const calls = [];
  const handlers = load(`app/api/${name}/route.ts`, {
    '@/lib/api-validation': validation,
    '@/lib/db': { getSql: () => async (strings, ...values) => {
      calls.push({ query: strings.join('?'), values });
      return query(strings, ...values);
    } },
  });
  return { handlers, calls };
}
const request = body => new Request('http://localhost/api/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const mutations = [
  ['meals', 'PUT', { date: '2026-09-09', slot: 'morning', ingredients: [{ name: 'fixture', type: 'grain' }] }],
  ['growth', 'POST', { date: '2026-09-09', weight: 10, height: null }],
  ['baby', 'PUT', { name: 'fixture', birth_date: '2026-01-01', start_date: '2026-09-01', stage: 'fixture', weight: 10 }],
  ['fridge', 'POST', { ingredient: 'fixture', count: 2 }],
  ['fridge/[id]', 'PATCH', { count: 0 }],
  ['ingredients', 'POST', { name: 'fixture' }],
  ['allergy', 'POST', { action: 'start', id: 1, start_date: '2026-09-09' }],
];
const context = { params: Promise.resolve({ id: '1' }) };

for (const [name, method, body] of mutations) {
  test(`${name}: valid ${method} preserves success and SQL parameters`, async () => {
    const { handlers, calls } = route(name);
    const response = await handlers[method](request(body), context);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.ok(calls.length > 0);
    if (name === 'fridge/[id]') assert.deepEqual(calls[0].values, [0, '1']);
    if (name === 'growth') assert.equal(calls.length, 2);
  });

  test(`${name}: rejects malformed JSON, null, arrays and empty input before querying`, async () => {
    const { handlers, calls } = route(name);
    for (const body of [null, [], {}, 'text', 1]) {
      const response = await handlers[method](request(body), context);
      assert.equal(response.status, 400);
    }
    const malformed = new Request('http://localhost/api/test', { method: 'POST', body: '{' });
    assert.equal((await handlers[method](malformed, context)).status, 400);
    assert.equal(calls.length, 0);
  });

  test(`${name}: database rejection stays a failure with a safe trace ID`, async t => {
    const logs = [];
    t.mock.method(console, 'error', (...args) => logs.push(args));
    const { handlers } = route(name, async () => { throw new Error('private connection details'); });
    const response = await handlers[method](request(body), context);
    assert.equal(response.status, 500);
    const payload = await response.json();
    assert.match(payload.requestId, /^[\da-f-]{36}$/);
    assert.equal(logs[0][1].requestId, payload.requestId);
    assert.doesNotMatch(JSON.stringify([payload, logs]), /private connection/);
  });
}

for (const name of ['meals', 'growth', 'baby', 'fridge', 'ingredients', 'allergy']) {
  test(`${name}: GET preserves empty result and catches query failure`, async t => {
    const req = new Request('http://localhost/api/meals?start=2026-09-01&end=2026-09-09');
    const { handlers } = route(name);
    assert.deepEqual(await (await handlers.GET(req)).json(), name === 'baby' ? null : []);
    t.mock.method(console, 'error', () => {});
    const failing = route(name, async () => { throw new Error('offline'); });
    assert.equal((await failing.handlers.GET(req)).status, 500);
  });
}

test('meal deletion and reversed empty ranges retain their existing behavior', async () => {
  const { handlers, calls } = route('meals');
  assert.equal((await handlers.PUT(request({ date: '2026-09-09', slot: 'evening', ingredients: [] }))).status, 200);
  assert.match(calls[0].query, /DELETE FROM meal_plans/);
  assert.equal((await handlers.GET(new Request('http://localhost/?start=2026-09-09&end=2026-09-01'))).status, 200);
});

test('malformed dates, enum values and nested ingredient objects are rejected', async () => {
  const { handlers, calls } = route('meals');
  const body = { date: '2026-09-09', slot: 'morning', ingredients: [] };
  for (const invalid of [
    { ...body, date: '2026-02-30' }, { ...body, slot: 'night' },
    { ...body, ingredients: [null] }, { ...body, ingredients: [{ name: 'x', type: {} }] },
    { ...body, note: {} },
  ]) assert.equal((await handlers.PUT(request(invalid))).status, 400);
  assert.equal((await handlers.GET(new Request('http://localhost/?start=bad&end=2026-01-01'))).status, 400);
  assert.equal(calls.length, 0);
});

test('fridge rejects invalid IDs and counts but accepts explicit deletion', async () => {
  const { handlers, calls } = route('fridge/[id]');
  for (const id of ['0', '-1', 'bad', '2147483648']) {
    assert.equal((await handlers.PATCH(request({ count: 1 }), { params: Promise.resolve({ id }) })).status, 400);
  }
  for (const count of [-1, 0.5, '2', null, 2147483648]) {
    assert.equal((await handlers.PATCH(request({ count }), context)).status, 400);
  }
  assert.equal(calls.length, 0);
  assert.equal((await handlers.PATCH(request({ delete: true }), context)).status, 200);
  assert.match(calls[0].query, /DELETE/);
});

test('allergy completion, addition and unknown actions preserve separate paths', async () => {
  const { handlers, calls } = route('allergy', async strings => strings.join('').includes('MAX') ? [{ max: 3 }] : [{ name: 'fixture' }]);
  assert.equal((await handlers.POST(request({ action: 'complete', id: 1 }))).status, 200);
  assert.equal(calls.length, 2);
  assert.equal((await handlers.POST(request({ action: 'add', name: 'fixture' }))).status, 200);
  assert.deepEqual(calls[3].values, ['fixture', false, 4]);
  const before = calls.length;
  assert.equal((await handlers.POST(request({ action: 'unknown' }))).status, 400);
  assert.equal(calls.length, before);
});

test('nutrition retains duplicate grain counts and distinct vegetable counts without mutating meals', () => {
  const meals = [{ ingredients: [
    { type: 'grain', name: 'grain' }, { type: 'grain', name: 'grain' },
    { type: 'protein', name: 'protein' }, { type: 'veggie', name: 'green' },
    { type: 'veggie', name: 'green' }, { type: 'fruit', name: 'fruit' },
  ] }, { ingredients: [{ type: 'veggie', name: 'orange' }] }];
  const original = structuredClone(meals);
  assert.deepEqual(countNutrition(meals), { grain: 2, protein: 1, veggie: 2, slots: 2 });
  assert.deepEqual(countNutrition([]), { grain: 0, protein: 0, veggie: 0, slots: 0 });
  assert.deepEqual(meals, original);
});

test('client API propagates network and HTTP failure and reports without exposing details', async t => {
  const { api, reportApiError } = load('components/ui.tsx');
  t.mock.method(globalThis, 'fetch', async () => Response.json({ ok: true }));
  assert.deepEqual(await api('/api/test'), { ok: true });
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 403 }));
  await assert.rejects(api('/api/test'), /403/);
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('private failure'); });
  await assert.rejects(api('/api/test'), /private failure/);
  const logs = [];
  t.mock.method(console, 'error', value => logs.push(value));
  const oldAlert = globalThis.alert;
  globalThis.alert = value => logs.push(value);
  t.after(() => { if (oldAlert) globalThis.alert = oldAlert; else delete globalThis.alert; });
  reportApiError(new Error('private failure'));
  assert.equal(logs.length, 2);
  assert.doesNotMatch(JSON.stringify(logs), /private failure/);
});
