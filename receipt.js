/* Parser paragonów ze stacji paliw: z tekstu OCR wyciąga litry, cenę, kwotę, datę, stację i rodzaj paliwa.
   Metoda: szukamy trójki liczb (ilość × cena ≈ kwota), więc działa nawet gdy OCR przekłamie etykiety. */
(function (root) {
  'use strict';
  const STATIONS = [
    ['ORLEN', 'Orlen'], ['LOTOS', 'Lotos'], ['BP', 'BP'], ['SHELL', 'Shell'], ['CIRCLE K', 'Circle K'], ['CIRCLEK', 'Circle K'],
    ['MOL', 'MOL'], ['MOYA', 'Moya'], ['AMIC', 'Amic'], ['AUCHAN', 'Auchan'], ['CARREFOUR', 'Carrefour'], ['INTERMARCHE', 'Intermarché'],
    ['GREENWAY', 'GreenWay'], ['TAURON', 'Tauron'], ['LIDL', 'Lidl'], ['PKN', 'Orlen'],
  ];
  const toNum = s => parseFloat(String(s).replace(/\s/g, '').replace(',', '.'));

  function parseDate(t) {
    let m = t.match(/\b(20\d{2})[-./](0[1-9]|1[0-2])[-./](0[1-9]|[12]\d|3[01])\b/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    m = t.match(/\b(0[1-9]|[12]\d|3[01])[-./](0[1-9]|1[0-2])[-./](20\d{2})\b/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    m = t.match(/\b(0[1-9]|[12]\d|3[01])[-./](0[1-9]|1[0-2])[-./](\d{2})\b/);
    if (m) return `20${m[3]}-${m[2]}-${m[1]}`;
    return null;
  }
  function parseFuel(t) {
    const u = t.toUpperCase();
    if (/\bLPG\b|AUTOGAZ/.test(u)) return 'lpg';
    if (/\bPB ?98\b|98 ?OKT|BENZYNA 98|V-?POWER|VERVA 98|EFECTA 98/.test(u)) return 'pb98';
    if (/\bPB ?95\b|95 ?OKT|BENZYNA|EFECTA 95|VERVA 95|\bE5\b|\bE10\b|EUROSUPER/.test(u)) return 'pb95';
    if (/\bON\b|DIESEL|OLEJ NAPEDOWY|OLEJ NAPĘDOWY|ARCTIC|EKODIESEL|\bB7\b|\bONEKODIESEL\b/.test(u)) return 'on';
    if (/KWH|ŁADOWANIE|LADOWANIE/.test(u)) return 'ev';
    return null;
  }
  function parseStation(t) {
    const u = ' ' + t.toUpperCase().replace(/[^A-Z0-9ĄĆĘŁŃÓŚŹŻ ]+/g, ' ') + ' ';
    for (const [k, v] of STATIONS) if (u.includes(' ' + k + ' ') || u.includes(k + ' ') && k.length > 3) return v;
    return null;
  }
  function numbers(t) {
    const out = [], re = /(?<![\d.,])(\d{1,4})[.,](\d{2,3})(?![\d])/g; let m;
    while ((m = re.exec(t))) { const v = toNum(m[1] + '.' + m[2]); if (v > 0) out.push(v); }
    return [...new Set(out)];
  }
  /* Szukamy (ilość, cena, kwota): ilość*cena ≈ kwota (tolerancja na zaokrąglenia). */
  function findTriple(nums, wide) {
    let best = null;
    const pLo = wide ? 0.3 : 3, pHi = wide ? 15 : 12;
    for (const T of nums) for (const L of nums) {
      if (L === T || L < 1 || L > 200) continue;
      for (const p of nums) {
        if (p === L || p === T || p < pLo || p > pHi) continue;
        const err = Math.abs(L * p - T);
        if (err > 0.06 + T * 0.004) continue;
        // preferujemy duże kwoty i małe błędy; kwota powinna być największa z trójki
        if (T < L || T < p) continue;
        const score = err * 10 - Math.log(T);
        if (!best || score < best.score) best = { liters: L, ppl: p, total: T, score };
      }
    }
    return best;
  }
  function parse(text) {
    const t = String(text || '');
    const res = { date: parseDate(t), station: parseStation(t), fuel: parseFuel(t), liters: null, ppl: null, total: null, confidence: 0 };
    // linia typu „42,350 l x 6,290”
    const x = t.match(/(\d{1,3}[.,]\d{2,3})\s*[lL]?\s*[xX×*]\s*(\d{1,2}[.,]\d{2,3})/);
    const nums = numbers(t);
    let tr = findTriple(nums, false) || findTriple(nums, true);
    if (tr) { res.liters = tr.liters; res.ppl = tr.ppl; res.total = tr.total; res.confidence = 2; }
    else if (x) {
      const L = toNum(x[1]), p = toNum(x[2]); res.liters = L; res.ppl = p; res.total = +(L * p).toFixed(2); res.confidence = 1;
    } else {
      // etykiety: SUMA/RAZEM/DO ZAPŁATY -> kwota
      const m = t.match(/(?:SUMA|RAZEM|DO ZAP[ŁL]ATY|NALE[ŻZ]NO[ŚS][ĆC]|TOTAL)[^\d]{0,20}(\d{1,4}[.,]\d{2})/i);
      if (m) { res.total = toNum(m[1]); res.confidence = 0.5; }
      const l = t.match(/(\d{1,3}[.,]\d{2,3})\s*(?:l|L|litr)/);
      if (l) { res.liters = toNum(l[1]); res.confidence = Math.max(res.confidence, 0.5); }
    }
    if (res.liters && res.total && !res.ppl) res.ppl = +(res.total / res.liters).toFixed(3);
    return res;
  }
  const api = { parse, parseDate, parseFuel, parseStation, findTriple, numbers };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReceiptParse = api;
})(typeof window !== 'undefined' ? window : this);
