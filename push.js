/* Dziennik Auta – powiadomienia push z własnego serwera.
   Aplikacja liczy harmonogram przypomnień (kiedy i jaki tekst pokazać) i wysyła go na serwer, który o właściwej porze
   wysyła push przez Apple/Google. Dane tego telefonu są przypisane do losowego identyfikatora i tokenu zapisanych
   TYLKO na tym telefonie (poza kopią zapasową), więc każdy użytkownik aplikacji dostaje wyłącznie własne powiadomienia. */
(function (root) {
  'use strict';
  const KEY = 'dziennik-auta:push';
  const DEF_URL = 'https://188-68-247-201.sslip.io/auta-push';
  const DAY = 864e5;

  /* ---------- harmonogram (czysta funkcja, testowana w Node) ---------- */
  const pl = (n, a, b, c) => n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && !(n % 100 >= 12 && n % 100 <= 14)) ? b : c;
  const nf = new Intl.NumberFormat('pl-PL');
  const dmy = (s) => { const [y, m, d] = s.split('-').map(Number); return { y, m, d }; };
  const at = (s, offDays, hour) => { const { y, m, d } = dmy(s); return new Date(y, m - 1, d + offDays, hour, 0, 0, 0).getTime(); };
  const fmtDate = (s) => { const { y, m, d } = dmy(s); return new Date(y, m - 1, d).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }); };

  /* in: { reminders, lead, hour, now, vehName(vid), title(r), odo(vid), rate(vid) } -> [{id, at, title, body, tag, url}] */
  function build(o) {
    const now = o.now || Date.now(), hour = Math.min(22, Math.max(5, +o.hour || 9)), lead = Math.min(60, Math.max(1, +o.lead || 30));
    const before = [...new Set([lead, 14, 7, 1, 0])].sort((a, b) => b - a), after = [1, 3, 7];
    const out = [], limit = now + 440 * DAY;
    const add = (r, key, when, body) => {
      if (!(when > now + 60e3) || when > limit) return;
      out.push({ id: `${r.id}:${key}`, at: when, title: `${o.vehName(r.vid)} · ${o.title(r)}`, body, tag: r.id, url: './?tab=reminders' });
    };
    for (const r of o.reminders || []) {
      if (!r || !r.id) continue;
      if (r.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(r.dueDate)) {
        for (const off of before) {
          const body = off === 0 ? `Termin mija dziś (${fmtDate(r.dueDate)}).` : off === 1 ? `Jutro mija termin (${fmtDate(r.dueDate)}).` : `Zostało ${off} ${pl(off, 'dzień', 'dni', 'dni')} — termin ${fmtDate(r.dueDate)}.`;
          add(r, 'b' + off, at(r.dueDate, -off, hour), body);
        }
        for (const off of after) add(r, 'a' + off, at(r.dueDate, off, hour), `Po terminie o ${off} ${pl(off, 'dzień', 'dni', 'dni')}. Odnów lub zaktualizuj termin w aplikacji.`);
      }
      if (r.dueKm && o.odo && o.rate) {
        // termin przebiegowy: szacujemy, kiedy zostanie ok. 1500 km (na podstawie średniego dziennego przebiegu)
        const left = r.dueKm - o.odo(r.vid), rate = o.rate(r.vid);
        if (left > 1500 && rate >= 3) {
          const t = new Date(now + (left - 1500) / rate * DAY); t.setHours(hour, 0, 0, 0);
          add(r, 'k', t.getTime(), `Zbliża się przebieg ${nf.format(r.dueKm)} km — szacunkowo zostało ok. 1 500 km. Sprawdź licznik i zaktualizuj przebieg.`);
        }
      }
    }
    return out.sort((a, b) => a.at - b.at).slice(0, 300);
  }

  /* średni dzienny przebieg z historii (min. 30 dni rozpiętości) */
  function dailyRate(points) {
    const p = (points || []).filter((x) => x && x.date && x.odo > 0).sort((a, b) => a.date.localeCompare(b.date));
    if (p.length < 2) return 0;
    const a = p[0], b = p[p.length - 1], days = (Date.parse(b.date) - Date.parse(a.date)) / DAY;
    return days >= 30 && b.odo > a.odo ? (b.odo - a.odo) / days : 0;
  }

  /* ---------- połączenie z serwerem (tylko w przeglądarce) ---------- */
  const store = {
    get() { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } },
    set(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) { } },
  };
  const supported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  const b64 = (x) => { const p = '='.repeat((4 - x.length % 4) % 4); const r = atob((x + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };
  const newId = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return btoa(String.fromCharCode(...a)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, ''); };

  async function api(c, path, body, method) {
    const init = { method: method || 'POST', headers: { 'Content-Type': 'application/json', ...(c.token ? { Authorization: 'Bearer ' + c.token } : {}) } };
    if (init.method === 'POST') init.body = JSON.stringify(body || {});
    let r; try { r = await fetch(c.url + path, init); } catch (e) { throw Object.assign(new Error('Nie mogę połączyć się z serwerem. Sprawdź internet i spróbuj ponownie.'), { net: true }); }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(j.error || 'Błąd serwera ' + r.status), { status: r.status });
    return j;
  }
  async function subscription(url, create) {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub && create) { const { publicKey } = await api({ url }, '/vapid', null, 'GET'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(publicKey) }); }
    return sub;
  }
  async function register(url, sub, prev) {
    const mk = async (reuse) => {
      const c = { url, deviceId: reuse && prev && prev.deviceId ? prev.deviceId : newId(), token: reuse && prev ? prev.token || '' : '', hash: '', at: Date.now(), endpoint: sub.endpoint };
      const res = await api(c, '/register', { deviceId: c.deviceId, subscription: sub.toJSON() });
      if (res.token) c.token = res.token;
      return c;
    };
    let c; try { c = await mk(true); } catch (e) { if (e.status === 401 && prev) c = await mk(false); else throw e; }
    store.set(c); return c;
  }
  async function connect(url) {
    if (!supported()) throw new Error('Ta przeglądarka nie obsługuje powiadomień push. Na iPhonie dodaj aplikację do ekranu początkowego i otwórz ją stamtąd.');
    url = String(url || DEF_URL).trim().replace(/\/+$/, '');
    if (!/^https:\/\//.test(url)) throw new Error('Adres serwera musi zaczynać się od https://');
    if (Notification.permission !== 'granted') { const p = await Notification.requestPermission(); if (p !== 'granted') throw new Error('Powiadomienia nie zostały zatwierdzone. Zezwól na nie w ustawieniach telefonu.'); }
    const sub = await subscription(url, true);
    return register(url, sub, store.get());
  }
  /* wysyła harmonogram; sam odnawia rejestrację, gdy serwer zapomniał telefon lub subskrypcja wygasła */
  async function sync(items, force) {
    let c = store.get(); if (!c) return null;
    const hash = JSON.stringify(items.map((i) => [i.id, i.at, i.title, i.body]));
    if (!force && c.hash === hash && Date.now() - (c.synced || 0) < 5 * DAY) return { skipped: true, count: items.length };
    const send = async () => api(c, '/sync', { deviceId: c.deviceId, items });
    let res;
    try { res = await send(); }
    catch (e) {
      if (e.status !== 401) throw e;
      const sub = await subscription(c.url, true); c = await register(c.url, sub, null); res = await send();
    }
    c.hash = hash; c.synced = Date.now(); c.count = items.length; c.next = items[0] ? items[0].at : null; store.set(c);
    return { count: items.length, next: c.next };
  }
  /* przy starcie aplikacji: jeśli system usunął subskrypcję lub zmienił adres, zarejestruj ponownie */
  async function ensure() {
    const c = store.get(); if (!c || !supported() || Notification.permission !== 'granted') return false;
    const sub = await subscription(c.url, true);
    if (sub.endpoint !== c.endpoint) { await register(c.url, sub, c); const n = store.get(); n.hash = ''; store.set(n); }
    return true;
  }
  async function test() { const c = store.get(); if (!c) throw new Error('Najpierw włącz powiadomienia push.'); return api(c, '/test', { deviceId: c.deviceId }); }
  async function disconnect() {
    const c = store.get(); store.set(null);
    try { if (c) await api(c, '/unsubscribe', { deviceId: c.deviceId }); } catch (e) { }
    try { const sub = await subscription(null, false); if (sub) await sub.unsubscribe(); } catch (e) { }
  }

  const api_ = { build, dailyRate, connect, sync, ensure, test, disconnect, supported, standalone, cfg: store.get, DEF_URL };
  if (typeof module !== 'undefined' && module.exports) module.exports = api_; else root.AutaPush = api_;
})(typeof window !== 'undefined' ? window : this);
