// Serwer powiadomień Web Push dla Dziennika Auta. Lekka, osobna usługa: nasłuchuje tylko na 127.0.0.1.
// Zasada: serwer NIE zna aplikacji ani danych auta. Telefon wysyła mu gotowy harmonogram („o tej chwili pokaż ten tekst”),
// a serwer o właściwej porze wysyła push przez Apple/Google wyłącznie na subskrypcję tego telefonu.
// Każdy telefon ma własny losowy identyfikator i własny token (serwer trzyma tylko jego skrót), więc nikt nie zobaczy
// ani nie wywoła cudzych powiadomień. Rejestracja jest otwarta (aplikację można komuś udostępnić bez żadnych kodów),
// ale ograniczona limitami i listą dozwolonych serwerów push (ochrona przed nadużyciem).
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import webpush from 'web-push';

const cfg = {
  port: +(process.env.PORT || 8794),
  host: process.env.HOST || '127.0.0.1',
  dataFile: process.env.DATA_FILE || '/opt/auta-push/data/db.json',
  vapidPublic: process.env.VAPID_PUBLIC || '',
  vapidPrivate: process.env.VAPID_PRIVATE || '',
  subject: process.env.VAPID_SUBJECT || 'https://lewym90.github.io/dziennik_auta/',
  origin: process.env.ALLOW_ORIGIN || 'https://lewym90.github.io',
  setupCode: process.env.SETUP_CODE || '',               // opcjonalny: jeśli ustawiony, rejestracja nowych telefonów wymaga kodu
  maxDevices: +(process.env.MAX_DEVICES || 500),
  maxItems: +(process.env.MAX_ITEMS || 300),              // maks. powiadomień w harmonogramie jednego telefonu
  horizonMs: +(process.env.HORIZON_DAYS || 460) * 864e5,  // jak daleko w przyszłość wolno planować
  lateMs: +(process.env.LATE_MS || 6 * 3600e3),           // spóźnione ponad to (np. po awarii serwera) jest pomijane
  tickMs: +(process.env.TICK_MS || 30000),
  idleMs: +(process.env.IDLE_DAYS || 200) * 864e5,        // telefon, który nie odzywał się tak długo, jest usuwany
  dailyCap: +(process.env.DAILY_CAP || 25),               // maks. wysłanych push na telefon na dobę
  extraHosts: (process.env.EXTRA_PUSH_HOSTS || '').split(',').map((s) => s.trim()).filter(Boolean), // tylko do testów
};

export const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const log = (...a) => console.log(new Date().toISOString(), ...a);

// ---------- Magazyn (plik JSON, zapis atomowy) ----------
let db = { devices: {} };
export function loadDb(file = cfg.dataFile) {
  try { db = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { db = { devices: {} }; }
  db.devices ||= {};
  return db;
}
let dirty = false;
export function saveDb(file = cfg.dataFile) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db), { mode: 0o600 });
  fs.renameSync(tmp, file);
  dirty = false;
}
const touch = () => { dirty = true; };
export const getDb = () => db;

// ---------- Walidacja ----------
// Serwer wysyła żądania pod adres z subskrypcji, więc dopuszczamy wyłącznie prawdziwe usługi push przeglądarek.
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^updates-autopush\.(stage|dev)\.mozaws\.net$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/];
export function allowedEndpoint(ep) {
  try {
    const u = new URL(ep);
    if (u.protocol !== 'https:' || u.port || u.username || u.password) return false;
    return PUSH_HOSTS.some((r) => r.test(u.hostname)) || cfg.extraHosts.includes(u.hostname);
  } catch (_) { return false; }
}
const validSub = (s) => s && typeof s.endpoint === 'string' && s.endpoint.length < 600 && allowedEndpoint(s.endpoint)
  && s.keys && typeof s.keys.p256dh === 'string' && s.keys.p256dh.length < 200 && typeof s.keys.auth === 'string' && s.keys.auth.length < 100;
const validId = (s) => typeof s === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(s);
const str = (v, n) => String(v == null ? '' : v).slice(0, n);

// Czyści harmonogram z telefonu: tylko poprawne, przyszłe (lub świeżo spóźnione) wpisy, bez duplikatów.
export function cleanSchedule(list, now = Date.now()) {
  if (!Array.isArray(list)) return null;
  const out = [], seen = new Set();
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const at = Math.round(+it.at);
    if (!Number.isFinite(at) || at < now - cfg.lateMs || at > now + cfg.horizonMs) continue;
    const id = str(it.id, 80) || `${at}`;
    if (seen.has(id)) continue; seen.add(id);
    const url = typeof it.url === 'string' && /^\.\/[\w?=&#./-]{0,80}$/.test(it.url) ? it.url : './?tab=reminders';
    out.push({ id, at, title: str(it.title, 100) || 'Dziennik Auta', body: str(it.body, 240), tag: str(it.tag, 60) || 'auta', url });
    if (out.length >= cfg.maxItems) break;
  }
  return out.sort((a, b) => a.at - b.at);
}

// ---------- Wysyłka ----------
export let sender = (sub, payload, opts) => webpush.sendNotification(sub, payload, opts);
export const setSender = (f) => { sender = f; };

export async function sendTo(id, dev, n, now = Date.now()) {
  const day = Math.floor(now / 864e5);
  if (dev.day !== day) { dev.day = day; dev.sentToday = 0; }
  if (dev.sentToday >= cfg.dailyCap) { log(`limit dobowy dla ${id.slice(0, 6)}`); return false; }
  dev.sentToday++;
  const payload = JSON.stringify({ title: n.title || 'Dziennik Auta', body: n.body || '', tag: n.tag || 'auta', url: n.url || './?tab=reminders' });
  try {
    await sender(dev.sub, payload, { TTL: 6 * 3600, urgency: 'normal', vapidDetails: { subject: cfg.subject, publicKey: cfg.vapidPublic, privateKey: cfg.vapidPrivate } });
    log(`wysłano do ${id.slice(0, 6)} (${(n.tag || '').slice(0, 12)})`);
    return true;
  } catch (e) {
    if (e.statusCode === 404 || e.statusCode === 410) { delete db.devices[id]; log(`urządzenie ${id.slice(0, 6)} wygasło (${e.statusCode}) – usunięto`); }
    else log(`błąd wysyłki ${e.statusCode || ''} ${e.message || e}`);
    touch();
    return false;
  }
}

// Co tyknięcie: wyślij wszystko, co już przypada; spóźnione ponad lateMs pomiń; sprzątnij nieaktywne telefony.
export async function runDue(now = Date.now()) {
  let sent = 0;
  for (const [id, dev] of Object.entries(db.devices)) {
    if (now - (dev.seen || dev.created || now) > cfg.idleMs) { delete db.devices[id]; touch(); log(`usunięto nieaktywny ${id.slice(0, 6)}`); continue; }
    const items = dev.items || [];
    const due = items.filter((it) => it.at <= now);
    if (!due.length) continue;
    dev.items = items.filter((it) => it.at > now); touch();   // najpierw zdejmujemy z listy, żeby nic nie poszło dwa razy
    for (const it of due) {
      if (it.at < now - cfg.lateMs) continue;
      if (!db.devices[id]) break;
      if (await sendTo(id, dev, it, now)) sent++;
    }
  }
  if (dirty) saveDb();
  return sent;
}

// ---------- Limity zapytań ----------
const hits = new Map();
const limited = (ip, kind, max) => {
  const m = Math.floor(Date.now() / 60000), k = `${kind}:${ip}:${m}`;
  hits.set(k, (hits.get(k) || 0) + 1);
  if (hits.size > 5000) for (const x of hits.keys()) if (!x.endsWith(`:${m}`)) hits.delete(x);
  return hits.get(k) > max;
};
const regHits = new Map();
const regLimited = (ip, now) => {
  const h = Math.floor(now / 3600e3), k = `${ip}:${h}`;
  regHits.set(k, (regHits.get(k) || 0) + 1);
  if (regHits.size > 2000) for (const x of regHits.keys()) if (!x.endsWith(`:${h}`)) regHits.delete(x);
  return regHits.get(k) > 12;     // maks. 12 nowych rejestracji z jednego adresu na godzinę
};

function readBody(req, max = 120_000) {
  return new Promise((resolve, reject) => {
    let n = 0; const chunks = [];
    req.on('data', (c) => { n += c.length; if (n > max) { reject(Object.assign(new Error('za duże'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); } catch (_) { reject(Object.assign(new Error('zły JSON'), { code: 400 })); } });
    req.on('error', reject);
  });
}

// ---------- Trasy ----------
export async function handle(method, url, headers, body, now = Date.now(), ip = '') {
  const route = url.split('?')[0].replace(/\/+$/, '') || '/';
  if (method === 'GET' && route === '/health') return [200, { ok: true, devices: Object.keys(db.devices).length }];
  if (method === 'GET' && route === '/vapid') return [200, { publicKey: cfg.vapidPublic }];
  if (method !== 'POST') return [404, { error: 'nie znaleziono' }];
  const auth = (headers.authorization || '').replace(/^Bearer\s+/i, '');
  const { deviceId } = body || {};

  if (route === '/register') {
    const { subscription, setup } = body || {};
    if (!validId(deviceId)) return [400, { error: 'nieprawidłowy identyfikator' }];
    if (!validSub(subscription)) return [400, { error: 'nieprawidłowa subskrypcja push' }];
    const dev = db.devices[deviceId];
    if (dev) {                                   // ten sam telefon odnawia subskrypcję: wymaga własnego tokenu
      if (!auth || !safeEq(sha(auth), dev.tokenHash)) return [401, { error: 'brak uprawnień' }];
      dev.sub = subscription; dev.seen = now; touch(); saveDb();
      return [200, { ok: true, items: (dev.items || []).length }];
    }
    if (cfg.setupCode && !(typeof setup === 'string' && safeEq(setup, cfg.setupCode))) return [401, { error: 'zły kod połączenia' }];
    if (regLimited(ip, now)) return [429, { error: 'za dużo rejestracji, spróbuj za godzinę' }];
    if (Object.keys(db.devices).length >= cfg.maxDevices) return [403, { error: 'serwer osiągnął limit urządzeń' }];
    const token = crypto.randomBytes(24).toString('base64url');
    db.devices[deviceId] = { tokenHash: sha(token), sub: subscription, created: now, seen: now, items: [] };
    touch(); saveDb();
    return [200, { ok: true, token }];
  }

  const dev = validId(deviceId) ? db.devices[deviceId] : null;
  if (!dev || !auth || !safeEq(sha(auth), dev.tokenHash)) return [401, { error: 'brak uprawnień' }];
  dev.seen = now;

  if (route === '/sync') {                        // telefon zastępuje cały swój harmonogram
    const items = cleanSchedule(body.items, now);
    if (!items) return [400, { error: 'zły harmonogram' }];
    dev.items = items; touch(); saveDb();
    return [200, { ok: true, items: items.length, next: items.length ? items[0].at : null }];
  }
  if (route === '/test') {
    const ok = await sendTo(deviceId, dev, { title: 'Dziennik Auta', body: 'Działa. Tak będą wyglądać Twoje przypomnienia o terminach.', tag: 'auta-test' }, now);
    if (dirty) saveDb();
    return [ok ? 200 : 502, { ok }];
  }
  if (route === '/unsubscribe') { delete db.devices[deviceId]; touch(); saveDb(); return [200, { ok: true }]; }
  return [404, { error: 'nie znaleziono' }];
}

export function createServer() {
  return http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const cors = { 'Access-Control-Allow-Origin': origin && origin === cfg.origin ? origin : cfg.origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Max-Age': '86400', Vary: 'Origin' };
    const send = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors }); res.end(JSON.stringify(obj)); };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    if (limited(ip, 'all', 120)) return send(429, { error: 'za dużo żądań' });
    try {
      const body = req.method === 'POST' ? await readBody(req) : {};
      const [code, obj] = await handle(req.method, req.url, req.headers, body, Date.now(), ip);
      send(code, obj);
    } catch (e) { send(e.code === 413 || e.code === 400 ? e.code : 500, { error: e.message || 'błąd' }); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!cfg.vapidPublic || !cfg.vapidPrivate) { console.error('Brak VAPID_PUBLIC / VAPID_PRIVATE w środowisku.'); process.exit(1); }
  loadDb();
  const srv = createServer();
  srv.listen(cfg.port, cfg.host, () => log(`Dziennik Auta push: ${cfg.host}:${cfg.port}, urządzeń: ${Object.keys(db.devices).length}`));
  setInterval(() => { runDue().catch((e) => log('tick', e.message)); }, cfg.tickMs);
  const bye = () => { try { if (dirty) saveDb(); } catch (_) { /* nic */ } process.exit(0); };
  process.on('SIGTERM', bye); process.on('SIGINT', bye);
}
