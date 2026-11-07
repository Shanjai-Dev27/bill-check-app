// Simple full-stack Bill app - no external dependencies (Node.js 18+ built-ins only)
// Storage: Supabase (free online Postgres) when SUPABASE_URL + SUPABASE_KEY are set,
// otherwise a local bills.json file (handy for quick local testing).
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- tiny .env loader (so you don't need any package) ----
try {
  const envText = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (m && !line.trim().startsWith('#') && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch (e) { /* no .env file - fine */ }

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_KEY || '';
const USE_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_KEY);
const DB_FILE = path.join(__dirname, 'bills.json');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Same bill number typed with different case/spaces counts as the same bill
const normalize = (s) => String(s || '').trim().toLowerCase();

// ---- storage: Supabase (REST API) ----
const sbHeaders = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json'
};

async function sbAddBill(value) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/bills`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify({ bill_number: value, bill_key: normalize(value) })
  });
  if (r.status === 201) return 'created';
  if (r.status === 409) return 'duplicate'; // unique constraint on bill_key
  throw new Error(`Supabase insert failed (${r.status}): ${await r.text()}`);
}

async function sbHasBill(value) {
  const url = `${SUPABASE_URL}/rest/v1/bills?bill_key=eq.${encodeURIComponent(normalize(value))}&select=id&limit=1`;
  const r = await fetch(url, { headers: sbHeaders });
  if (!r.ok) throw new Error(`Supabase lookup failed (${r.status}): ${await r.text()}`);
  const rows = await r.json();
  return rows.length > 0;
}

// ---- storage: local JSON file (fallback) ----
function loadBills() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { return []; }
}
function fileAddBill(value) {
  const bills = loadBills();
  if (bills.some((b) => normalize(b.billNumber) === normalize(value))) return 'duplicate';
  bills.push({ billNumber: value, createdAt: new Date().toISOString() });
  fs.writeFileSync(DB_FILE, JSON.stringify(bills, null, 2));
  return 'created';
}
function fileHasBill(value) {
  return loadBills().some((b) => normalize(b.billNumber) === normalize(value));
}

// ---- unified storage API ----
const addBill = async (v) => (USE_SUPABASE ? sbAddBill(v) : fileAddBill(v));
const hasBill = async (v) => (USE_SUPABASE ? sbHasBill(v) : fileHasBill(v));

// ---- helpers ----
function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function sendFile(res, file) {
  fs.readFile(path.join(PUBLIC_DIR, file), (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(content);
  });
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e5) req.destroy();
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); } catch (e) { reject(e); }
    });
  });
}

// ---- admin password (HTTP Basic auth) ----
// If ADMIN_PASSWORD is set, the admin page and the "add bill" API ask for it.
// The browser shows its own login box; username can be anything.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest();
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return true;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) return false;
  const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  const password = decoded.slice(decoded.indexOf(':') + 1);
  return crypto.timingSafeEqual(sha(password), sha(ADMIN_PASSWORD));
}
function askLogin(res) {
  res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Bill Admin", charset="UTF-8"', 'Content-Type': 'text/plain' });
  res.end('Admin login required.');
}

// ---- server ----
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Pages
  if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/admin')) {
    if (!isAdmin(req)) return askLogin(res);
    return sendFile(res, 'admin.html');
  }
  if (req.method === 'GET' && url.pathname === '/check') return sendFile(res, 'check.html');

  // API: admin adds a bill
  if (req.method === 'POST' && url.pathname === '/api/bills') {
    if (!isAdmin(req)) return askLogin(res);
    let value;
    try {
      const { billNumber } = await readBody(req);
      value = String(billNumber || '').trim();
    } catch (e) {
      return sendJson(res, 400, { message: 'Invalid request.' });
    }
    if (!value) return sendJson(res, 400, { message: 'Bill number is required.' });

    try {
      const result = await addBill(value);
      if (result === 'duplicate') {
        return sendJson(res, 409, { message: `Bill number "${value}" is already entered.` });
      }
      return sendJson(res, 201, { message: `Bill number "${value}" saved successfully.` });
    } catch (e) {
      console.error(e.message);
      return sendJson(res, 500, { message: 'Database error. Please try again.' });
    }
  }

  // API: delivery guy checks a bill
  if (req.method === 'GET' && url.pathname === '/api/bills/check') {
    const value = String(url.searchParams.get('billNumber') || '').trim();
    if (!value) return sendJson(res, 400, { message: 'Bill number is required.' });
    try {
      const found = await hasBill(value);
      return sendJson(res, 200, found
        ? { paid: true, message: 'Paid' }
        : { paid: false, message: 'Not paid (bill number not found)' });
    } catch (e) {
      console.error(e.message);
      return sendJson(res, 500, { message: 'Database error. Please try again.' });
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Bill app running on http://localhost:${PORT}`);
  console.log(`  Storage:       ${USE_SUPABASE ? 'Supabase (online database)' : 'local bills.json file'}`);
  console.log(`  Admin login:   ${ADMIN_PASSWORD ? 'password required' : 'OFF (set ADMIN_PASSWORD before going online!)'}`);
  console.log(`  Admin page:    http://localhost:${PORT}/admin`);
  console.log(`  Delivery page: http://localhost:${PORT}/check`);
});
