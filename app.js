/* =====================================================================
   Dziennik Auta — aplikacja PWA (bez zależności, działa offline)
   Dane przechowywane lokalnie w przeglądarce (localStorage).
   ===================================================================== */
(() => {
'use strict';

const APP_VER = '1.0.0';
const KEY = 'dziennik-auta:v1';

/* ---------- narzędzia ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const nf = d => new Intl.NumberFormat('pl-PL', { minimumFractionDigits: d, maximumFractionDigits: d });
const N0 = nf(0), N1 = nf(1), N2 = nf(2);
const PLN = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
const PLN0 = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });
const money = x => PLN.format(x || 0);
const money0 = x => PLN0.format(x || 0);
const kmf = n => N0.format(n || 0) + ' km';
const num = v => { const x = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(x) ? x : NaN; };
const sum = (a, k) => a.reduce((s, x) => s + (+x[k] || 0), 0);
const plural = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) ? b : c;
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => iso(new Date());
const P = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const dayDiff = (a, b) => Math.round((P(b) - P(a)) / 864e5);
const addDays = (s, n) => { const d = P(s); d.setDate(d.getDate() + n); return iso(d); };
const addMonths = (s, n) => {
  const d = P(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate())); return iso(d);
};
const fmtD = s => s ? P(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const fmtDs = s => s ? P(s).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '';
const fmtM = s => P(s + '-01').toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });
const rel = n => n === 0 ? 'dziś' : n === 1 ? 'jutro' : n === -1 ? 'wczoraj' : n > 0 ? `za ${n} ${plural(n, 'dzień', 'dni', 'dni')}` : `${-n} ${plural(-n, 'dzień', 'dni', 'dni')} temu`;
const lum = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const vibrate = (p = 8) => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) {} };

/* ---------- ikony (zestaw w stylu Lucide, stroke) ---------- */
const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  fuel: '<path d="M3 22V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v17"/><path d="M2 22h14"/><path d="M6 8h6"/><path d="M15 12h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0V9l-3-3"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  clip: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  gauge: '<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  cal: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  chev: '<path d="m9 18 6-6-6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8M16 13H8M16 17H8"/>',
  trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  trend: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  tire: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/>',
  link: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  alert: '<path d="m21.7 18-8-14a2 2 0 0 0-3.5 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3z"/><path d="M12 9v4M12 17h.01"/>',
  calc: '<rect width="16" height="20" x="4" y="2" rx="2"/><path d="M8 6h8M16 14v4M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01"/>',
  share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  buoy: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><path d="m4.9 4.9 4.3 4.3M14.8 14.8l4.3 4.3M14.8 9.2l4.3-4.3M4.9 19.1l4.3-4.3"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  star: '<path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3L8 14.2l-5-4.9 6.9-1z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/><path d="M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  road: '<path d="M4 19 8 3M20 19 16 3M12 4v3M12 11v3M12 18v2"/>',
  tag: '<path d="M12.6 2.6a2 2 0 0 0-1.4-.6H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".5"/>',
};
const ic = (n, s = 20) => `<svg class="i" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n] || ''}</svg>`;

/* ---------- słowniki ---------- */
const FUELS = {
  pb95: { l: 'Benzyna 95', s: 'Pb95', u: 'l', c: '#34d399' },
  pb98: { l: 'Benzyna 98', s: 'Pb98', u: 'l', c: '#2dd4bf' },
  on:   { l: 'Diesel', s: 'ON', u: 'l', c: '#fbbf24' },
  lpg:  { l: 'LPG', s: 'LPG', u: 'l', c: '#60a5fa' },
  ev:   { l: 'Prąd (EV)', s: 'EV', u: 'kWh', c: '#a78bfa' },
};
const SVT = {
  olej:          { l: 'Wymiana oleju', i: 'drop', c: '#fbbf24', ph: 'np. olej 5W-30 + filtry' },
  przeglad:      { l: 'Przegląd serwisowy', i: 'wrench', c: '#a78bfa', ph: 'np. przegląd 120 tys. km' },
  naprawa:       { l: 'Naprawa', i: 'wrench', c: '#fb7185', ph: 'np. klocki i tarcze hamulcowe' },
  opony:         { l: 'Opony', i: 'tire', c: '#60a5fa', ph: 'np. wymiana na zimowe' },
  badanie:       { l: 'Badanie techniczne', i: 'clip', c: '#34d399', ph: 'Okresowe badanie techniczne' },
  ubezpieczenie: { l: 'Ubezpieczenie', i: 'shield', c: '#2dd4bf', ph: 'np. OC/AC – składka roczna' },
  myjnia:        { l: 'Myjnia i detailing', i: 'spark', c: '#f472b6', ph: 'np. mycie + woskowanie' },
  inne:          { l: 'Inne', i: 'tag', c: '#94a3b8', ph: 'Opis wydatku' },
};
const RT = {
  oc:         { l: 'OC', i: 'shield', m: 12, svc: 'ubezpieczenie', ph: 'Ubezpieczyciel, nr polisy', c: '#34d399' },
  przeglad:   { l: 'Przegląd techniczny', i: 'clip', m: 12, svc: 'badanie', ph: 'Stacja kontroli pojazdów', c: '#22d3ee' },
  olej:       { l: 'Wymiana oleju', i: 'drop', m: 12, km: 15000, svc: 'olej', ph: 'Rodzaj oleju, warsztat', c: '#fbbf24' },
  ac:         { l: 'AC / NNW', i: 'shield', m: 12, svc: 'ubezpieczenie', ph: 'Ubezpieczyciel, nr polisy', c: '#2dd4bf' },
  assistance: { l: 'Assistance', i: 'buoy', m: 12, svc: 'ubezpieczenie', ph: 'Wariant, nr telefonu', c: '#60a5fa' },
  opony:      { l: 'Wymiana opon', i: 'tire', m: 6, svc: 'opony', ph: 'Zimowe / letnie', c: '#818cf8' },
  rozrzad:    { l: 'Rozrząd', i: 'timer', m: 60, km: 120000, svc: 'naprawa', ph: 'Zestaw, pompa wody…', c: '#f472b6' },
  inne:       { l: 'Własny termin', i: 'star', m: 0, svc: 'inne', ph: 'Notatka', c: '#a78bfa' },
};
const COLORS = ['#6d4aff', '#0ea5e9', '#10b981', '#f43f5e', '#f59e0b', '#ec4899', '#64748b', '#14b8a6'];
const STATIONS = ['Orlen', 'BP', 'Shell', 'Circle K', 'MOL', 'Moya', 'Amic', 'Auchan', 'Carrefour', 'Intermarché', 'Lidl (ładowarka)', 'GreenWay', 'Tauron (ładowarka)'];

/* ---------- stan ---------- */
const DEF = () => ({ v: 1, vehicles: [], fuels: [], services: [], reminders: [], active: null, notified: {}, settings: { theme: 'auto', lead: 30, notif: false, hideInstall: false } });
let S = load();
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    if (r && r.v) { const d = DEF(); return { ...d, ...r, settings: { ...d.settings, ...(r.settings || {}) } }; }
  } catch (e) {}
  return DEF();
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast('Brak miejsca w pamięci urządzenia'); } }
const ui = { tab: 'home', period: 'y', all: false, svcF: 'all', svcQ: '', rp: { costs: true, fuel: true } };
let deferredInstall = null;

const veh = () => S.vehicles.find(v => v.id === S.active) || S.vehicles[0];
const vById = id => S.vehicles.find(v => v.id === id);
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
function curOdo(id) {
  const v = vById(id); let m = v ? (+v.odo || 0) : 0;
  for (const a of S.fuels) if (a.vid === id && a.odo > m) m = a.odo;
  for (const a of S.services) if (a.vid === id && a.odo > m) m = a.odo;
  return m;
}
function bumpOdo(id, odo) { const v = vById(id); if (v && odo > (+v.odo || 0)) v.odo = odo; }

/* ---------- obliczenia: paliwo ---------- */
function fuelCalc(vid) {
  const list = S.fuels.filter(f => f.vid === vid).sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  const res = {}, st = {};
  for (const f of list) {
    const t = f.ft || 'pb95', s = st[t] || (st[t] = { prev: null, acc: 0, cost: 0 });
    if (s.prev === null) { if (f.full) { s.prev = f.odo; s.acc = 0; s.cost = 0; } continue; }
    s.acc += f.liters; s.cost += f.total;
    if (f.full) {
      const km = f.odo - s.prev;
      if (km > 0) { const c = s.acc / km * 100; if (c > .5 && c < 90) res[f.id] = { cons: c, km, liters: s.acc, cost: s.cost, t }; }
      s.prev = f.odo; s.acc = 0; s.cost = 0;
    }
  }
  return { list, res };
}
function stats(vid, p) {
  const from = p === 'm' ? addMonths(today(), -1) : p === 'y' ? addMonths(today(), -12) : '';
  const inP = x => !from || x.date >= from;
  const { list, res } = fuelCalc(vid);
  const fl = list.filter(inP), sv = S.services.filter(x => x.vid === vid && inP(x));
  const fuelCost = sum(fl, 'total'), svcCost = sum(sv, 'cost');
  const byT = {};
  for (const f of fl) { const r = res[f.id]; if (!r) continue; const b = byT[r.t] || (byT[r.t] = { l: 0, km: 0, n: 0 }); b.l += r.liters; b.km += r.km; b.n++; }
  const avg = {}; for (const t in byT) avg[t] = byT[t].l / byT[t].km * 100;
  const types = Object.keys(avg).sort((a, b) => byT[b].n - byT[a].n);
  const primary = types[0] || null;
  const pf = primary ? fl.filter(f => (f.ft || 'pb95') === primary) : [];
  const avgPrice = pf.length && sum(pf, 'liters') ? sum(pf, 'total') / sum(pf, 'liters') : null;
  const odos = [...fl, ...sv].map(x => x.odo).filter(Boolean);
  const kmRange = odos.length > 1 ? Math.max(...odos) - Math.min(...odos) : 0;
  return { from, fl, sv, fuelCost, svcCost, total: fuelCost + svcCost, avg, types, primary, avgPrice, kmRange, costKm: kmRange >= 100 ? (fuelCost + svcCost) / kmRange : null };
}
function monthly(vid, n = 6) {
  const out = [], t = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
    out.push({ k: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, label: d.toLocaleDateString('pl-PL', { month: 'short' }).replace('.', ''), fuel: 0, svc: 0 });
  }
  for (const f of S.fuels) if (f.vid === vid) { const b = out.find(o => o.k === f.date.slice(0, 7)); if (b) b.fuel += f.total; }
  for (const f of S.services) if (f.vid === vid) { const b = out.find(o => o.k === f.date.slice(0, 7)); if (b) b.svc += f.cost || 0; }
  return out;
}

/* ---------- obliczenia: terminy ---------- */
function remTitle(r) { const t = RT[r.type] || RT.inne; return r.type === 'inne' ? (r.title || t.l) : (r.title || t.l); }
function remInfo(r) {
  const odo = curOdo(r.vid), L = S.settings.lead;
  let days = null, km = null; const cand = [];
  if (r.dueDate) { days = dayDiff(today(), r.dueDate); cand.push({ f: days / Math.max(30, (r.everyMonths || 12) * 30.4), k: 'd' }); }
  if (r.dueKm) { km = r.dueKm - odo; cand.push({ f: km / (r.everyKm || 15000), k: 'k' }); }
  if (!cand.length) return { level: 'none', frac: 0, main: '—', unit: '', text: 'Ustaw termin', sub: 'Brak daty', sort: 9e9, days, km };
  cand.sort((a, b) => a.f - b.f);
  const m = cand[0];
  let level = 'ok';
  if ((days !== null && days < 0) || (km !== null && km < 0)) level = 'bad';
  else if ((days !== null && days <= L) || (km !== null && km <= 1500)) level = 'warn';
  let main, unit, text;
  if (m.k === 'd') {
    const a = Math.abs(days); main = a; unit = plural(a, 'dzień', 'dni', 'dni');
    text = days < 0 ? `Po terminie o ${a} ${plural(a, 'dzień', 'dni', 'dni')}` : days === 0 ? 'Termin mija dziś' : `Zostało ${a} ${plural(a, 'dzień', 'dni', 'dni')}`;
  } else {
    const a = Math.abs(km); main = a >= 10000 ? N0.format(Math.round(a / 1000)) + 'k' : N0.format(a); unit = 'km';
    text = km < 0 ? `Przekroczono o ${N0.format(a)} km` : `Zostało ${N0.format(a)} km`;
  }
  const subs = [];
  if (r.dueDate) subs.push('do ' + fmtD(r.dueDate));
  if (r.dueKm) subs.push((m.k === 'k' || !r.dueDate ? '' : 'lub ') + 'przy ' + N0.format(r.dueKm) + ' km');
  return { level, frac: level === 'bad' ? 1 : clamp(m.f, 0.03, 1), main, unit, text, sub: subs.join(' · '), sort: m.f, days, km };
}
const lvCol = l => ({ ok: 'var(--ok)', warn: 'var(--warn)', bad: 'var(--bad)', none: 'var(--faint)' }[l]);
function attention() { return S.reminders.filter(r => { const l = remInfo(r).level; return l === 'warn' || l === 'bad'; }); }

/* ---------- wykresy SVG ---------- */
function smooth(p) {
  if (p.length < 2) return '';
  let d = `M${p[0][0].toFixed(1)},${p[0][1].toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2, t = .18;
    const c1 = [p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t], c2 = [p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}
function barChart(data) {
  const W = 340, H = 180, pl = 6, pb = 24, pt = 22, n = data.length, bw = 34;
  const max = Math.max(1, ...data.map(d => d.fuel + d.svc));
  const gap = (W - pl * 2 - n * bw) / (n - 1), ch = H - pb - pt;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Koszty w ostatnich miesiącach"><defs>
    <linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#0ea5c6"/></linearGradient>
    <linearGradient id="gs" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4b5fd"/><stop offset="1" stop-color="#7c5cff"/></linearGradient></defs>`;
  for (let i = 0; i <= 3; i++) { const y = pt + ch * i / 3; s += `<line class="grid" x1="0" x2="${W}" y1="${y}" y2="${y}"/>`; }
  data.forEach((d, i) => {
    const x = pl + i * (bw + gap), tot = d.fuel + d.svc, h = tot / max * ch, y0 = pt + ch - h, hf = d.fuel / max * ch;
    s += `<clipPath id="cb${i}"><rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(h, 0.01)}" rx="9"/></clipPath>`;
    if (tot > 0) {
      s += `<g class="bar" style="--k:${i}" clip-path="url(#cb${i})"><rect x="${x}" y="${y0}" width="${bw}" height="${h}" fill="url(#gs)"/><rect x="${x}" y="${pt + ch - hf}" width="${bw}" height="${hf}" fill="url(#gf)"/></g>`;
      s += `<text x="${x + bw / 2}" y="${y0 - 6}" text-anchor="middle">${N0.format(Math.round(tot))}</text>`;
    } else s += `<rect x="${x}" y="${pt + ch - 3}" width="${bw}" height="3" rx="1.5" fill="var(--line)"/>`;
    s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${esc(d.label)}</text>`;
  });
  return s + '</svg>';
}
function lineChart(pts, avg, unit) {
  if (pts.length < 2) return `<div class="note" style="padding:18px 0 6px;text-align:center">Dodaj co najmniej dwa tankowania „do pełna”, aby zobaczyć wykres spalania.</div>`;
  const W = 340, H = 150, pl = 8, pr = 8, pt = 22, pb = 22;
  const vals = pts.map(p => p.v), lo = Math.min(...vals, avg) , hi = Math.max(...vals, avg), span = Math.max(.6, hi - lo);
  const y0 = lo - span * .25, y1 = hi + span * .25;
  const X = i => pl + (W - pl - pr) * i / (pts.length - 1), Y = v => pt + (H - pt - pb) * (1 - (v - y0) / (y1 - y0));
  const xy = pts.map((p, i) => [X(i), Y(p.v)]);
  const d = smooth(xy), area = d + `L${X(pts.length - 1)},${H - pb} L${X(0)},${H - pb}Z`;
  let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Spalanie w czasie"><defs>
    <linearGradient id="la" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee" stop-opacity=".38"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></linearGradient>
    <linearGradient id="ll" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs>`;
  const ya = Y(avg);
  s += `<line class="grid" x1="0" x2="${W}" y1="${ya}" y2="${ya}" stroke-dasharray="4 4" style="stroke:var(--faint)"/><text x="${W}" y="${ya - 5}" text-anchor="end">śr. ${N1.format(avg)}</text>`;
  s += `<path class="area" d="${area}" fill="url(#la)"/><path class="line" pathLength="1" d="${d}" fill="none" stroke="url(#ll)" stroke-width="3.2" stroke-linecap="round"/>`;
  xy.forEach((p, i) => { const last = i === xy.length - 1; s += `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="${last ? 5.5 : 3}" fill="${last ? '#22d3ee' : 'var(--bg2)'}" stroke="#22d3ee" stroke-width="2"/>`; });
  const lp = xy[xy.length - 1];
  s += `<text x="${Math.min(lp[0], W - 14)}" y="${lp[1] - 11}" text-anchor="middle" style="fill:var(--text);font-weight:800;font-size:12px">${N1.format(pts[pts.length - 1].v)}</text>`;
  s += `<text x="${pl}" y="${H - 5}">${fmtDs(pts[0].d)}</text><text x="${W - pr}" y="${H - 5}" text-anchor="end">${fmtDs(pts[pts.length - 1].d)}</text>`;
  return s + '</svg>';
}
function donut(items) {
  const tot = sum(items, 'v'); if (!tot) return '';
  const r = 50, c = 2 * Math.PI * r; let off = 0;
  let segs = '';
  items.forEach((it, i) => {
    const len = it.v / tot * c, gap = items.length > 1 ? 3 : 0;
    segs += `<circle class="seg-c" style="--k:${i}" cx="70" cy="70" r="${r}" stroke="${it.c}" stroke-linecap="round" stroke-dasharray="${Math.max(len - gap, .1)} ${c}" stroke-dashoffset="${-off}"/>`;
    off += len;
  });
  const leg = items.map(it => `<div style="--c:${it.c}"><i></i><span>${esc(it.l)}</span><b>${Math.round(it.v / tot * 100)}%</b></div>`).join('');
  return `<div class="donut-wrap"><svg class="donut" viewBox="0 0 140 140"><g transform="rotate(-90 70 70)"><circle cx="70" cy="70" r="${r}" stroke="var(--line)"/>${segs}</g>
    <text x="70" y="68" text-anchor="middle" style="fill:var(--text);font-size:17px;font-weight:800">${money0(tot)}</text><text x="70" y="84" text-anchor="middle" style="fill:var(--muted);font-size:10px;font-weight:600">łącznie</text></svg><div class="dl">${leg}</div></div>`;
}
function ringSVG(info, size = 88) {
  const r = size / 2 - 8, c = +(2 * Math.PI * r).toFixed(1), o = +(c * (1 - info.frac)).toFixed(1);
  return `<div class="ring" style="--c:${c};--o:${o}"><svg viewBox="0 0 ${size} ${size}"><circle class="bg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="7"/><circle class="fg" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="7"/></svg>
    <div class="mid">${info.level === 'none' ? `<span class="ico" style="all:unset;color:var(--faint)">${ic('plus', 22)}</span>` : `<b class="num">${info.main}</b><small>${info.unit}</small>`}</div></div>`;
}
const logoSVG = (s = 96) => `<svg class="logo" viewBox="0 0 120 120" width="${s}" height="${s}"><defs><linearGradient id="lgx" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7c5cff"/><stop offset="1" stop-color="#22d3ee"/></linearGradient></defs><rect width="120" height="120" rx="28" fill="url(#lgx)"/><path d="M28 82a36 36 0 1 1 64 0" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round"/><path d="M60 66 78 44" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="60" cy="66" r="9" fill="#fff"/><circle cx="60" cy="66" r="3.6" fill="#6d64f5"/><circle cx="44" cy="96" r="4.2" fill="#fff"/><circle cx="76" cy="96" r="4.2" fill="#fff"/><rect x="50" y="93.5" width="20" height="5" rx="2.5" fill="#fff"/></svg>`;
const carSVG = `<svg class="hero-car" viewBox="0 0 320 130" fill="none"><path d="M16 92c0-9 5-15 14-17l40-10c9-9 24-29 44-33 19-4 52-4 72 0 20 4 40 22 51 33l37 7c15 3 24 9 24 22v8c0 5-4 9-9 9h-15a30 30 0 0 0-60 0H120a30 30 0 0 0-60 0H26c-6 0-10-4-10-9z" fill="rgba(255,255,255,.16)" stroke="rgba(255,255,255,.55)" stroke-width="2"/><path d="M96 66c8-9 18-22 32-25 14-3 38-3 54 0 14 3 28 16 38 25z" fill="rgba(255,255,255,.2)"/><path d="M158 41v25" stroke="rgba(255,255,255,.45)" stroke-width="2"/><circle cx="90" cy="101" r="19" fill="rgba(8,10,28,.55)" stroke="rgba(255,255,255,.7)" stroke-width="3"/><circle cx="90" cy="101" r="7" fill="rgba(255,255,255,.55)"/><circle cx="238" cy="101" r="19" fill="rgba(8,10,28,.55)" stroke="rgba(255,255,255,.7)" stroke-width="3"/><circle cx="238" cy="101" r="7" fill="rgba(255,255,255,.55)"/><path d="M286 82h14" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity=".9"/></svg>`;
const plateHTML = p => p ? `<span class="plate"><span class="eu"><b>PL</b></span><span class="no">${esc(p)}</span></span>` : '';

/* ---------- UI: toast, efekty, licznik ---------- */
let toastT;
function toast(msg, undo) {
  const t = $('#toast'); t.innerHTML = `<span>${esc(msg)}</span>${undo ? '<button data-act="undo">Cofnij</button>' : ''}`;
  t._undo = undo || null; t.classList.add('show'); clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), undo ? 6000 : 2800);
}
function confetti() {
  if (rm) return; const fx = $('#fx'), cols = ['#7c5cff', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#f472b6'];
  for (let i = 0; i < 42; i++) {
    const e = document.createElement('i'); e.className = 'cf';
    e.style.cssText = `--c:${cols[i % cols.length]};--x:${(Math.random() - .5) * 420}px;--y:${-120 + Math.random() * 520}px;--r:${Math.random() * 720 - 360}deg;animation-delay:${Math.random() * .15}s`;
    fx.appendChild(e); setTimeout(() => e.remove(), 1800);
  }
}
function runCounters(root) {
  if (rm) return;
  $$('.cnt', root).forEach(el => {
    const to = +el.dataset.to, dec = +(el.dataset.dec || 0), suf = el.dataset.suf || '', f = nf(dec), t0 = performance.now(), dur = 1100;
    const step = t => { const k = clamp((t - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 4); el.textContent = f.format(to * e) + suf; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
const cnt = (v, dec = 0, suf = '') => `<span class="cnt" data-to="${v}" data-dec="${dec}" data-suf="${esc(suf)}">${nf(dec).format(v)}${esc(suf)}</span>`;

/* ---------- arkusz (bottom sheet) ---------- */
let sheetOpen = false, skipPop = false;
function openSheet(title, body, mount) {
  const root = $('#sheet-root');
  if (!sheetOpen) { history.pushState({ sheet: 1 }, ''); sheetOpen = true; }
  root.classList.remove('closing'); root.classList.add('open');
  root.innerHTML = `<div class="backdrop" data-act="close"></div><div class="sheet" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="grab"></div>
    <div class="sh-head"><h2>${esc(title)}</h2><button class="icon-btn glass" data-act="close" aria-label="Zamknij">${ic('x', 18)}</button></div><div class="sh-body">${body}</div></div>`;
  const sh = $('.sheet', root); if (mount) mount(sh);
  return sh;
}
function closeSheet() {
  if (!sheetOpen) return; sheetOpen = false;
  const root = $('#sheet-root'); root.classList.add('closing');
  setTimeout(() => { if (!sheetOpen) { root.classList.remove('open', 'closing'); root.innerHTML = ''; } }, 300);
  if (history.state && history.state.sheet) { skipPop = true; history.back(); }
}
addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  if (sheetOpen) { sheetOpen = false; const root = $('#sheet-root'); root.classList.add('closing'); setTimeout(() => { root.classList.remove('open', 'closing'); root.innerHTML = ''; }, 300); }
  else if ($('#report').classList.contains('open')) closeReport();
});
addEventListener('keydown', e => { if (e.key === 'Escape') { if (sheetOpen) closeSheet(); else closeReport(); } });

/* ---------- elementy formularzy ---------- */
const fld = (label, html, cls = '') => `<label class="fld ${cls}"><span>${label}</span>${html}</label>`;
const inp = (name, val = '', attrs = '') => `<input name="${name}" value="${esc(val)}" ${attrs}>`;
const unitIn = (name, val, unit, attrs = '') => `<div class="unit">${inp(name, val, attrs)}<em>${unit}</em></div>`;
function chips(name, opts, val, wrap) {
  return `<div class="chips ${wrap ? 'wrap' : ''}" data-chips="${name}"><input type="hidden" name="${name}" value="${esc(val)}">${opts.map(o => `<button type="button" class="chip ${o.k === val ? 'on' : ''}" data-v="${o.k}" style="--tc:${o.c || 'var(--a1)'}">${o.i ? ic(o.i, 16) : ''}<span>${esc(o.l)}</span></button>`).join('')}</div>`;
}
const swtch = (name, title, desc, on) => `<label class="sw"><div><b>${title}</b>${desc ? `<span>${desc}</span>` : ''}</div><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><i></i></label>`;
const fm = form => new Proxy(form, { get: (t, k) => k === '__el' ? t : (typeof k === 'string' && t.elements && t.elements[k]) ? t.elements[k] : (typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
const formData = f => { f = f.__el || f; const o = {}; new FormData(f).forEach((v, k) => o[k] = v); $$('input[type=checkbox]', f).forEach(c => o[c.name] = c.checked); return o; };

document.addEventListener('click', e => {
  const ch = e.target.closest('.chip');
  if (ch && ch.parentElement.dataset.chips) {
    const g = ch.parentElement; $$('.chip', g).forEach(c => c.classList.toggle('on', c === ch));
    const h = $('input[type=hidden]', g); h.value = ch.dataset.v; h.dispatchEvent(new Event('change', { bubbles: true })); vibrate(6); return;
  }
  const sw = e.target.closest('.swatches button');
  if (sw) { $$('.swatches button', sw.parentElement).forEach(b => b.classList.toggle('on', b === sw)); $('input[name=color]', sw.parentElement.parentElement).value = sw.dataset.c; return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const [a, ...rest] = el.dataset.act.split(':'); const fn = acts[a]; if (fn) { e.preventDefault(); fn(rest.join(':'), el, e); }
});

/* ---------- RENDER ---------- */
function applyTheme() {
  let t = S.settings.theme; if (t === 'auto') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  let m = $('meta[name=theme-color]'); if (m) m.content = t === 'light' ? '#eef1fa' : '#060914';
}
matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => S.settings.theme === 'auto' && applyTheme());

function render({ enter = false } = {}) {
  applyTheme();
  const has = S.vehicles.length > 0;
  document.body.classList.toggle('empty', !has);
  if (has && !S.vehicles.some(v => v.id === S.active)) S.active = S.vehicles[0].id;
  renderTop(); renderTabs();
  const views = { home: viewHome, reminders: viewReminders, fuel: viewFuel, service: viewService };
  $('#main').innerHTML = `<section class="view ${enter ? 'enter' : ''}">${has ? views[ui.tab]() : viewWelcome()}</section>`;
  if (enter) runCounters($('#main'));
  updateBadge();
}
function renderTop() {
  const v = veh(); if (!v) { $('#top').innerHTML = ''; return; }
  const n = attention().length;
  $('#top').innerHTML = `<button class="vchip glass" data-act="garage" style="--vc:${v.color}" aria-label="Zmień pojazd"><span class="av">${ic('car', 19)}</span>
    <span class="nm">${esc(v.name || v.model || 'Pojazd')}<span class="sub">${esc(v.plate || [v.make, v.model].filter(Boolean).join(' ') || 'Pojazd')}</span></span><span class="chev">${ic('chev', 16)}</span></button>
    <span class="grow"></span>
    <button class="icon-btn glass" data-act="tab:reminders" aria-label="Terminy">${ic('bell', 20)}${n ? `<span class="badge">${n}</span>` : ''}</button>
    <button class="icon-btn glass" data-act="more" aria-label="Więcej">${ic('sliders', 20)}</button>`;
}
function renderTabs() {
  const T = (k, i, l) => `<button class="tab ${ui.tab === k ? 'on' : ''}" data-act="tab:${k}" aria-label="${l}" ${ui.tab === k ? 'aria-current="page"' : ''}>${ic(i, 23)}<span>${l}</span></button>`;
  $('#tabbar').innerHTML = T('home', 'home', 'Pulpit') + T('reminders', 'bell', 'Terminy') + `<button class="fab" data-act="add" aria-label="Dodaj">${ic('plus', 28)}</button>` + T('fuel', 'fuel', 'Paliwo') + T('service', 'wrench', 'Serwis');
}
function go(tab) {
  if (tab === ui.tab && !S.vehicles.length) return;
  ui.tab = tab; render({ enter: true }); scrollTo({ top: 0, behavior: rm ? 'auto' : 'smooth' });
  try { history.replaceState(history.state, '', location.pathname + (tab === 'home' ? '' : '#' + tab)); } catch (e) {}
}
function updateBadge() { try { const n = attention().length; if (navigator.setAppBadge) n ? navigator.setAppBadge(n) : navigator.clearAppBadge(); } catch (e) {} }

/* ---------- WIDOK: witaj ---------- */
function viewWelcome() {
  const F = (i, c, t, d) => `<div class="glass rise" style="--i:${c}"><span class="ico" style="--tc:${['#34d399', '#22d3ee', '#a78bfa', '#fbbf24'][c - 2]}">${ic(i, 21)}</span><div><b>${t}</b><span>${d}</span></div></div>`;
  return `<div class="welcome">
    <div class="rise" style="--i:0">${logoSVG(96)}</div>
    <div class="rise" style="--i:1"><h1>Dziennik <em>Auta</em></h1></div>
    <p class="rise" style="--i:1">Terminy OC i przeglądu, spalanie, koszty serwisów oraz raport do sprzedaży — wszystko w jednym miejscu, bez konta i bez internetu.</p>
    <div class="feat">${F('bell', 2, 'Terminy pod kontrolą', 'OC, przegląd, olej, opony — z odliczaniem')}${F('fuel', 3, 'Tankowania i spalanie', 'Automatyczne l/100 km i koszt kilometra')}${F('wrench', 4, 'Historia serwisowa', 'Wiele aut, raport PDF do sprzedaży')}${F('shield', 5, 'Prywatnie', 'Dane zostają tylko na Twoim urządzeniu')}</div>
    <div class="rise" style="--i:6;display:grid;gap:10px"><button class="btn" data-act="veh-new">${ic('plus', 20)} Dodaj pierwsze auto</button><button class="btn ghost" data-act="demo">${ic('spark', 19)} Zobacz z przykładowymi danymi</button></div>
  </div>`;
}

/* ---------- WIDOK: pulpit ---------- */
function insights(v, st) {
  const out = [];
  const oil = S.services.filter(s => s.vid === v.id && s.type === 'olej').sort((a, b) => b.date.localeCompare(a.date))[0];
  if (oil && oil.odo) { const d = curOdo(v.id) - oil.odo; if (d >= 0) out.push({ i: 'drop', c: '#fbbf24', t: `Od ostatniej wymiany oleju przejechano <b>${kmf(d)}</b> (${fmtD(oil.date)}).` }); }
  const { list, res } = fuelCalc(v.id), ids = list.filter(f => res[f.id]);
  if (ids.length >= 3) {
    const last = res[ids[ids.length - 1].id], prev = ids.slice(0, -1).slice(-5).map(f => res[f.id].cons), pa = prev.reduce((a, b) => a + b, 0) / prev.length, ch = (last.cons - pa) / pa * 100;
    if (Math.abs(ch) >= 3) out.push({ i: 'trend', c: ch < 0 ? '#34d399' : '#fb7185', t: `Ostatnie spalanie <b>${N1.format(last.cons)}</b> to ${Math.abs(Math.round(ch))}% ${ch < 0 ? 'mniej' : 'więcej'} niż zwykle.` });
  }
  if (list.length >= 3) {
    const l = list[list.length - 1], pr = list.slice(-6, -1).filter(f => (f.ft || 'pb95') === (l.ft || 'pb95')); if (pr.length >= 2) {
      const pa = sum(pr, 'ppl') / pr.length, ch = (l.ppl - pa) / pa * 100; if (Math.abs(ch) >= 3) out.push({ i: 'fuel', c: ch < 0 ? '#34d399' : '#fbbf24', t: `Cena paliwa przy ostatnim tankowaniu: <b>${N2.format(l.ppl)} zł</b> (${ch < 0 ? '−' : '+'}${Math.abs(Math.round(ch))}% vs średnia).` });
    }
  }
  const m = monthly(v.id, 2); if (m[0].fuel + m[0].svc > 0 && m[1].fuel + m[1].svc > 0) {
    const d = (m[1].fuel + m[1].svc) - (m[0].fuel + m[0].svc);
    out.push({ i: 'wallet', c: '#a78bfa', t: `W tym miesiącu wydano <b>${money0(m[1].fuel + m[1].svc)}</b> — ${d > 0 ? 'o ' + money0(d) + ' więcej' : 'o ' + money0(-d) + ' mniej'} niż w poprzednim.` });
  }
  return out.slice(0, 3);
}
function viewHome() {
  const v = veh(), p = ui.period, st = stats(v.id, p), odo = curOdo(v.id);
  const rems = S.reminders.filter(r => r.vid === v.id).map(r => ({ r, i: remInfo(r) })).sort((a, b) => a.i.sort - b.i.sort);
  const set = rems.filter(x => x.i.level !== 'none'), att = set.filter(x => x.i.level === 'warn' || x.i.level === 'bad');
  const bad = set.filter(x => x.i.level === 'bad').length;
  const status = !set.length ? `<span class="chip-s warn">${ic('alert', 15)} Ustaw terminy</span>` : bad ? `<span class="chip-s bad">${ic('alert', 15)} ${bad} po terminie</span>` : att.length ? `<span class="chip-s warn">${ic('alert', 15)} ${att.length} ${plural(att.length, 'termin', 'terminy', 'terminów')} wkrótce</span>` : `<span class="chip-s ok">${ic('check', 15)} Dokumenty aktualne</span>`;
  const pa = st.primary ? `<span class="chip-s">${ic('fuel', 14)} <span class="num">${N1.format(st.avg[st.primary])}</span> ${FUELS[st.primary].u}/100 km</span>` : '';
  const lastAct = [...S.fuels.filter(f => f.vid === v.id), ...S.services.filter(s => s.vid === v.id)].map(x => x.date).sort().pop();
  const ps = [['m', '30 dni'], ['y', '12 mies.'], ['all', 'Całość']];
  const unitU = st.primary ? FUELS[st.primary].u : 'l';
  const donutItems = [];
  if (st.fuelCost > 0) donutItems.push({ l: 'Paliwo', v: st.fuelCost, c: '#22d3ee' });
  const byType = {}; for (const s of st.sv) byType[s.type] = (byType[s.type] || 0) + (s.cost || 0);
  Object.entries(byType).filter(([, x]) => x > 0).sort((a, b) => b[1] - a[1]).forEach(([k, x]) => donutItems.push({ l: SVT[k].l, v: x, c: SVT[k].c }));
  const cons = fuelCalc(v.id), pts = cons.list.filter(f => cons.res[f.id] && cons.res[f.id].t === (st.primary || 'pb95')).slice(-12).map(f => ({ v: cons.res[f.id].cons, d: f.date }));
  const ins = insights(v, st);
  const showInstall = !isStandalone() && !S.settings.hideInstall && (deferredInstall || isIOS());
  return `
  <section class="hero rise" style="--vc:${v.color};--i:0">
    ${carSVG}
    <div class="hero-top"><div><div class="eyebrow">${esc([v.make, v.model].filter(Boolean).join(' '))}${v.year ? ' · ' + v.year : ''}</div><h1>${esc(v.name || v.model || 'Moje auto')}</h1></div>${plateHTML(v.plate)}</div>
    <button class="hero-odo" data-act="odo" aria-label="Zaktualizuj przebieg"><span class="lbl">Przebieg</span><b class="num">${cnt(odo, 0)}<small>km</small></b><span class="pill">${ic('edit', 14)} Zaktualizuj${lastAct ? ' · ostatni wpis ' + rel(dayDiff(today(), lastAct)) : ''}</span></button>
    <div class="hero-foot">${status}${pa}</div>
  </section>

  <div class="rise" style="--i:1"><div class="sec-h" style="margin-top:6px"><h2>Najbliższe terminy</h2><button class="link" data-act="tab:reminders">Wszystkie ${ic('chev', 15)}</button></div>
  <div class="hscroll">${rems.length ? rems.map(({ r, i }) => `<button class="glass rcard lv-${i.level}" data-act="${i.level === 'none' ? 'rem-edit' : 'rem-renew'}:${r.id}" style="--tc:${RT[r.type].c}">${ringSVG(i)}<div class="t">${esc(remTitle(r))}</div><div class="s">${i.level === 'none' ? 'Dotknij, aby ustawić' : esc(i.sub)}</div></button>`).join('') : `<button class="glass rcard lv-none" data-act="rem-new">${ringSVG({ level: 'none', frac: 0 })}<div class="t">Dodaj termin</div><div class="s">OC, przegląd, olej…</div></button>`}</div></div>

  <div class="rise" style="--i:2"><div class="seg" role="tablist">${ps.map(([k, l]) => `<button class="${p === k ? 'on' : ''}" data-act="period:${k}">${l}</button>`).join('')}</div></div>

  <div class="tiles rise" style="--i:3">
    <div class="glass tile" style="--tc:#22d3ee"><span class="ti">${ic('gauge', 19)}</span><span class="lb">Średnie spalanie</span><span class="vl num">${st.primary ? `${cnt(st.avg[st.primary], 1)}<small>${unitU}/100 km</small>` : '—'}</span><span class="sb">${st.primary ? (st.types.length > 1 ? st.types.slice(1).map(t => `${FUELS[t].s}: ${N1.format(st.avg[t])}`).join(' · ') : FUELS[st.primary].l) : 'potrzeba 2 tankowań do pełna'}</span></div>
    <div class="glass tile" style="--tc:#a78bfa"><span class="ti">${ic('wallet', 19)}</span><span class="lb">Wydatki łącznie</span><span class="vl num">${cnt(st.total, 0)}<small>zł</small></span><span class="sb">paliwo ${money0(st.fuelCost)} · serwis ${money0(st.svcCost)}</span></div>
    <div class="glass tile" style="--tc:#34d399"><span class="ti">${ic('road', 19)}</span><span class="lb">Koszt kilometra</span><span class="vl num">${st.costKm ? `${cnt(st.costKm, 2)}<small>zł/km</small>` : '—'}</span><span class="sb">${st.kmRange ? 'przejechano ok. ' + kmf(st.kmRange) : 'za mało danych'}</span></div>
    <div class="glass tile" style="--tc:#fbbf24"><span class="ti">${ic('fuel', 19)}</span><span class="lb">Tankowania</span><span class="vl num">${cnt(st.fills, 0)}<small>wpisów</small></span><span class="sb">${st.avgPrice ? 'śr. cena ' + N2.format(st.avgPrice) + ' zł/' + unitU : 'brak danych'}</span></div>
  </div>

  <div class="glass card rise" style="--i:4"><h3>Koszty miesięczne</h3><p class="hint">Ostatnie 6 miesięcy</p>${barChart(monthly(v.id))}<div class="legend"><span style="--c:#22d3ee"><i></i>Paliwo</span><span style="--c:#a78bfa"><i></i>Serwis i inne</span></div></div>

  <div class="glass card rise" style="--i:5"><h3>Spalanie w czasie</h3><p class="hint">${st.primary ? FUELS[st.primary].l + ' · ' + unitU + '/100 km' : 'Metoda „od pełnego do pełnego”'}</p>${lineChart(pts, st.primary ? st.avg[st.primary] : 0, unitU)}</div>

  ${donutItems.length ? `<div class="glass card rise" style="--i:6"><h3>Na co idą pieniądze</h3><p class="hint">${p === 'm' ? 'Ostatnie 30 dni' : p === 'y' ? 'Ostatnie 12 miesięcy' : 'Cała historia'}</p>${donut(donutItems)}</div>` : ''}

  ${ins.length ? `<div class="rise" style="--i:7"><div class="sec-h"><h2>Wnioski</h2></div><div class="list">${ins.map(x => `<div class="glass tip" style="--tc:${x.c}"><span class="ti">${ic(x.i, 18)}</span><p>${x.t}</p></div>`).join('')}</div></div>` : ''}

  ${showInstall ? `<div class="glass tip rise" style="--i:8;--tc:#22d3ee"><span class="ti">${ic('phone', 18)}</span><p><b>Zainstaluj aplikację.</b> ${deferredInstall ? 'Dodaj Dziennik Auta do ekranu startowego, by działał jak zwykła aplikacja.' : 'Safari → przycisk Udostępnij → „Do ekranu początkowego”.'}</p>${deferredInstall ? '<button class="btn sm" data-act="install">Zainstaluj</button>' : `<button class="sq" data-act="hide-install" aria-label="Ukryj">${ic('x', 16)}</button>`}</div>` : ''}
  `;
}

/* ---------- WIDOK: terminy ---------- */
function remCard(r, i, showV) {
  const t = RT[r.type] || RT.inne, v = vById(r.vid);
  return `<article class="glass rem lv-${i.level} rise" style="--i:${showV ? 0 : 0}">
    <div class="rem-top">${ringSVG(i, 76)}<div class="grow">${showV && v ? `<span class="vtag">${esc(v.name || v.model)}</span>` : ''}<h3>${esc(remTitle(r))}</h3>
      <div class="d1">${esc(i.text)}</div><div class="d2">${esc(i.sub)}${r.notes ? (i.sub ? ' · ' : '') + esc(r.notes) : ''}</div></div></div>
    <div class="rem-act"><button class="btn sm grow" data-act="${i.level === 'none' ? 'rem-edit' : 'rem-renew'}:${r.id}">${ic(i.level === 'none' ? 'cal' : 'check', 17)} ${i.level === 'none' ? 'Ustaw termin' : 'Odnowione / wykonane'}</button>
      ${r.dueDate ? `<button class="sq" data-act="rem-ics:${r.id}" aria-label="Dodaj do kalendarza">${ic('cal', 19)}</button>` : ''}<button class="sq" data-act="rem-edit:${r.id}" aria-label="Edytuj">${ic('edit', 18)}</button></div></article>`;
}
function viewReminders() {
  const v = veh(), all = ui.all && S.vehicles.length > 1;
  const items = S.reminders.filter(r => all || r.vid === v.id).map(r => ({ r, i: remInfo(r) })).sort((a, b) => a.i.sort - b.i.sort);
  const bad = items.filter(x => x.i.level === 'bad').length, warn = items.filter(x => x.i.level === 'warn').length;
  const lv = bad ? 'bad' : warn ? 'warn' : items.some(x => x.i.level === 'ok') ? 'ok' : 'none';
  const bt = bad ? `${bad} ${plural(bad, 'termin po terminie', 'terminy po terminie', 'terminów po terminie')}` : warn ? `${warn} ${plural(warn, 'termin zbliża się', 'terminy się zbliżają', 'terminów się zbliża')}` : lv === 'ok' ? 'Wszystko aktualne' : 'Ustaw swoje terminy';
  const bs = bad || warn ? 'Zadbaj o to jak najszybciej — dotknij „Odnowione”, gdy załatwisz sprawę.' : lv === 'ok' ? 'Żaden termin nie wymaga teraz uwagi.' : 'Dodaj OC, przegląd i wymianę oleju.';
  return `
  <div class="vh rise" style="--i:0;display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div><h1>Terminy</h1><p>OC, przegląd, olej i inne</p></div><button class="btn sm" data-act="rem-new">${ic('plus', 17)} Dodaj</button></div>
  <div class="glass banner lv-${lv} rise" style="--i:1"><span class="bi">${ic(lv === 'ok' ? 'check' : lv === 'none' ? 'bell' : 'alert', 24)}</span><div><b>${bt}</b><span>${bs}</span></div></div>
  ${S.vehicles.length > 1 ? `<div class="seg rise" style="--i:2"><button class="${!all ? 'on' : ''}" data-act="scope:one">${esc(v.name || 'Ten pojazd')}</button><button class="${all ? 'on' : ''}" data-act="scope:all">Wszystkie pojazdy</button></div>` : ''}
  <div class="list">${items.length ? items.map(x => remCard(x.r, x.i, all)).join('') : `<div class="empty glass"><span class="eic">${ic('bell', 30)}</span><h3>Brak terminów</h3><p>Dodaj termin OC, badania technicznego lub wymiany oleju, a przypomnimy o nim z wyprzedzeniem.</p><button class="btn sm" data-act="rem-new">${ic('plus', 17)} Dodaj termin</button></div>`}</div>
  ${items.some(x => x.r.dueDate) ? `<button class="btn ghost rise" data-act="rem-ics-all">${ic('cal', 19)} Dodaj terminy do kalendarza</button>` : ''}
  <p class="note" style="text-align:center">Powiadomienia pojawiają się po otwarciu aplikacji. Aby mieć przypomnienia także przy wyłączonej aplikacji, dodaj terminy do kalendarza telefonu.</p>`;
}

/* ---------- WIDOK: paliwo ---------- */
function viewFuel() {
  const v = veh(), { list, res } = fuelCalc(v.id), st = stats(v.id, 'all');
  if (!list.length) return `<div class="vh rise"><h1>Paliwo</h1><p>Historia tankowań i spalanie</p></div><div class="empty glass rise" style="--i:1"><span class="eic">${ic('fuel', 32)}</span><h3>Zacznij od pierwszego tankowania</h3><p>Zatankuj „do pełna” i wpisz litry oraz przebieg. Po drugim pełnym baku obliczymy średnie spalanie.</p><button class="btn sm" data-act="fuel-new">${ic('plus', 17)} Dodaj tankowanie</button></div>`;
  const pt = st.primary, u = FUELS[pt || v.fuel || 'pb95'].u, ids = list.filter(f => res[f.id]);
  const pts = ids.filter(f => res[f.id].t === (pt || 'pb95')).slice(-14).map(f => ({ v: res[f.id].cons, d: f.date }));
  const cs = ids.map(f => res[f.id].cons), best = cs.length ? Math.min(...cs) : null, worst = cs.length ? Math.max(...cs) : null;
  const last = ids.length ? res[ids[ids.length - 1].id].cons : null;
  const groups = {}; [...list].reverse().forEach(f => (groups[f.date.slice(0, 7)] = groups[f.date.slice(0, 7)] || []).push(f));
  const item = (f, idx) => {
    const r = res[f.id], t = f.ft || 'pb95', a = st.avg[t], cls = r && a ? (r.cons <= a * .97 ? 'g' : r.cons <= a * 1.08 ? 'm' : 'r') : '';
    return `<button class="glass item rise" style="--tc:${FUELS[t].c};--i:${Math.min(idx, 8)}" data-act="fuel-edit:${f.id}"><span class="ico">${ic(t === 'ev' ? 'zap' : 'fuel', 21)}</span>
      <span class="mid"><b>${money(f.total)}</b><small>${fmtD(f.date)}${f.station ? ' · ' + esc(f.station) : ''} · ${N2.format(f.liters)} ${FUELS[t].u} × ${N2.format(f.ppl)} zł</small></span>
      <span class="end">${r ? `<em class="cons ${cls}">${N1.format(r.cons)}</em><small>${FUELS[t].u}/100</small>` : `<small>${f.full ? kmf(f.odo) : 'częściowe'}</small>`}</span></button>`;
  };
  let idx = 0;
  return `
  <div class="vh rise" style="--i:0;display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div><h1>Paliwo</h1><p>${list.length} ${plural(list.length, 'tankowanie', 'tankowania', 'tankowań')} · ${money0(st.fuelCost)}</p></div><button class="btn sm" data-act="fuel-new">${ic('plus', 17)} Dodaj</button></div>
  <div class="tiles rise" style="--i:1">
    <div class="glass tile wide" style="--tc:#22d3ee"><span class="ti">${ic('gauge', 19)}</span><span class="lb">Średnie spalanie${pt ? ' · ' + FUELS[pt].l : ''}</span><span class="vl num" style="font-size:34px">${pt ? `${cnt(st.avg[pt], 1)}<small>${u}/100 km</small>` : '—'}</span>
      <span class="sb">${last !== null ? `ostatnio ${N1.format(last)} · najlepsze ${N1.format(best)} · najgorsze ${N1.format(worst)}` : 'Dodaj kolejne tankowanie „do pełna”, aby zobaczyć średnią.'}</span></div></div>
  <div class="glass card rise" style="--i:2"><h3>Trend spalania</h3>${lineChart(pts, pt ? st.avg[pt] : 0, u)}</div>
  ${Object.entries(groups).map(([m, arr]) => `<div class="grp"><span>${fmtM(m)}</span><span>${money(sum(arr, 'total'))}</span></div><div class="list">${arr.map(f => item(f, idx++)).join('')}</div>`).join('')}`;
}

/* ---------- WIDOK: serwis ---------- */
function svcListHTML() {
  const v = veh(), q = ui.svcQ.trim().toLowerCase();
  let arr = S.services.filter(s => s.vid === v.id && (ui.svcF === 'all' || s.type === ui.svcF) && (!q || [s.title, s.shop, s.notes, SVT[s.type]?.l].join(' ').toLowerCase().includes(q)));
  arr.sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo);
  if (!arr.length) return `<div class="empty glass"><span class="eic">${ic('wrench', 30)}</span><h3>${S.services.some(s => s.vid === v.id) ? 'Brak wyników' : 'Brak wpisów serwisowych'}</h3><p>${S.services.some(s => s.vid === v.id) ? 'Zmień filtr lub frazę wyszukiwania.' : 'Dodawaj przeglądy, naprawy i wymiany — zbudujesz pełną historię auta.'}</p></div>`;
  const g = {}; arr.forEach(s => (g[s.date.slice(0, 4)] = g[s.date.slice(0, 4)] || []).push(s));
  let idx = 0;
  return Object.entries(g).sort((a, b) => b[0] - a[0]).map(([y, a]) => `<div class="grp"><span>${y}</span><span>${money(sum(a, 'cost'))}</span></div><div class="list">${a.map(s => { const t = SVT[s.type] || SVT.inne; return `<button class="glass item" style="--tc:${t.c}" data-act="svc-edit:${s.id}"><span class="ico">${ic(t.i, 21)}</span><span class="mid"><b>${esc(s.title || t.l)}</b><small>${fmtD(s.date)}${s.odo ? ' · ' + kmf(s.odo) : ''}${s.shop ? ' · ' + esc(s.shop) : ''}</small></span><span class="end"><b>${s.cost ? money(s.cost) : '—'}</b><small>${esc(t.l)}</small></span></button>`; }).join('')}</div>`).join('');
}
function viewService() {
  const v = veh(), all = S.services.filter(s => s.vid === v.id), total = sum(all, 'cost');
  const types = [...new Set(all.map(s => s.type))];
  const last = [...all].sort((a, b) => b.date.localeCompare(a.date))[0];
  return `
  <div class="vh rise" style="--i:0;display:flex;justify-content:space-between;align-items:flex-end;gap:12px"><div><h1>Serwis</h1><p>Naprawy, przeglądy i wydatki</p></div><button class="btn sm" data-act="svc-new">${ic('plus', 17)} Dodaj</button></div>
  <div class="tiles rise" style="--i:1">
    <div class="glass tile" style="--tc:#a78bfa"><span class="ti">${ic('wallet', 19)}</span><span class="lb">Suma kosztów</span><span class="vl num">${cnt(total, 0)}<small>zł</small></span><span class="sb">${all.length} ${plural(all.length, 'wpis', 'wpisy', 'wpisów')}</span></div>
    <div class="glass tile" style="--tc:#fbbf24"><span class="ti">${ic('history', 19)}</span><span class="lb">Ostatni serwis</span><span class="vl num" style="font-size:19px;padding-top:4px">${last ? fmtDs(last.date) : '—'}</span><span class="sb">${last ? (last.odo ? kmf(last.odo) : esc(last.title || '')) : 'brak wpisów'}</span></div>
  </div>
  <button class="promo rise" style="--i:2" data-act="report"><span class="pi">${ic('file', 24)}</span><span><b>Raport do sprzedaży auta</b><span>Pełna historia serwisowa do PDF — zwiększa zaufanie kupującego</span></span></button>
  ${all.length ? `<div class="fld rise" style="--i:3"><input id="svc-q" type="search" placeholder="Szukaj w historii…" value="${esc(ui.svcQ)}" autocomplete="off" style="padding:13px 14px;border-radius:15px;background:var(--glass2);border:1px solid var(--line);font-size:16px;width:100%;outline:0;min-height:50px"></div>
  <div class="chips rise" style="--i:3;margin:0 -16px;padding-left:16px;padding-right:16px"><button class="chip ${ui.svcF === 'all' ? 'on' : ''}" data-act="svcf:all" style="--tc:var(--a2)"><span>Wszystkie</span></button>${types.map(t => `<button class="chip ${ui.svcF === t ? 'on' : ''}" data-act="svcf:${t}" style="--tc:${SVT[t].c}">${ic(SVT[t].i, 16)}<span>${SVT[t].l}</span></button>`).join('')}</div>` : ''}
  <div id="svc-list">${svcListHTML()}</div>`;
}
document.addEventListener('input', e => {
  if (e.target.id === 'svc-q') { ui.svcQ = e.target.value; $('#svc-list').innerHTML = svcListHTML(); }
});
document.addEventListener('change', e => {
  if (e.target.id === 'set-lead') { S.settings.lead = +e.target.value; persist(); render(); }
});

/* ---------- AKCJE ---------- */
let undoSnap = null;
function snapshot(msg) { undoSnap = JSON.stringify(S); toast(msg, true); }
const acts = {
  tab: t => { closeSheet(); go(t); },
  close: () => closeSheet(),
  add: () => quickAdd(),
  more: () => settingsSheet(),
  garage: () => garageSheet(),
  period: p => { ui.period = p; render(); },
  scope: s => { ui.all = s === 'all'; render(); },
  svcf: f => { ui.svcF = f; render(); },
  undo: () => { if (undoSnap) { S = JSON.parse(undoSnap); undoSnap = null; persist(); render(); $('#toast').classList.remove('show'); } },
  'veh-select': id => { S.active = id; persist(); closeSheet(); render({ enter: true }); vibrate(); },
  'veh-new': () => vehicleSheet(),
  'veh-edit': id => vehicleSheet(id),
  'fuel-new': () => fuelSheet(),
  'fuel-edit': id => fuelSheet(id),
  'svc-new': () => serviceSheet(),
  'svc-edit': id => serviceSheet(id),
  'rem-new': () => reminderSheet(),
  'rem-edit': id => reminderSheet(id),
  'rem-renew': id => renewSheet(id),
  'rem-ics': id => { const r = S.reminders.find(x => x.id === id); if (r) exportICS([r]); },
  'rem-ics-all': () => exportICS(S.reminders.filter(r => (ui.all || r.vid === veh().id))),
  odo: () => odoSheet(),
  report: () => { closeSheet(); openReport(); },
  theme: t => { S.settings.theme = t; persist(); applyTheme(); settingsSheet(); render(); },
  notif: () => enableNotifications(),
  'csv': () => exportCSV(),
  'json': () => exportJSON(),
  'import': () => $('#import-file').click(),
  demo: () => { if (S.vehicles.length && !confirm('Wczytanie danych demo doda przykładowe pojazdy do Twoich danych. Kontynuować?')) return; loadDemo(); closeSheet(); render({ enter: true }); toast('Wczytano dane demonstracyjne'); },
  wipe: () => { if (confirm('Usunąć WSZYSTKIE dane z tego urządzenia? Tej operacji nie można cofnąć. Zrób wcześniej kopię zapasową.')) { S = DEF(); persist(); closeSheet(); ui.tab = 'home'; render({ enter: true }); } },
  trip: () => tripSheet(),
  install: async () => { if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; render(); } },
  'hide-install': () => { S.settings.hideInstall = true; persist(); render(); },
  del: (arg, el) => {
    if (!el.dataset.armed) { el.dataset.armed = '1'; el.innerHTML = `${ic('trash', 18)} Potwierdź usunięcie`; setTimeout(() => { if (el.isConnected) { delete el.dataset.armed; el.innerHTML = `${ic('trash', 18)} Usuń`; } }, 3000); return; }
    const [kind, id] = arg.split('.'); snapshot('Usunięto');
    if (kind === 'fuel') S.fuels = S.fuels.filter(x => x.id !== id);
    if (kind === 'svc') S.services = S.services.filter(x => x.id !== id);
    if (kind === 'rem') S.reminders = S.reminders.filter(x => x.id !== id);
    if (kind === 'veh') { S.vehicles = S.vehicles.filter(x => x.id !== id); S.fuels = S.fuels.filter(x => x.vid !== id); S.services = S.services.filter(x => x.vid !== id); S.reminders = S.reminders.filter(x => x.vid !== id); if (S.active === id) S.active = S.vehicles[0]?.id || null; }
    persist(); closeSheet(); render(); vibrate(14);
  },
  'rp-close': () => closeReport(),
  'rp-print': () => window.print(),
  'rp-html': () => { const v = veh(); download(`historia-serwisowa-${(v.plate || v.name || 'auto').replace(/\W+/g, '-')}.html`, `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Historia serwisowa – ${esc(v.name)}</title><style>body{margin:0;background:#eceff6;font-family:-apple-system,Segoe UI,Roboto,sans-serif}.rp-paper{max-width:820px;margin:18px auto;background:#fff;padding:36px 34px;color:#111}@media print{body{background:#fff}.rp-paper{margin:0;padding:0}}</style></head><body><div class="rp-paper">${reportHTML(v, ui.rp)}</div></body></html>`, 'text/html'); },
};

/* ---------- ARKUSZ: szybkie dodawanie ---------- */
function quickAdd() {
  const T = (a, i, c, t, d) => `<button class="glass item" data-act="${a}" style="--tc:${c}"><span class="ico">${ic(i, 22)}</span><span class="mid"><b>${t}</b><small>${d}</small></span>${ic('chev', 18)}</button>`;
  openSheet('Dodaj', `<div class="list">${T('fuel-new', 'fuel', '#22d3ee', 'Tankowanie', 'Litry, cena i przebieg — spalanie liczy się samo')}${T('svc-new', 'wrench', '#a78bfa', 'Serwis lub wydatek', 'Naprawa, przegląd, opony, myjnia, ubezpieczenie')}${T('odo', 'gauge', '#34d399', 'Aktualizacja przebiegu', 'Szybko zapisz stan licznika')}${T('rem-new', 'bell', '#fbbf24', 'Nowy termin', 'OC, przegląd, olej, własne przypomnienie')}</div>`);
}

/* ---------- ARKUSZ: garaż i pojazd ---------- */
function garageSheet() {
  const body = `<div class="list">${S.vehicles.map(v => `<div style="display:flex;gap:10px;align-items:stretch"><button class="glass vcard ${v.id === S.active ? 'on' : ''}" style="--vc:${v.color};flex:1" data-act="veh-select:${v.id}"><span class="av">${ic('car', 24)}</span><span class="mid"><b>${esc(v.name || v.model)}</b><span>${esc([v.make, v.model, v.year].filter(Boolean).join(' '))} · ${kmf(curOdo(v.id))}</span></span>${v.id === S.active ? `<span style="color:var(--ok)">${ic('check', 22)}</span>` : plateHTML(v.plate)}</button><button class="sq" style="height:auto" data-act="veh-edit:${v.id}" aria-label="Edytuj pojazd">${ic('edit', 18)}</button></div>`).join('')}
  <button class="btn ghost" data-act="veh-new">${ic('plus', 19)} Dodaj pojazd</button></div>`;
  openSheet('Twój garaż', body);
}
function vehicleSheet(id) {
  const v = id ? vById(id) : { name: '', make: '', model: '', year: '', plate: '', vin: '', fuel: 'pb95', odo: '', color: COLORS[S.vehicles.length % COLORS.length] };
  const body = `<form class="form" autocomplete="off">
    ${fld('Nazwa własna', inp('name', v.name, 'placeholder="np. Rodzinne kombi"'))}
    <div class="row2">${fld('Marka', inp('make', v.make, 'placeholder="Škoda" required'))}${fld('Model', inp('model', v.model, 'placeholder="Octavia III" required'))}</div>
    <div class="row2">${fld('Rok produkcji', inp('year', v.year, 'type="number" inputmode="numeric" min="1950" max="2100" placeholder="2018"'))}${fld('Tablica rejestracyjna', inp('plate', v.plate, 'placeholder="WX 12345" style="text-transform:uppercase" maxlength="10"'))}</div>
    ${fld('Przebieg (km)', inp('odo', v.odo, 'type="number" inputmode="numeric" min="0" placeholder="145000" required'))}
    <div class="fld"><span>Paliwo główne</span>${chips('fuel', Object.entries(FUELS).map(([k, f]) => ({ k, l: f.l, c: f.c, i: k === 'ev' ? 'zap' : 'fuel' })), v.fuel || 'pb95', true)}</div>
    ${fld('Numer VIN (opcjonalnie)', inp('vin', v.vin, 'placeholder="17 znaków" maxlength="17" style="text-transform:uppercase"'))}
    <div class="fld"><span>Kolor w aplikacji</span><div class="swatches">${COLORS.map(c => `<button type="button" class="${c === v.color ? 'on' : ''}" data-c="${c}" style="--c:${c}" aria-label="Kolor ${c}"></button>`).join('')}</div><input type="hidden" name="color" value="${v.color}"></div>
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} ${id ? 'Zapisz zmiany' : 'Dodaj pojazd'}</button>${id ? `<button class="btn danger" type="button" data-act="del:veh.${id}">${ic('trash', 18)} Usuń</button>` : ''}</div></form>`;
  openSheet(id ? 'Edytuj pojazd' : 'Nowy pojazd', body, sh => {
    $('form', sh).addEventListener('submit', e => {
      e.preventDefault(); const f = formData(e.target), o = { name: f.name.trim(), make: f.make.trim(), model: f.model.trim(), year: +f.year || '', plate: f.plate.trim().toUpperCase(), vin: f.vin.trim().toUpperCase(), fuel: f.fuel, odo: num(f.odo) || 0, color: f.color };
      if (id) Object.assign(vById(id), o);
      else {
        const nv = { id: uid(), ...o }; S.vehicles.push(nv); S.active = nv.id;
        ['oc', 'przeglad', 'olej'].forEach(t => S.reminders.push({ id: uid(), vid: nv.id, type: t, title: '', dueDate: '', dueKm: '', everyMonths: RT[t].m, everyKm: RT[t].km || '', notes: '' }));
      }
      persist(); closeSheet(); render({ enter: true }); toast(id ? 'Zapisano' : 'Dodano pojazd — ustaw teraz jego terminy'); confetti();
    });
  });
}

/* ---------- ARKUSZ: przebieg ---------- */
function odoSheet() {
  const v = veh(), cur = curOdo(v.id);
  openSheet('Przebieg', `<form class="form"><p class="note">Aktualny przebieg zapisany w aplikacji: <b>${kmf(cur)}</b></p>
    <input class="bigin" name="odo" type="number" inputmode="numeric" min="0" value="${cur}" required style="width:100%;border-radius:20px;background:var(--glass2);border:1px solid var(--line);outline:0">
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} Zapisz przebieg</button></div></form>`, sh => {
    const i = $('input', sh); setTimeout(() => { i.focus(); i.select(); }, 350);
    $('form', sh).addEventListener('submit', e => { e.preventDefault(); const val = num(i.value); if (!(val >= 0)) return; if (val < cur && !confirm(`Nowy przebieg (${N0.format(val)}) jest niższy niż zapisany (${N0.format(cur)}). Zapisać mimo to?`)) return; v.odo = val; persist(); closeSheet(); render(); toast('Zaktualizowano przebieg'); vibrate(); });
  });
}

/* ---------- ARKUSZ: tankowanie ---------- */
function fuelSheet(id) {
  const v = veh(), old = id ? S.fuels.find(x => x.id === id) : null;
  const lastF = S.fuels.filter(f => f.vid === v.id).sort((a, b) => b.date.localeCompare(a.date) || b.odo - a.odo)[0];
  const f = old || { date: today(), odo: '', ft: lastF?.ft || (v.fuel === 'ev' ? 'ev' : v.fuel) || 'pb95', liters: '', ppl: lastF?.ppl || '', total: '', full: true, station: lastF?.station || '' };
  const u = t => FUELS[t].u;
  const body = `<form class="form" autocomplete="off">
    <div class="row2">${fld('Data', inp('date', f.date, 'type="date" required'))}${fld('Przebieg (km)', inp('odo', f.odo, `type="number" inputmode="numeric" min="0" placeholder="${curOdo(v.id) || ''}" required`))}</div>
    <div class="fld"><span>Rodzaj paliwa</span>${chips('ft', Object.entries(FUELS).map(([k, x]) => ({ k, l: x.s, c: x.c, i: k === 'ev' ? 'zap' : 'fuel' })), f.ft)}</div>
    <div class="row2">${fld('Ilość', unitIn('liters', f.liters, `<span id="u1">${u(f.ft)}</span>`, 'type="number" inputmode="decimal" step="any" min="0" placeholder="0,00" required'))}${fld('Cena jednostkowa', unitIn('ppl', f.ppl, 'zł', 'type="number" inputmode="decimal" step="any" min="0" placeholder="0,00" required'))}</div>
    ${fld('Kwota całkowita', unitIn('total', f.total, 'zł', 'type="number" inputmode="decimal" step="any" min="0" placeholder="0,00" required'))}
    ${swtch('full', 'Tankowanie do pełna', 'Potrzebne do dokładnego liczenia spalania', f.full)}
    ${fld('Stacja (opcjonalnie)', inp('station', f.station, 'list="stations" placeholder="np. Orlen"') + `<datalist id="stations">${STATIONS.map(s => `<option value="${s}">`).join('')}</datalist>`)}
    <p class="note" id="fnote"></p>
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} ${old ? 'Zapisz zmiany' : 'Zapisz tankowanie'}</button>${old ? `<button class="btn danger" type="button" data-act="del:fuel.${id}">${ic('trash', 18)} Usuń</button>` : ''}</div></form>`;
  openSheet(old ? 'Edytuj tankowanie' : 'Nowe tankowanie', body, sh => {
    const form = fm($('form', sh)), L = form.liters, Pp = form.ppl, T = form.total; let order = f.ppl ? ['ppl'] : [];
    const calc = () => {
      const l = num(L.value), p = num(Pp.value), t = num(T.value), third = ['liters', 'ppl', 'total'].find(k => !order.slice(-2).includes(k));
      if (order.length < 2) return;
      if (third === 'total' && l > 0 && p > 0) T.value = (l * p).toFixed(2);
      if (third === 'liters' && t > 0 && p > 0) L.value = (t / p).toFixed(2);
      if (third === 'ppl' && t > 0 && l > 0) Pp.value = (t / l).toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    };
    [['liters', L], ['ppl', Pp], ['total', T]].forEach(([k, el]) => el.addEventListener('input', () => { order = order.filter(x => x !== k); order.push(k); calc(); }));
    form.ft.addEventListener('change', () => { $('#u1', sh).textContent = u(form.ft.value); });
    const note = () => { const c = curOdo(v.id), o = num(form.odo.value); $('#fnote', sh).innerHTML = o > 0 && c && o < c - 0 && !old ? `Uwaga: wpisany przebieg jest niższy niż ostatni znany (<b>${kmf(c)}</b>).` : (c ? `Ostatni znany przebieg: <b>${kmf(c)}</b>` : ''); };
    form.odo.addEventListener('input', note); note();
    form.addEventListener('submit', e => {
      e.preventDefault(); const d = formData(form), liters = num(d.liters), ppl = num(d.ppl), total = num(d.total), odo = num(d.odo);
      if (!(liters > 0) || !(odo >= 0) || !(total >= 0)) { toast('Uzupełnij ilość, kwotę i przebieg'); return; }
      const rec = { id: old ? old.id : uid(), vid: v.id, date: d.date, odo, ft: d.ft, liters, ppl: ppl || total / liters, total, full: d.full, station: d.station.trim() };
      if (old) Object.assign(old, rec); else S.fuels.push(rec);
      bumpOdo(v.id, odo); persist(); closeSheet(); render(); toast(old ? 'Zapisano zmiany' : 'Dodano tankowanie'); vibrate(12);
    });
  });
}

/* ---------- ARKUSZ: serwis ---------- */
const SVC2REM = { olej: 'olej', badanie: 'przeglad' };
function serviceSheet(id) {
  const v = veh(), old = id ? S.services.find(x => x.id === id) : null;
  const s = old || { date: today(), odo: '', type: 'naprawa', title: '', cost: '', shop: '', notes: '' };
  const body = `<form class="form" autocomplete="off">
    <div class="fld"><span>Rodzaj</span>${chips('type', Object.entries(SVT).map(([k, t]) => ({ k, l: t.l, c: t.c, i: t.i })), s.type)}</div>
    ${fld('Opis', inp('title', s.title, `placeholder="${esc(SVT[s.type].ph)}" id="s-title"`))}
    <div class="row2">${fld('Data', inp('date', s.date, 'type="date" required'))}${fld('Przebieg (km)', inp('odo', s.odo, `type="number" inputmode="numeric" min="0" placeholder="${curOdo(v.id) || ''}"`))}</div>
    <div class="row2">${fld('Koszt', unitIn('cost', s.cost, 'zł', 'type="number" inputmode="decimal" step="any" min="0" placeholder="0,00"'))}${fld('Warsztat', inp('shop', s.shop, 'placeholder="np. ASO, Auto-Serwis"'))}</div>
    ${fld('Notatki', `<textarea name="notes" placeholder="Numery części, gwarancja, zalecenia mechanika…">${esc(s.notes)}</textarea>`)}
    <div id="rem-sw" ${!old && SVC2REM[s.type] ? '' : 'hidden'}>${swtch('setrem', 'Zaktualizuj przypomnienie', 'Ustawi następny termin automatycznie', true)}</div>
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} ${old ? 'Zapisz zmiany' : 'Zapisz wpis'}</button>${old ? `<button class="btn danger" type="button" data-act="del:svc.${id}">${ic('trash', 18)} Usuń</button>` : ''}</div></form>`;
  openSheet(old ? 'Edytuj wpis' : 'Nowy wpis serwisowy', body, sh => {
    const form = fm($('form', sh));
    form.type.addEventListener('change', () => { $('#s-title', sh).placeholder = SVT[form.type.value].ph; $('#rem-sw', sh).hidden = !!old || !SVC2REM[form.type.value]; });
    form.addEventListener('submit', e => {
      e.preventDefault(); const d = formData(form), odo = num(d.odo) || 0, cost = num(d.cost) || 0;
      const rec = { id: old ? old.id : uid(), vid: v.id, date: d.date, odo, type: d.type, title: d.title.trim(), cost, shop: d.shop.trim(), notes: d.notes.trim() };
      if (old) Object.assign(old, rec); else S.services.push(rec);
      if (odo) bumpOdo(v.id, odo);
      let msg = old ? 'Zapisano zmiany' : 'Dodano wpis';
      if (!old && d.setrem && SVC2REM[d.type]) {
        const rt = SVC2REM[d.type], t = RT[rt]; let r = S.reminders.find(x => x.vid === v.id && x.type === rt);
        if (!r) { r = { id: uid(), vid: v.id, type: rt, title: '', everyMonths: t.m, everyKm: t.km || '', notes: '' }; S.reminders.push(r); }
        r.dueDate = addMonths(d.date, r.everyMonths || t.m); if (t.km && odo) r.dueKm = odo + (r.everyKm || t.km); msg += ' · zaktualizowano termin';
      }
      persist(); closeSheet(); render(); toast(msg); vibrate(12);
    });
  });
}

/* ---------- ARKUSZ: termin (edycja / nowy) ---------- */
function reminderSheet(id) {
  const v = veh(), old = id ? S.reminders.find(x => x.id === id) : null;
  const r = old || { type: 'oc', title: '', dueDate: '', dueKm: '', everyMonths: 12, everyKm: '', notes: '' };
  const body = `<form class="form" autocomplete="off">
    ${old ? '' : `<div class="fld"><span>Rodzaj terminu</span>${chips('type', Object.entries(RT).map(([k, t]) => ({ k, l: t.l, c: t.c, i: t.i })), r.type)}</div>`}
    <div id="r-title" ${r.type === 'inne' ? '' : 'hidden'}>${fld('Nazwa', inp('title', r.title, 'placeholder="np. Wymiana płynu hamulcowego"'))}</div>
    ${fld('Ważne do (data)', inp('dueDate', r.dueDate, 'type="date"'))}
    <div id="r-km" ${RT[r.type].km ? '' : 'hidden'}><div class="row2">${fld('Następnie przy (km)', unitIn('dueKm', r.dueKm, 'km', 'type="number" inputmode="numeric" min="0" placeholder="np. 160000"'))}${fld('Co ile km', unitIn('everyKm', r.everyKm || RT[r.type].km || '', 'km', 'type="number" inputmode="numeric" min="0"'))}</div></div>
    ${fld('Powtarzaj co (miesięcy)', unitIn('everyMonths', r.everyMonths || '', 'mies.', 'type="number" inputmode="numeric" min="0" placeholder="12"'))}
    ${fld('Notatki', inp('notes', r.notes, `placeholder="${esc(RT[r.type].ph)}" id="r-notes"`))}
    <p class="note" id="r-hint"></p>
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} ${old ? 'Zapisz' : 'Dodaj termin'}</button>${old ? `<button class="btn danger" type="button" data-act="del:rem.${id}">${ic('trash', 18)} Usuń</button>` : ''}</div></form>`;
  openSheet(old ? `Edytuj: ${remTitle(old)}` : 'Nowy termin', body, sh => {
    const form = fm($('form', sh));
    const upd = () => { const t = RT[form.type ? form.type.value : r.type]; $('#r-title', sh).hidden = (form.type ? form.type.value : r.type) !== 'inne'; $('#r-km', sh).hidden = !t.km; $('#r-notes', sh).placeholder = t.ph; if (!old) { form.everyMonths.value = t.m || ''; if (t.km) form.everyKm.value = t.km; } $('#r-hint', sh).textContent = (form.type ? form.type.value : r.type) === 'oc' ? 'Wskazówka: polisa OC wznawia się zwykle automatycznie — sprawdź datę w polisie i porównaj oferty przed odnowieniem.' : ''; };
    if (form.type) form.type.addEventListener('change', upd); upd();
    form.addEventListener('submit', e => {
      e.preventDefault(); const d = formData(form);
      const rec = { type: old ? old.type : d.type, title: (d.title || '').trim(), dueDate: d.dueDate || '', dueKm: num(d.dueKm) || '', everyMonths: num(d.everyMonths) || 0, everyKm: num(d.everyKm) || '', notes: d.notes.trim() };
      if (!rec.dueDate && !rec.dueKm) { toast('Podaj datę lub przebieg'); return; }
      if (old) Object.assign(old, rec); else S.reminders.push({ id: uid(), vid: v.id, ...rec });
      persist(); closeSheet(); render(); toast('Zapisano termin'); vibrate(12);
    });
  });
}
function renewSheet(id) {
  const r = S.reminders.find(x => x.id === id), t = RT[r.type] || RT.inne, info = remInfo(r), odo = curOdo(r.vid);
  const base = r.dueDate && r.dueDate >= today() ? r.dueDate : today();
  const nd = r.everyMonths ? addMonths(base, r.everyMonths) : '', nk = t.km ? odo + (r.everyKm || t.km) : '';
  const body = `<form class="form" autocomplete="off">
    <div class="glass banner lv-${info.level}" style="box-shadow:none"><span class="bi">${ic(t.i, 24)}</span><div><b>${esc(remTitle(r))}</b><span>${esc(info.text)}${info.sub ? ' · ' + esc(info.sub) : ''}</span></div></div>
    <div class="row2">${fld('Wykonano dnia', inp('done', today(), 'type="date" required'))}${t.km ? fld('Przebieg (km)', inp('odo', odo, 'type="number" inputmode="numeric" min="0"')) : ''}</div>
    <div class="row2">${fld('Nowy termin', inp('dueDate', nd, 'type="date"'))}${t.km ? fld('Następnie przy (km)', unitIn('dueKm', nk, 'km', 'type="number" inputmode="numeric" min="0"')) : ''}</div>
    ${fld('Koszt (opcjonalnie)', unitIn('cost', '', 'zł', 'type="number" inputmode="decimal" step="any" min="0" placeholder="0,00"'))}
    ${swtch('log', 'Dodaj do historii serwisowej', 'Wpis pojawi się w Serwisie i w raporcie', true)}
    <div class="sh-actions"><button class="btn" type="submit">${ic('check', 19)} Gotowe</button><button class="btn ghost" type="button" data-act="rem-edit:${id}">${ic('edit', 18)} Edytuj termin</button></div></form>`;
  openSheet('Odnowienie terminu', body, sh => {
    const form = fm($('form', sh));
    form.addEventListener('submit', e => {
      e.preventDefault(); const d = formData(form), cost = num(d.cost) || 0;
      if (d.log) S.services.push({ id: uid(), vid: r.vid, date: d.done, odo: t.km ? (num(d.odo) || 0) : 0, type: t.svc || 'inne', title: remTitle(r) + (r.notes ? ' – ' + r.notes : ''), cost, shop: '', notes: '' });
      if (t.km && num(d.odo)) bumpOdo(r.vid, num(d.odo));
      r.dueDate = d.dueDate || ''; r.dueKm = t.km ? (num(d.dueKm) || '') : '';
      persist(); closeSheet(); render(); toast('Termin zaktualizowany ✓'); confetti(); vibrate([10, 40, 18]);
    });
  });
}

/* ---------- ARKUSZ: ustawienia ---------- */
function settingsSheet() {
  const R = (a, i, c, t, d) => `<button class="rw" data-act="${a}"><span class="ico" style="--tc:${c}">${ic(i, 19)}</span><span class="mid"><b>${t}</b><span>${d}</span></span>${ic('chev', 18)}</button>`;
  const L = (href, i, c, t, d) => `<a class="rw" href="${href}" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><span class="ico" style="--tc:${c}">${ic(i, 19)}</span><span class="mid"><b>${t}</b><span>${d}</span></span>${ic('link', 17)}</a>`;
  const th = S.settings.theme, nSup = 'Notification' in window, np = nSup ? Notification.permission : 'denied';
  const body = `
  <div class="set-h">Wygląd</div><div class="seg">${[['auto', 'Auto'], ['dark', 'Ciemny'], ['light', 'Jasny']].map(([k, l]) => `<button class="${th === k ? 'on' : ''}" data-act="theme:${k}">${l}</button>`).join('')}</div>
  <div class="set-h">Przypomnienia</div><div class="rows">
    <div class="rw"><span class="ico" style="--tc:#fbbf24">${ic('bell', 19)}</span><span class="mid"><b>Ostrzegaj z wyprzedzeniem</b><span>Kiedy termin trafia w „zbliżające się”</span></span><select id="set-lead">${[7, 14, 30, 45, 60].map(n => `<option value="${n}" ${S.settings.lead === n ? 'selected' : ''}>${n} dni</option>`).join('')}</select></div>
    ${nSup ? R('notif', 'bell', '#22d3ee', 'Powiadomienia', np === 'granted' ? (S.settings.notif ? 'Włączone — pojawią się po otwarciu aplikacji' : 'Dotknij, aby włączyć') : np === 'denied' ? 'Zablokowane w ustawieniach przeglądarki' : 'Dotknij, aby zezwolić') : ''}</div>
  <div class="set-h">Eksport i kopia danych</div><div class="rows">
    ${R('report', 'file', '#a78bfa', 'Raport serwisowy (PDF)', 'Historia do sprzedaży auta')}${R('csv', 'download', '#34d399', 'Eksport do Excela (CSV)', 'Tankowania i serwisy, ' + veh().name)}${R('json', 'db', '#22d3ee', 'Kopia zapasowa (JSON)', 'Wszystkie dane — do przeniesienia na inny telefon')}${R('import', 'upload', '#fbbf24', 'Przywróć z kopii', 'Zastępuje obecne dane')}</div>
  <div class="set-h">Narzędzia</div><div class="rows">
    ${R('trip', 'calc', '#f472b6', 'Kalkulator kosztu trasy', 'Ile kosztuje przejazd i ile na osobę')}
    ${L('https://www.ufg.pl/', 'shield', '#34d399', 'Sprawdź OC w UFG', 'Ubezpieczeniowy Fundusz Gwarancyjny')}
    ${L('https://historiapojazdu.gov.pl/', 'history', '#60a5fa', 'Historia Pojazdu', 'Oficjalny serwis gov.pl (CEP)')}</div>
  <div class="set-h">Dane i aplikacja</div><div class="rows">${R('demo', 'spark', '#a78bfa', 'Wczytaj dane demo', 'Zobacz aplikację z przykładowymi wpisami')}${R('wipe', 'trash', '#fb7185', 'Usuń wszystkie dane', 'Nieodwracalne')}
    ${deferredInstall ? R('install', 'phone', '#22d3ee', 'Zainstaluj aplikację', 'Dodaj do ekranu startowego') : ''}</div>
  <p class="note" style="margin-top:18px;text-align:center">Dziennik Auta ${APP_VER} · dane przechowywane wyłącznie na tym urządzeniu.<br>Pamiętaj o okresowej kopii zapasowej (JSON).</p>`;
  openSheet('Więcej', body);
}
async function enableNotifications() {
  if (!('Notification' in window)) return toast('Ta przeglądarka nie obsługuje powiadomień');
  const p = await Notification.requestPermission();
  S.settings.notif = p === 'granted'; persist();
  toast(p === 'granted' ? 'Powiadomienia włączone' : 'Powiadomienia nie zostały zatwierdzone'); settingsSheet(); if (p === 'granted') checkNotifications(true);
}
async function checkNotifications(force) {
  try {
    if (!S.settings.notif || !('Notification' in window) || Notification.permission !== 'granted') return;
    const reg = navigator.serviceWorker && await navigator.serviceWorker.getRegistration(); const t = today();
    for (const r of attention()) {
      const k = r.id + t; if (S.notified[k] && !force) continue; S.notified[k] = 1;
      const i = remInfo(r), v = vById(r.vid), title = `${v ? (v.name || v.model) : 'Auto'} · ${remTitle(r)}`, opts = { body: i.text + (i.sub ? ' — ' + i.sub : ''), icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: r.id };
      if (reg && reg.showNotification) reg.showNotification(title, opts); else new Notification(title, opts);
    }
    S.notified = Object.fromEntries(Object.entries(S.notified).filter(([k]) => k.endsWith(t))); persist();
  } catch (e) {}
}

/* ---------- ARKUSZ: kalkulator trasy ---------- */
function tripSheet() {
  const v = veh(), st = stats(v.id, 'all'), { list } = fuelCalc(v.id), last = list[list.length - 1];
  const t = st.primary || last?.ft || v.fuel || 'pb95';
  openSheet('Kalkulator trasy', `<form class="form" autocomplete="off">
    <div class="row2">${fld('Dystans', unitIn('km', '', 'km', 'type="number" inputmode="decimal" step="any" placeholder="350"'))}${fld('Osób', inp('ppl', 1, 'type="number" inputmode="numeric" min="1" max="9"'))}</div>
    <div class="row2">${fld('Spalanie', unitIn('cons', st.avg[t] ? +st.avg[t].toFixed(1) : '', FUELS[t].u + '/100', 'type="number" inputmode="decimal" step="any" placeholder="6,5"'))}${fld('Cena', unitIn('price', last ? last.ppl : '', 'zł/' + FUELS[t].u, 'type="number" inputmode="decimal" step="any" placeholder="6,50"'))}</div>
    <div class="result"><span>Koszt paliwa na trasę</span><b class="num" id="t-total">—</b><span id="t-each"></span></div>
    <label class="sw"><div><b>Trasa w obie strony</b></div><input type="checkbox" name="rt"><i></i></label></form>`, sh => {
    const f = fm($('form', sh)), calc = () => {
      const km = num(f.km.value), c = num(f.cons.value), p = num(f.price.value), n = Math.max(1, num(f.ppl.value) || 1), mult = f.rt.checked ? 2 : 1;
      if (km > 0 && c > 0 && p > 0) { const tot = km * mult * c / 100 * p; $('#t-total', sh).textContent = money(tot); $('#t-each', sh).textContent = `${N1.format(km * mult * c / 100)} ${FUELS[t].u} · ${n > 1 ? money(tot / n) + ' na osobę' : 'wpisz liczbę osób, aby podzielić koszt'}`; } else { $('#t-total', sh).textContent = '—'; $('#t-each', sh).textContent = 'Wpisz dystans, spalanie i cenę'; }
    };
    f.addEventListener('input', calc); f.addEventListener('change', calc); calc();
  });
}

/* ---------- eksporty ---------- */
function download(name, content, mime) {
  const b = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
const slug = v => (v.plate || v.name || 'auto').replace(/[^\w]+/g, '-').toLowerCase();
function exportCSV() {
  const v = veh(), q = x => { x = String(x ?? ''); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }, d = x => String(x).replace('.', ',');
  const rows = [['Data', 'Typ', 'Rodzaj', 'Opis', 'Przebieg [km]', 'Ilość', 'Cena jedn. [zł]', 'Koszt [zł]', 'Miejsce', 'Uwagi']];
  S.fuels.filter(f => f.vid === v.id).forEach(f => rows.push([f.date, 'Tankowanie', FUELS[f.ft || 'pb95'].l, f.full ? 'do pełna' : 'częściowe', f.odo, d(f.liters), d(f.ppl.toFixed ? +f.ppl.toFixed(3) : f.ppl), d(f.total.toFixed(2)), f.station || '', '']));
  S.services.filter(s => s.vid === v.id).forEach(s => rows.push([s.date, 'Serwis', SVT[s.type]?.l || s.type, s.title, s.odo || '', '', '', d((+s.cost || 0).toFixed(2)), s.shop || '', s.notes || '']));
  rows.sort((a, b) => (a[0] === 'Data' ? -1 : b[0] === 'Data' ? 1 : a[0].localeCompare(b[0])));
  download(`dziennik-auta-${slug(v)}.csv`, '﻿' + rows.map(r => r.map(q).join(';')).join('\r\n'), 'text/csv;charset=utf-8'); toast('Pobrano plik CSV');
}
function exportJSON() { download(`dziennik-auta-kopia-${today()}.json`, JSON.stringify({ ...S, exported: new Date().toISOString(), app: 'dziennik-auta' }, null, 1), 'application/json'); toast('Pobrano kopię zapasową'); }
$('#import-file').addEventListener('change', async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  try {
    const j = JSON.parse(await file.text()); if (!j || !Array.isArray(j.vehicles) || !Array.isArray(j.fuels) || !Array.isArray(j.services)) throw 0;
    if (!confirm(`Przywrócić kopię: ${j.vehicles.length} ${plural(j.vehicles.length, 'pojazd', 'pojazdy', 'pojazdów')}, ${j.fuels.length} tankowań, ${j.services.length} wpisów serwisowych?\nObecne dane zostaną zastąpione.`)) return;
    S = { ...DEF(), ...j, settings: { ...DEF().settings, ...(j.settings || {}) }, reminders: j.reminders || [] }; persist(); closeSheet(); ui.tab = 'home'; render({ enter: true }); toast('Przywrócono dane');
  } catch (err) { toast('To nie jest poprawny plik kopii Dziennika Auta'); }
});
function exportICS(items) {
  items = items.filter(r => r.dueDate); if (!items.length) return toast('Brak terminów z datą do wyeksportowania');
  const e = s => String(s).replace(/\\/g, '\\\\').replace(/([,;])/g, '\\$1').replace(/\n/g, '\\n'), stamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dziennik Auta//PL', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:Dziennik Auta'];
  for (const r of items) {
    const v = vById(r.vid), name = `${remTitle(r)} — ${v ? (v.name || v.model) : 'auto'}`, d1 = r.dueDate.replace(/-/g, ''), d2 = addDays(r.dueDate, 1).replace(/-/g, '');
    L.push('BEGIN:VEVENT', `UID:${r.id}@dziennik-auta`, `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${d1}`, `DTEND;VALUE=DATE:${d2}`, `SUMMARY:${e('🚗 ' + name)}`, `DESCRIPTION:${e((r.notes ? r.notes + '\n' : '') + 'Dodano z aplikacji Dziennik Auta')}`);
    for (const [tr, tx] of [['-P13DT15H', 'za 14 dni'], ['-P6DT15H', 'za 7 dni'], ['-PT15H', 'jutro']]) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${e(name + ' — ' + tx)}`, `TRIGGER;RELATED=START:${tr}`, 'END:VALARM');
    L.push('END:VEVENT');
  }
  L.push('END:VCALENDAR'); download(`terminy-dziennik-auta.ics`, L.join('\r\n'), 'text/calendar;charset=utf-8'); toast('Otwórz plik, aby dodać terminy do kalendarza');
}

/* ---------- raport do sprzedaży ---------- */
function odoConsistent(id) {
  const a = [...S.fuels, ...S.services].filter(x => x.vid === id && x.odo > 0).sort((x, y) => x.date.localeCompare(y.date) || x.odo - y.odo);
  if (a.length < 3) return null; for (let i = 1; i < a.length; i++) if (a[i].odo < a[i - 1].odo) return false; return a.length;
}
const REPORT_CSS = `.rp{font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#141826;font-size:13.5px;line-height:1.45}.rp h1{font-size:26px;margin:0;letter-spacing:-.02em}.rp .hd{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;border-bottom:3px solid #6d4aff;padding-bottom:14px}.rp .brand{font-size:11px;color:#6b7390;text-transform:uppercase;letter-spacing:.12em;font-weight:700}.rp .plate{display:inline-flex;border:2px solid #111;border-radius:6px;overflow:hidden;font:700 18px/1 ui-monospace,Menlo,monospace;letter-spacing:.06em;background:#fff}.rp .plate i{background:#0b3d91;color:#fff;font:800 9px/1 sans-serif;padding:8px 5px;display:grid;place-items:center;font-style:normal}.rp .plate b{padding:8px 10px}.rp .kv{display:grid;grid-template-columns:repeat(2,1fr);gap:6px 24px;margin:14px 0}.rp .kv div{display:flex;justify-content:space-between;gap:10px;border-bottom:1px dotted #cfd5e6;padding:4px 0}.rp .kv span{color:#6b7390}.rp .kv b{text-align:right}.rp .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin:14px 0}.rp .st{border:1px solid #dde2ee;border-radius:10px;padding:10px 12px;background:#f7f8fd}.rp .st small{display:block;color:#6b7390;font-size:11px}.rp .st b{font-size:18px}.rp h2{font-size:15px;margin:22px 0 8px;letter-spacing:-.01em}.rp table{width:100%;border-collapse:collapse;font-size:12.5px}.rp th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7390;border-bottom:2px solid #141826;padding:6px 6px}.rp td{padding:7px 6px;border-bottom:1px solid #e3e7f1;vertical-align:top}.rp td.r,.rp th.r{text-align:right;white-space:nowrap}.rp tr{break-inside:avoid}.rp .ok{display:inline-block;background:#e6f8ef;color:#0c7a4d;border-radius:8px;padding:3px 9px;font-weight:700;font-size:12px}.rp .foot{margin-top:26px;padding-top:12px;border-top:1px solid #dde2ee;color:#6b7390;font-size:11.5px}.rp .sig{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:38px}.rp .sig div{border-top:1px solid #141826;padding-top:5px;color:#6b7390;font-size:11.5px}.rp .muted{color:#6b7390}`;
function reportHTML(v, o) {
  const sv = S.services.filter(x => x.vid === v.id).sort((a, b) => a.date.localeCompare(b.date) || a.odo - b.odo);
  const odo = curOdo(v.id), total = sum(sv, 'cost'), rev = [...sv].reverse();
  const oil = rev.find(x => x.type === 'olej'), insp = rev.find(x => x.type === 'badanie' || x.type === 'przeglad');
  const docs = S.reminders.filter(r => r.vid === v.id && r.dueDate && (r.type === 'oc' || r.type === 'przeglad'));
  const cs = odoConsistent(v.id), fs = stats(v.id, 'all'), fuelN = fs.fl.length;
  const kv = (k, val) => val ? `<div><span>${k}</span><b>${esc(val)}</b></div>` : '';
  return `<style>${REPORT_CSS}</style><div class="rp">
    <div class="hd"><div><div class="brand">Historia serwisowa pojazdu</div><h1>${esc([v.make, v.model].filter(Boolean).join(' ') || v.name)}${v.year ? ' (' + v.year + ')' : ''}</h1></div>${v.plate ? `<span class="plate"><i>PL</i><b>${esc(v.plate)}</b></span>` : ''}</div>
    <div class="kv">${kv('Marka i model', [v.make, v.model].filter(Boolean).join(' '))}${kv('Rok produkcji', v.year)}${kv('Numer VIN', v.vin)}${kv('Rodzaj paliwa', FUELS[v.fuel || 'pb95'].l)}${kv('Aktualny przebieg', kmf(odo))}${kv('Data raportu', fmtD(today()))}${docs.map(r => kv(RT[r.type].l + ' ważne do', fmtD(r.dueDate))).join('')}</div>
    <div class="stats"><div class="st"><small>Wpisy serwisowe</small><b>${sv.length}</b></div>${o.costs ? `<div class="st"><small>Łączny koszt serwisów</small><b>${money0(total)}</b></div>` : ''}<div class="st"><small>Ostatnia wymiana oleju</small><b>${oil ? fmtDs(oil.date) + (oil.odo ? '<br><small>' + kmf(oil.odo) + '</small>' : '') : '—'}</b></div><div class="st"><small>Ostatni przegląd / badanie</small><b>${insp ? fmtDs(insp.date) : '—'}</b></div>${o.fuel && fs.primary ? `<div class="st"><small>Średnie spalanie</small><b>${N1.format(fs.avg[fs.primary])} ${FUELS[fs.primary].u}/100 km</b></div>` : ''}</div>
    ${cs ? `<p><span class="ok">✓ Spójny przebieg</span> <span class="muted">— ${cs} ${plural(cs, 'zapis', 'zapisy', 'zapisów')} w historii układa się w rosnącej kolejności.</span></p>` : ''}
    <h2>Historia napraw i przeglądów</h2>
    ${sv.length ? `<table><thead><tr><th>Data</th><th class="r">Przebieg</th><th>Rodzaj</th><th>Opis</th><th>Warsztat</th>${o.costs ? '<th class="r">Koszt</th>' : ''}</tr></thead><tbody>${sv.map(s => `<tr><td>${fmtD(s.date)}</td><td class="r">${s.odo ? N0.format(s.odo) + ' km' : '—'}</td><td>${esc(SVT[s.type]?.l || s.type)}</td><td>${esc(s.title || '')}${s.notes ? `<div class="muted">${esc(s.notes)}</div>` : ''}</td><td>${esc(s.shop || '')}</td>${o.costs ? `<td class="r">${s.cost ? money(s.cost) : '—'}</td>` : ''}</tr>`).join('')}</tbody>${o.costs ? `<tfoot><tr><td colspan="5" class="r"><b>Razem</b></td><td class="r"><b>${money(total)}</b></td></tr></tfoot>` : ''}</table>` : '<p class="muted">Brak wpisów serwisowych.</p>'}
    ${o.fuel && fuelN ? `<h2>Eksploatacja</h2><p>Zapisano ${fuelN} ${plural(fuelN, 'tankowanie', 'tankowania', 'tankowań')}${fs.kmRange ? ` w okresie obejmującym około ${kmf(fs.kmRange)}` : ''}${fs.primary ? `; średnie spalanie ${N1.format(fs.avg[fs.primary])} ${FUELS[fs.primary].u}/100 km` : ''}.</p>` : ''}
    <div class="foot">Raport wygenerowano w aplikacji Dziennik Auta dnia ${fmtD(today())}. Dane zostały wprowadzone przez właściciela pojazdu i nie stanowią dokumentu urzędowego; nie zastępują książki serwisowej ani faktur.</div>
    <div class="sig"><div>Sprzedający</div><div>Kupujący</div></div></div>`;
}
function openReport() {
  const v = veh(), o = ui.rp, r = $('#report');
  r.innerHTML = `<div class="rp-bar no-print"><button class="btn ghost" data-act="rp-close">${ic('x', 17)} Zamknij</button><span class="sp"></span>
    <label><input type="checkbox" id="rp-costs" ${o.costs ? 'checked' : ''}> Koszty</label><label><input type="checkbox" id="rp-fuel" ${o.fuel ? 'checked' : ''}> Spalanie</label>
    <button class="btn ghost" data-act="rp-html">${ic('download', 17)} HTML</button><button class="btn" data-act="rp-print">${ic('file', 17)} PDF / Drukuj</button></div>
    <div class="rp-paper">${reportHTML(v, o)}</div>`;
  r.classList.add('open'); r.scrollTop = 0; document.body.style.overflow = 'hidden';
  $('#rp-costs', r).onchange = e => { ui.rp.costs = e.target.checked; $('.rp-paper', r).innerHTML = reportHTML(v, ui.rp); };
  $('#rp-fuel', r).onchange = e => { ui.rp.fuel = e.target.checked; $('.rp-paper', r).innerHTML = reportHTML(v, ui.rp); };
}
function closeReport() { const r = $('#report'); if (r.classList.contains('open')) { r.classList.remove('open'); r.innerHTML = ''; document.body.style.overflow = ''; } }

/* ---------- dane demo ---------- */
function loadDemo() {
  const now = today(), ago = n => addDays(now, -n), rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
  const v1 = { id: uid(), name: 'Octavia', make: 'Škoda', model: 'Octavia III 2.0 TDI', year: 2018, plate: 'WX 4821K', vin: 'TMBJJ7NE0J0123456', fuel: 'on', odo: 158900, color: '#6d4aff' };
  const v2 = { id: uid(), name: 'Yaris', make: 'Toyota', model: 'Yaris Hybrid', year: 2021, plate: 'KR 39PL1', vin: '', fuel: 'pb95', odo: 41200, color: '#10b981' };
  const odoAt = n => 158900 - Math.round(n * 53);
  for (let i = 0; i < 14; i++) {
    const n = 300 - i * 21, cons = 5.7 + 0.5 * Math.sin(i * 1.3) + rnd() * .3, ppl = +(6.15 + 0.3 * Math.sin(i * .7) + rnd() * .08).toFixed(2), liters = i === 0 ? 44.2 : +(1113 * cons / 100).toFixed(2);
    S.fuels.push({ id: uid(), vid: v1.id, date: ago(n), odo: odoAt(n), ft: 'on', liters, ppl, total: +(liters * ppl).toFixed(2), full: true, station: ['Orlen', 'BP', 'Circle K', 'Shell'][i % 4] });
  }
  for (let i = 0; i < 7; i++) {
    const n = 200 - i * 28, cons = 6.4 + 0.6 * Math.sin(i * 1.1) + rnd() * .3, ppl = +(6.0 + 0.25 * Math.sin(i * .9)).toFixed(2), km = 900, liters = i === 0 ? 34.1 : +(km * cons / 100).toFixed(2);
    S.fuels.push({ id: uid(), vid: v2.id, date: ago(n), odo: 41200 - Math.round(n * 30), ft: 'pb95', liters, ppl, total: +(liters * ppl).toFixed(2), full: true, station: ['Orlen', 'MOL', 'Moya'][i % 3] });
  }
  const sv = (v, n, odo, type, title, cost, shop, notes = '') => S.services.push({ id: uid(), vid: v.id, date: ago(n), odo, type, title, cost, shop, notes });
  sv(v1, 285, odoAt(285), 'olej', 'Olej 5W-30 LL + filtry (oleju, powietrza, kabinowy)', 689, 'Auto-Serwis Kowalski', 'Olej Castrol Edge 5W-30, 4,3 l');
  sv(v1, 244, odoAt(244), 'naprawa', 'Wymiana klocków i tarcz hamulcowych (przód)', 1240, 'Auto-Serwis Kowalski');
  sv(v1, 196, odoAt(196), 'opony', 'Zmiana opon na letnie + wyważanie', 140, 'Vulkan Express');
  sv(v1, 150, odoAt(150), 'naprawa', 'Wymiana akumulatora 70Ah', 520, 'Auto-Serwis Kowalski', 'Gwarancja 24 mies.');
  sv(v1, 118, odoAt(118), 'badanie', 'Okresowe badanie techniczne', 99, 'SKP Mokotów');
  sv(v1, 96, odoAt(96), 'ubezpieczenie', 'OC + AC — składka roczna', 1980, 'PZU');
  sv(v1, 45, odoAt(45), 'myjnia', 'Mycie, czyszczenie wnętrza i wosk', 280, 'Detailing Studio');
  sv(v2, 150, 41200 - 150 * 30, 'przeglad', 'Przegląd 40 tys. km', 690, 'Toyota Dealer');
  sv(v2, 100, 41200 - 100 * 30, 'ubezpieczenie', 'OC — składka roczna', 760, 'Warta');
  const R = (v, type, dueDate, dueKm, everyKm, notes = '') => S.reminders.push({ id: uid(), vid: v.id, type, title: '', dueDate, dueKm, everyMonths: RT[type].m, everyKm, notes });
  R(v1, 'oc', addDays(now, 18), '', '', 'PZU · polisa 123456789');
  R(v1, 'przeglad', addDays(now, 64), '', '', 'SKP Mokotów');
  R(v1, 'olej', addMonths(ago(285), 12), odoAt(285) + 15000, 15000, 'Castrol Edge 5W-30');
  R(v1, 'opony', addDays(now, 11), '', '', 'Zmiana na zimowe');
  R(v2, 'oc', addDays(now, 190), '', '', 'Warta');
  R(v2, 'przeglad', addDays(now, 400), '', '', '');
  R(v2, 'olej', addDays(now, 210), 55000, 15000, '');
  S.vehicles.push(v1, v2); S.active = v1.id; persist(); ui.tab = 'home';
}

/* ---------- start ---------- */
addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (S.vehicles.length && ui.tab === 'home') render(); });
addEventListener('appinstalled', () => { deferredInstall = null; toast('Zainstalowano Dziennik Auta'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); checkNotifications(); } });

function boot() {
  const q = new URLSearchParams(location.search), h = location.hash.replace('#', '');
  if (['reminders', 'fuel', 'service'].includes(q.get('tab') || h)) ui.tab = q.get('tab') || h;
  render({ enter: true });
  setTimeout(() => $('#splash').classList.add('hide'), rm ? 100 : 1250);
  setTimeout(() => { const el = $('#splash'); el && el.remove(); }, 2100);
  if (S.vehicles.length) {
    const a = q.get('action'); if (a === 'fuel') setTimeout(() => fuelSheet(), 1300); if (a === 'service') setTimeout(() => serviceSheet(), 1300);
    checkNotifications();
  }
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    const had = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (had) toast('Aplikacja została zaktualizowana'); });
  }
}
boot();
})();
