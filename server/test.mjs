// Testy serwera push Dziennika Auta: node test.mjs (podstawiona wysyłka, bez sieci).
import assert from 'node:assert/strict';
process.env.VAPID_PUBLIC = 'x'; process.env.VAPID_PRIVATE = 'y'; process.env.DATA_FILE = '/tmp/auta-push-test.json';
const m = await import('./push-server.mjs');
m.loadDb('/nonexistent'); let got = []; m.setSender(async (s, p) => { got.push({ to: s.endpoint, ...JSON.parse(p) }); });
const mk = (n) => ({ endpoint: `https://web.push.apple.com/${n}`, keys: { p256dh: 'a', auth: 'b' } });
const A = 'phone_A_0123456789abcd', B = 'phone_B_0123456789abcd', C = 'phone_C_0123456789abcd';
const T = 1_800_000_000_000, H = 3600e3, D = 864e5;
const reg = async (id, n, now = T, ip = '1.1.1.1') => m.handle('POST', '/register', {}, { deviceId: id, subscription: mk(n) }, now, ip);

// rejestracja i dozwolone serwery push
assert.equal((await m.handle('POST', '/register', {}, { deviceId: 'zk', subscription: mk('x') }, T))[0], 400, 'zły identyfikator');
for (const ep of ['http://web.push.apple.com/x', 'https://evil.example/x', 'https://127.0.0.1/x', 'https://localhost/x', 'https://web.push.apple.com.evil.com/x', 'https://fcm.googleapis.com:8443/x', 'https://u:p@fcm.googleapis.com/x', 'https://169.254.169.254/latest'])
  assert.equal((await m.handle('POST', '/register', {}, { deviceId: A, subscription: { endpoint: ep, keys: { p256dh: 'a', auth: 'b' } } }, T))[0], 400, 'odrzucono ' + ep);
for (const ep of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc', 'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/w/?token=abc'])
  assert.ok(m.allowedEndpoint(ep), 'dozwolono ' + ep);

let r = await reg(A, 'a'); assert.equal(r[0], 200); const tA = r[1].token; assert.ok(tA);
r = await reg(B, 'b'); const tB = r[1].token; r = await reg(C, 'c'); const tC = r[1].token;
assert.notEqual(tA, tB);
assert.equal((await reg(A, 'a2'))[0], 401, 'ponowna rejestracja cudzego id bez tokenu');
assert.equal((await m.handle('POST', '/register', { authorization: 'Bearer ' + tB }, { deviceId: A, subscription: mk('a2') }, T))[0], 401, 'token B nie otwiera A');
assert.equal((await m.handle('POST', '/register', { authorization: 'Bearer ' + tA }, { deviceId: A, subscription: mk('a2') }, T))[0], 200, 'własny token odnawia subskrypcję');
assert.equal(JSON.stringify(m.getDb()).includes(tA), false, 'serwer nie trzyma tokenu jawnie');

// harmonogram: walidacja i czyszczenie
const it = (id, at, title, body) => ({ id, at, title, body, tag: id, url: './?tab=reminders' });
assert.equal((await m.handle('POST', '/sync', {}, { deviceId: A, items: [] }, T))[0], 401, 'sync bez tokenu');
assert.equal((await m.handle('POST', '/sync', { authorization: 'Bearer ' + tA }, { deviceId: A, items: 'zle' }, T))[0], 400);
r = await m.handle('POST', '/sync', { authorization: 'Bearer ' + tA }, { deviceId: A, items: [
  it('r1', T + 1 * H, 'Octavia · OC', 'Za 7 dni'), it('r1', T + 2 * H, 'dubel', 'x'), it('r2', T + 3 * D, 'Octavia · Przegląd', 'Za 1 dzień'),
  it('stare', T - 20 * H, 'dawne', 'x'), it('daleko', T + 900 * D, 'za daleko', 'x'), { at: 'abc' }, null,
  { id: 'xss', at: T + 5 * H, title: 'a'.repeat(500), body: 'b'.repeat(900), url: 'https://evil.example' }] }, T);
assert.equal(r[0], 200); assert.equal(r[1].items, 3, 'zostają: r1, r2, xss');
const items = m.getDb().devices[A].items;
assert.equal(items.find((x) => x.id === 'xss').title.length, 100); assert.equal(items.find((x) => x.id === 'xss').body.length, 240);
assert.equal(items.find((x) => x.id === 'xss').url, './?tab=reminders', 'obcy adres zamieniony na bezpieczny');

// B planuje swoje, C nic
await m.handle('POST', '/sync', { authorization: 'Bearer ' + tB }, { deviceId: B, items: [it('b1', T + 2 * H, 'Golf · Olej', 'B')] }, T);

// wysyłka: każdy dostaje tylko swoje
got = [];
assert.equal(await m.runDue(T + 30 * 60e3), 0);
assert.equal(await m.runDue(T + 1 * H + 1000), 1); assert.deepEqual(got.map((x) => x.to + '|' + x.title), ['https://web.push.apple.com/a2|Octavia · OC']);
assert.equal(await m.runDue(T + 1 * H + 5000), 0, 'tylko raz');
await m.runDue(T + 2 * H + 1000); assert.ok(got.some((x) => x.to === 'https://web.push.apple.com/b' && x.title === 'Golf · Olej'));
assert.ok(!got.some((x) => x.to.endsWith('/c')), 'C nic nie dostał');
assert.ok(got.filter((x) => x.to.endsWith('/b')).length === 1 && got.filter((x) => x.to.endsWith('/a2')).length === 1);

// nowy sync zastępuje stary harmonogram (usunięty termin nie wysyła)
await m.handle('POST', '/sync', { authorization: 'Bearer ' + tA }, { deviceId: A, items: [] }, T + 3 * H);
got = []; await m.runDue(T + 4 * D); assert.equal(got.length, 0, 'po usunięciu terminów cisza');

// spóźnione ponad 6 h pomijane (np. awaria serwera)
await m.handle('POST', '/sync', { authorization: 'Bearer ' + tA }, { deviceId: A, items: [it('x', T + 10 * H, 'x', 'x')] }, T + 9 * H);
got = []; assert.equal(await m.runDue(T + 17 * H), 0, 'spóźnione 7 h pominięte');
await m.handle('POST', '/sync', { authorization: 'Bearer ' + tA }, { deviceId: A, items: [it('y', T + 20 * H, 'y', 'y')] }, T + 19 * H);
assert.equal(await m.runDue(T + 22 * H), 1, 'spóźnione 2 h nadal wysłane');

// limit dobowy
{
  const many = Array.from({ length: 40 }, (_, i) => it('k' + i, T + 30 * D + i * 1000, 'k' + i, 'x'));
  await m.handle('POST', '/sync', { authorization: 'Bearer ' + tB }, { deviceId: B, items: many }, T + 29 * D);
  got = []; await m.runDue(T + 30 * D + 60000);
  assert.equal(got.filter((x) => x.to.endsWith('/b')).length, 25, 'maks. 25 push na dobę');
}

// test, wypisanie, wygasłe urządzenie
got = []; r = await m.handle('POST', '/test', { authorization: 'Bearer ' + tC }, { deviceId: C }, T + 40 * D); assert.equal(r[0], 200); assert.equal(got[0].to, 'https://web.push.apple.com/c');
assert.equal((await m.handle('POST', '/unsubscribe', { authorization: 'Bearer ' + tC }, { deviceId: C }, T))[0], 200); assert.ok(!m.getDb().devices[C]);
await reg(C, 'c'); // C zarejestrowany od nowa
m.setSender(async () => { throw Object.assign(new Error('gone'), { statusCode: 410 }); });
const tC2 = (await m.handle('POST', '/register', {}, { deviceId: 'phone_D_0123456789abcd', subscription: mk('d') }, T + 41 * D, '2.2.2.2'))[1].token;
await m.handle('POST', '/sync', { authorization: 'Bearer ' + tC2 }, { deviceId: 'phone_D_0123456789abcd', items: [it('z', T + 41 * D + 5000, 'z', 'z')] }, T + 41 * D);
await m.runDue(T + 41 * D + 6000); assert.ok(!m.getDb().devices['phone_D_0123456789abcd'], 'wygasły (410) usunięty');

// limit rejestracji z jednego adresu i nieaktywne urządzenia
{
  m.loadDb('/nonexistent'); let ok = 0, lim = 0;
  for (let i = 0; i < 15; i++) { const x = await m.handle('POST', '/register', {}, { deviceId: 'flood_' + String(i).padStart(14, '0') + 'xx', subscription: mk('f' + i) }, T, '9.9.9.9'); x[0] === 200 ? ok++ : x[0] === 429 && lim++; }
  assert.equal(ok, 12); assert.equal(lim, 3);
  assert.equal((await m.handle('POST', '/register', {}, { deviceId: 'flood_other_0123456789', subscription: mk('g') }, T, '8.8.8.8'))[0], 200, 'inny adres nie jest blokowany');
  await m.runDue(T + 300 * D); assert.equal(Object.keys(m.getDb().devices).length, 0, 'nieaktywne po 200 dniach usunięte');
}
console.log('OK — wszystkie testy serwera przeszły');
