import http from 'node:http';
import next from 'next';

// This harness never forwards API traffic to the production database.
process.env.DATABASE_URL = 'postgresql://fixture:fixture@127.0.0.1:1/disabled';
const app = next({ dev: false, hostname: '127.0.0.1', port: 3198 });
const handle = app.getRequestHandler();
const state = {
  baby: { name: '검증용 아기', birth_date: '2026-01-01', start_date: '2026-07-01', stage: '중기', weight: 8 },
  growth: [], fridge: [], allergy: [], meals: [], ingredients: [],
  fail: false, delay: 0, mutations: 0,
};
const json = (res, status, value) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(value));
};
await app.prepare();
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1:3198');
  if (url.pathname === '/__test/control') {
    if (url.searchParams.has('fail')) state.fail = url.searchParams.get('fail') === 'true';
    if (url.searchParams.has('delay')) state.delay = Number(url.searchParams.get('delay'));
    return json(res, 200, { mutations: state.mutations, fail: state.fail, delay: state.delay });
  }
  if (url.pathname.startsWith('/api/')) {
    const key = url.pathname.slice(5);
    if (!Object.hasOwn(state, key)) return json(res, 404, { error: 'Unknown fixture endpoint' });
    if (req.method === 'GET') return json(res, 200, state[key]);
    state.mutations++;
    await new Promise(resolve => setTimeout(resolve, state.delay));
    if (state.fail) return json(res, 500, { error: 'Fixture save failure' });
    let body = '';
    for await (const chunk of req) body += chunk;
    let input;
    try { input = JSON.parse(body); } catch { return json(res, 400, { error: 'Invalid JSON' }); }
    if (key === 'baby' && req.method === 'PUT') {
      if (!input.name?.trim()) return json(res, 400, { error: 'Name is required' });
      state.baby = input;
    } else if (key === 'growth' && req.method === 'POST') {
      if (!input.date || !(input.weight > 0)) return json(res, 400, { error: 'Invalid growth input' });
      state.growth.push({ ...input, id: state.growth.length + 1 });
    } else return json(res, 405, { error: 'Unsupported fixture mutation' });
    return json(res, 200, { ok: true });
  }
  await handle(req, res);
}).listen(3198, '127.0.0.1', () => console.log('Fixture browser server: http://127.0.0.1:3198'));
