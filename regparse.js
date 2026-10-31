/* Parser dowodu rejestracyjnego (PL): z tekstu OCR wyciąga tylko dane POJAZDU
   (tablica, VIN, marka, model, rok pierwszej rejestracji, paliwo). Dane właściciela są ignorowane.
   Nie zakładamy układu dokumentu: używamy etykiet (A, B, D.1, D.3, P.3 / opisy po polsku),
   a gdy ich brak – rozpoznawania wzorców (VIN, tablica, słownik marek). */
(function (root) {
  'use strict';
  const MAKES = ['ALFA ROMEO', 'LAND ROVER', 'MERCEDES-BENZ', 'MERCEDES BENZ', 'ROLLS ROYCE', 'ASTON MARTIN', 'SSANGYONG', 'SKODA', 'ŠKODA', 'VOLKSWAGEN', 'AUDI', 'BMW', 'MERCEDES', 'OPEL', 'FORD', 'TOYOTA', 'HONDA', 'MAZDA', 'NISSAN', 'RENAULT', 'PEUGEOT', 'CITROEN', 'CITROËN', 'FIAT', 'SEAT', 'CUPRA', 'KIA', 'HYUNDAI', 'VOLVO', 'SUZUKI', 'MITSUBISHI', 'SUBARU', 'DACIA', 'LEXUS', 'JEEP', 'CHEVROLET', 'MINI', 'PORSCHE', 'JAGUAR', 'SMART', 'SAAB', 'LANCIA', 'DAEWOO', 'CHRYSLER', 'DODGE', 'TESLA', 'MG', 'DS', 'ISUZU', 'INFINITI', 'LADA', 'MAN', 'IVECO', 'MAXUS', 'BYD', 'POLESTAR', 'FSO', 'POLONEZ', 'ROVER', 'VW', 'LYNK', 'XPENG', 'NIO'];
  const PRETTY = { 'SKODA': 'Škoda', 'ŠKODA': 'Škoda', 'VW': 'Volkswagen', 'MERCEDES BENZ': 'Mercedes-Benz', 'MERCEDES': 'Mercedes-Benz', 'CITROEN': 'Citroën', 'CITROËN': 'Citroën', 'BMW': 'BMW', 'MG': 'MG', 'DS': 'DS', 'MAN': 'MAN', 'BYD': 'BYD', 'FSO': 'FSO', 'SEAT': 'SEAT', 'KIA': 'Kia', 'MINI': 'MINI', 'NIO': 'NIO', 'LADA': 'Lada' };
  const WMI = {
    TMB: 'Škoda', WVW: 'Volkswagen', WV1: 'Volkswagen', WV2: 'Volkswagen', WV3: 'Volkswagen', WAU: 'Audi', TRU: 'Audi', WBA: 'BMW', WBS: 'BMW', WBY: 'BMW', WDB: 'Mercedes-Benz', WDD: 'Mercedes-Benz', WDC: 'Mercedes-Benz', WDF: 'Mercedes-Benz',
    W0L: 'Opel', W0V: 'Opel', WF0: 'Ford', VF1: 'Renault', VF3: 'Peugeot', VF7: 'Citroën', VR1: 'DS', ZFA: 'Fiat', ZFF: 'Ferrari', VSS: 'SEAT', VSK: 'Nissan', KNA: 'Kia', KND: 'Kia', U5Y: 'Kia', KMH: 'Hyundai', TMA: 'Hyundai', NLH: 'Hyundai', YV1: 'Volvo', YV4: 'Volvo',
    SB1: 'Toyota', JTD: 'Toyota', JTM: 'Toyota', JTN: 'Toyota', VNK: 'Toyota', SJN: 'Nissan', JN1: 'Nissan', UU1: 'Dacia', VF1RJ: 'Renault', SAL: 'Land Rover', SAJ: 'Jaguar', JHM: 'Honda', SHH: 'Honda', JMZ: 'Mazda', JMB: 'Mitsubishi', TSM: 'Suzuki', JS3: 'Suzuki',
    SUP: 'FSO', SUL: 'FSO', ZAR: 'Alfa Romeo', WP0: 'Porsche', WMW: 'MINI', SCC: 'Lotus', LRW: 'Tesla', '5YJ': 'Tesla', '7SA': 'Tesla', XP7: 'Tesla', VWV: 'Volkswagen', WUA: 'Audi', TRUZ: 'Audi', WAP: 'Alpina',
  };
  const ACRO = new Set(['GTI', 'TDI', 'CDI', 'TSI', 'TFSI', 'HDI', 'DCI', 'JTD', 'CRDI', 'GTD', 'RS', 'ST', 'SW', 'GT', 'AMG', 'CC', 'XC', 'MX', 'CX', 'CR', 'HR', 'ZR', 'GTE', 'EV', 'SUV', 'VTI', 'THP', 'TCE', 'CLA', 'GLA', 'GLC', 'GLE', 'SLK', 'RAV', 'BMW']);
  const MAXY = new Date().getFullYear() + 1;

  const up = s => String(s || '').toUpperCase();
  const fixVin = s => s.replace(/[OQ]/g, '0').replace(/I/g, '1');
  const validVin = v => /^[A-HJ-NPR-Z0-9]{17}$/.test(v);

  function titleCase(s) {
    return String(s).trim().split(/(\s+|-)/).map(w => {
      if (!w || /^\s+$|^-$/.test(w)) return w;
      if (/\d/.test(w) && /[A-Z]/.test(w)) return w;          // A4, C220, X5, I30
      if (ACRO.has(w)) return w;
      return w.charAt(0) + w.slice(1).toLowerCase();
    }).join('');
  }
  const lines = t => String(t || '').split(/\r?\n/).map(l => l.replace(/[|_]+/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);

  /* ---------- VIN ---------- */
  function vinCands(ls, hint) {
    const cands = [];
    ls.forEach((raw, li) => {
      const U = up(raw), labelled = hint || /\bVIN\b|IDENTYF|NUMER IDENT|^E[A-Z]?[\s.:]/.test(U) || /^E[A-Z0-9]{17}/.test(U.replace(/\s/g, ''));
      const compact = fixVin(U.replace(/[^A-Z0-9]/g, ''));
      for (let i = 0; i + 17 <= compact.length; i++) {
        const v = compact.slice(i, i + 17);
        if (!validVin(v)) continue;
        if (!WMI[v.slice(0, 3)] && !(hint || (labelled && compact.length <= 19 && (v.match(/\d/g) || []).length >= 5))) continue;   // nieznany producent: tylko przy etykiecie „E” i krótkiej linii (inaczej to adres lub numer serii)
        const digits = (v.match(/\d/g) || []).length, letters = 17 - digits;
        if (digits < 3 || letters < 2) continue;
        let score = 0;
        if (labelled) score += 3;
        if (WMI[v.slice(0, 3)]) score += 3;
        if (/^\d{6}$/.test(v.slice(11)) || /^\d{5}$/.test(v.slice(12))) score += 1;
        if (digits >= 4 && letters >= 3) score += 1;
        if (labelled && /^E/.test(compact) && i === 1) score += 2;   // litera pola „E” przed VIN-em
        if (i + 17 === compact.length) score += 0.5;
        cands.push({ v, score, li });
      }
    });
    return cands;
  }
  function findVin(ls) {
    const cands = vinCands(ls); if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.li - b.li);
    return cands[0];
  }

  /* ---------- tablica ---------- */
  function splitPlate(c) {
    const m = c.match(/^([A-Z]{2,3})([A-Z0-9]{4,5})$/); if (!m) return null;
    let pre = m[1], rest = m[2];
    const lead = c.match(/^[A-Z]+/)[0];
    if (lead.length >= 3 && c.length - 3 >= 4 && lead.length <= 3) { pre = lead; rest = c.slice(3); } else if (lead.length >= 2) { pre = lead.slice(0, 2); rest = c.slice(2); }
    if (!/^\d/.test(rest)) return null;                 // polskie tablice: po kodzie powiatu zaczyna się cyfra
    if (pre.length === 2 && rest.length !== 5) return null;       // 2 litery powiatu + 5 znaków (WX 4821K)
    if (pre.length === 3 && rest.length < 4) return null;         // 3 litery powiatu + 4–5 znaków (LUB 5960J)
    return `${pre} ${rest}`;
  }
  function plateCands(ls, vin, hint) {
    const cands = [];
    ls.forEach((raw, li) => {
      let U = up(raw); if (vin && U.replace(/[^A-Z0-9]/g, '').includes(vin)) return;
      const labelled = hint || /^A[\s.:)]|^AL\s|NUMER REJ|NR REJ|REJESTRACYJNY|REGISTRATION/.test(U);
      U = U.replace(/^A[\s.:)]+/, '').replace(/NUMER REJESTRACYJNY|NR REJ\.?|REGISTRATION NUMBER/g, ' ');
      const toks = U.split(/[\s,;:]+/).filter(Boolean);
      const tryC = (c, bonus) => { c = c.replace(/[^A-Z0-9]/g, ''); if (c.length < 6 || c.length > 8) return; const p = splitPlate(c); if (p) cands.push({ p, score: bonus + (labelled ? 3 : 0) + (toks.length <= 3 ? 1 : 0), li }); };
      for (let i = 0; i < toks.length; i++) {
        if (/\d/.test(toks[i])) tryC(toks[i], 0);                                                            // „WX4821K” jako jeden token
        if (toks[i + 1] && /^[A-Z]{2,3}$/.test(toks[i]) && /^[A-Z0-9]{4,5}$/.test(toks[i + 1]) && /\d/.test(toks[i + 1])) tryC(toks[i] + toks[i + 1], 1);   // „WX 4821K”
      }
      if (labelled && toks.length) tryC(toks.join(''), 2);
    });
    return cands;
  }
  function findPlate(ls, vin) {
    const cands = plateCands(ls, vin); if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.li - b.li);
    return cands[0].p;
  }

  /* ---------- daty ---------- */
  function dates(s) {
    const out = [], re = /\b(\d{4})[-./](\d{2})[-./](\d{2})\b|\b(\d{2})[-./](\d{2})[-./](\d{4})\b/g; let m;
    while ((m = re.exec(s))) { const y = +(m[1] || m[6]), mo = +(m[2] || m[5]), d = +(m[3] || m[4]); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && y >= 1950 && y <= MAXY) out.push({ y, mo, d }); }
    return out;
  }
  function findYear(ls) {
    for (let i = 0; i < ls.length; i++) {
      const U = up(ls[i]);
      if (/^B[\s.:)]|PIERWSZEJ REJ|FIRST REG/.test(U)) { const d = dates(ls[i] + ' ' + (ls[i + 1] || ''))[0]; if (d) return { y: d.y, how: 'B' }; }
    }
    const all = dates(ls.join('\n')).sort((a, b) => a.y - b.y || a.mo - b.mo || a.d - b.d);
    return all.length ? { y: all[0].y, how: 'min' } : null;
  }

  /* ---------- pola z etykietą ---------- */
  // Opisy pól drukowane obok kodu (np. „D.3 Model OCTAVIA”) nie mogą trafić do wartości.
  const CAPS = /^(?:MARKA POJAZDU|MARKA|MODEL|NAZWA HANDLOWA|TYP,?\s*WARIANT,?\s*WERSJA|TYP|RODZAJ PALIWA|PALIWO|NUMER REJESTRACYJNY|NUMER IDENTYFIKACYJNY POJAZDU|NUMER IDENTYFIKACYJNY|DATA PIERWSZEJ REJESTRACJI|MAKE|COMMERCIAL DESCRIPTION|FUEL)\b[\s.:)\-–\/]*/i;
  function stripCaption(rest) {
    let guard = 0; while (CAPS.test(rest) && guard++ < 4) rest = rest.replace(CAPS, '');
    const toks = rest.split(' ').filter(Boolean), isUp = t => !/[a-ząćęłńóśźż]/.test(t) && /[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(t);
    if (toks.some(isUp) && toks.some(t => !isUp(t))) rest = toks.filter(isUp).join(' ');
    return rest.trim();
  }
  function after(ls, labelRe) {
    for (let i = 0; i < ls.length; i++) {
      const m = up(ls[i]).match(labelRe); if (!m) continue;
      let rest = ls[i].slice((m.index || 0) + m[0].length).replace(/^[\s.:)\-–]+/, '').trim();
      if (!rest && ls[i + 1]) rest = ls[i + 1].trim();
      rest = stripCaption(rest);
      if (rest) return rest;
    }
    return null;
  }
  function matchMake(str) {
    const U = ' ' + up(str).replace(/[^A-ZŠËÉ0-9 \-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    let best = null;
    for (const mk of MAKES) {
      const i = U.indexOf(' ' + mk + ' ');
      if (i >= 0 && (!best || mk.length > best.mk.length || (mk.length === best.mk.length && i < best.i))) best = { mk, i };
    }
    return best;
  }
  function cleanModel(s) {
    if (!s) return null;
    s = s.replace(/[^A-Za-z0-9ŁłŚśŻżŹźĆćĄąĘęÓóŃńÀ-ÿ \-\/+.]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^[.\-\s]+|[.\-\s]+$/g, '');
    // zostawiamy tylko wiarygodne człony (X5, C220, 3.0D, OCTAVIA); śmieci OCR (np. „3.6017”, „5 (1”) odcinają resztę
    const ok = [];
    for (const tk of s.toUpperCase().replace(/\b([A-Z]{1,3}\d)(\d[.,]\d[A-Z]{0,4})\b/g, '$1 $2').split(' ')) {
      const t2 = tk.replace(/^[.\-]+|[.\-]+$/g, '');
      if (!t2) continue;
      if (/^[A-ZŁŚŻŹĆĄĘÓŃ]{1,14}$/.test(t2) || /^[A-Z]{0,3}\d{1,4}[A-Z]{0,3}$/.test(t2) || /^\d[.,]\d[A-Z]{0,4}$/.test(t2) || /^[A-Z]-?[A-Z]{3,8}$/.test(t2) || /^[IVX]{1,4}$/.test(t2)) ok.push(t2); else break;
    }
    s = ok.join(' ');
    if (s.length < 1 || s.length > 28) return null;
    return titleCase(s);
  }
  function fuelFrom(str) {
    const U = ' ' + up(str).replace(/[^A-Z0-9+ ]/g, ' ') + ' ';
    const has = k => new RegExp('(^|[ +])' + k + '([ +]|$)').test(U);
    if (has('LPG') || /AUTOGAZ/.test(U)) return 'lpg';
    if (has('ON') || has('D') || /DIESEL|NAPED/.test(U)) return 'on';
    if (has('PB') || has('B') || /BENZ/.test(U)) return 'pb95';
    if (has('E') || has('EE') || has('EL') || /ELEKTR/.test(U)) return 'ev';
    return null;
  }

  /* ---------- rok produkcji, badanie techniczne ---------- */
  function prodYear(ls) {
    for (let i = 0; i < ls.length; i++) {
      if (!/\bROK\b|ROK\s*PROD|PRODUK|PRODUC|YEAR OF PROD/.test(up(ls[i]))) continue;
      const win = ls.slice(i, i + 7).join(' ').replace(/\b([12])\s(\d)\s(\d)\s(\d)\b/g, '$1$2$3$4').replace(/\b(\d)\s(\d{3})\b/g, '$1$2');
      const m = win.match(/\b(19[5-9]\d|20[0-4]\d)\b/g);
      const y = m && m.map(Number).find(v => v <= MAXY); if (y) return y;
    }
    return null;
  }
  const MON = { STY: 1, LUT: 2, MAR: 3, KWI: 4, MAJ: 5, CZE: 6, LIP: 7, SIE: 8, WRZ: 9, PAZ: 10, LIS: 11, GRU: 12 };
  function monthOf(tok) {
    if (MON[tok]) return MON[tok];
    const near = Object.keys(MON).filter(k => { let d = 0; for (let i = 0; i < 3; i++) if (k[i] !== tok[i]) d++; return d === 1; });
    return near.length === 1 ? MON[near[0]] : 0;
  }
  /* daty z pieczątki badania technicznego: „23 GRU. 2026” (także z rozstrzelonymi cyframi) → 'RRRR-MM-DD' */
  function stampDates(text) {
    const U = up(text).replace(/Ź/g, 'Z').replace(/[|_]/g, ' '), out = [], re = /(\d\s?\d|\d)\s*[.\-]?\s*([A-Z0-9]{3})[A-Z]{0,5}\.?\s*(2\s?0\s?\d\s?\d)\b/g; let m;
    while ((m = re.exec(U))) {
      const d = +m[1].replace(/\s/g, ''), mo = monthOf(m[2]), y = +m[3].replace(/\s/g, '');
      if (mo && d >= 1 && d <= 31 && y >= 2000 && y <= MAXY + 4) out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
    return out;
  }

  /* ---------- głosowanie między odczytami ---------- */
  const ham = (a, b) => { if (a.length !== b.length) return 99; let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
  // Odczyty tego samego pola z różnych zdjęć/przebiegów różnią się pojedynczymi znakami (0↔6, 8↔B). Wybieramy znak po znaku, ważąc źródła.
  function fuse(map, valid) {
    const arr = [...map.entries()].map(([k, v]) => ({ k, s: v.s, c: k.replace(/\s/g, '') })).sort((a, b) => b.s - a.s);
    if (!arr.length) return null;
    const best = arr[0], near = arr.filter(x => x.c.length === best.c.length && ham(x.c, best.c) <= 3);
    let out = '';
    for (let i = 0; i < best.c.length; i++) { const w = {}; for (const x of near) w[x.c[i]] = (w[x.c[i]] || 0) + x.s; out += Object.entries(w).sort((a, b) => b[1] - a[1])[0][0]; }
    const fused = valid(out) ? out : best.c;
    const second = arr.find(x => x.c !== best.c && ham(x.c, best.c) > 0);
    const total = arr.reduce((a, x) => a + x.s, 0);
    const srcs = new Set(); for (const x of near) for (const id of map.get(x.k).src) srcs.add(id);
    return { value: fused, score: best.s, sure: srcs.size >= 2 && (!second || best.s >= 1.8 * second.s || near.length >= 2) };
  }
  const bump = (map, k, s, src) => { const e = map.get(k) || { s: 0, src: new Set() }; e.s += s; e.src.add(src); map.set(k, e); };
  // znaki, które OCR myli ze sobą (X5 ↔ XE, 0 ↔ O, 8 ↔ B …): takie odczyty liczymy jako ten sam głos
  const CONF = [['5', 'E'], ['5', 'S'], ['0', 'O'], ['0', 'D'], ['8', 'B'], ['2', 'Z'], ['1', 'I'], ['6', 'G']];
  const confusable = (x, y) => x === y || CONF.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
  const sameTok = (a, b) => { a = up(a); b = up(b); return a.length === b.length && [...a].every((c, i) => confusable(c, b[i])); };
  const digits = s => (s.match(/\d/g) || []).length;
  function consensusModel(list) {
    const total = list.reduce((a, x) => a + x.w, 0), toks = list.map(x => ({ t: x.s.split(' '), w: x.w })), out = [];
    for (let i = 0; i < 4; i++) {
      const groups = [];
      for (const c of toks) { const tk = c.t[i]; if (!tk) continue; let g = groups.find(g => sameTok(g.rep, tk)); if (!g) groups.push(g = { rep: tk, w: 0, forms: {} }); g.w += c.w; g.forms[tk] = (g.forms[tk] || 0) + c.w; }
      groups.sort((a, b) => b.w - a.w); const best = groups[0];
      const second = groups[1];
      if (!best || !(best.w >= total * 0.5 || (i === 0 && best.w >= 2 && best.w >= 1.5 * (second ? second.w : 0)))) break;
      out.push(Object.entries(best.forms).sort((a, b) => digits(b[0]) - digits(a[0]) || b[1] - a[1])[0][0]);
    }
    return out.join(' ') || null;
  }

  // przycięta linia pola zaczyna się od zniekształconej etykiety („D 03”, „P3”): odcinamy ją
  const noLabel = s => { const tk = String(s).trim().split(/\s+/); while (tk.length && /^(?:[DCPO0]|[DPO0]?[.,]?\s?[13]|[DPO0][.,][13]|0[13]|P3|D3|D1)$/i.test(tk[0])) tk.shift(); return tk.join(' '); };
  const L_D1 = /\bD\s?[.,]?\s?1\b[.:)]?|\b[0O][.,]\s?1\b|\bMARKA( POJAZDU)?\b|\bMAKE\b/;
  const L_D3 = /\bD\s?[.,]?\s?3\b[.:)]?|\b[0O][.,]\s?3\b|\bMODEL\b|\bNAZWA HANDLOWA\b/;
  const L_P3 = /\bP\s?[.,]?\s?3\b[.:)]?|RODZAJ PALIWA|\bFUEL\b|\bPALIWO\b/;

  /* srcs: [{ text, w, hint }] — hint: 'vin' | 'plate' | 'model' | 'make' | 'fuel' (przycięta linia pola) lub brak (cała strona) */
  function parseSources(srcs) {
    const res = { make: null, model: null, year: null, plate: null, vin: null, fuel: null, inspection: null, found: [], notes: [], sure: {} };
    const S = srcs.map((s, i) => ({ ls: lines(s.text), w: s.w || 1, hint: s.hint || '', id: i })).filter(s => s.ls.length);
    if (!S.length) return res;
    // VIN
    const vm = new Map(); for (const s of S) for (const c of vinCands(s.ls, s.hint === 'vin')) bump(vm, c.v, c.score * s.w, s.id);
    for (const [k, e] of vm) if (WMI[k.slice(0, 3)]) e.s *= 2.5;      // znany producent (WMI) to mocny dowód, że odczyt jest poprawny
    const fv = fuse(vm, validVin);
    if (fv && validVin(fv.value)) {
      if (WMI[fv.value.slice(0, 3)] || fv.sure) { res.vin = fv.value; res.found.push('vin'); res.sure.vin = fv.sure || !!WMI[fv.value.slice(0, 3)]; }
      else res.notes.push('vin-unsure:' + fv.value);       // nieznany producent i tylko jeden odczyt: nie wpisujemy w formularz
    }
    // tablica
    const pm = new Map(); for (const s of S) for (const c of plateCands(s.ls, res.vin, s.hint === 'plate')) bump(pm, c.p, c.score * s.w, s.id);
    for (const [k, e] of [...pm]) {                     // ucięty odczyt dokłada głos pełniejszemu, który go rozszerza
      const kc = k.replace(/\s/g, '');
      const longer = [...pm.keys()].find(o => { const oc = o.replace(/\s/g, ''); return oc.length > kc.length && oc.startsWith(kc); });
      if (longer) { const l = pm.get(longer); l.s += e.s * .8; e.src.forEach(x => l.src.add(x)); pm.delete(k); }
    }
    const fp = fuse(pm, c => /^[A-Z]{2,3}\d[A-Z0-9]{3,4}$/.test(c)); if (fp) { res.plate = splitPlate(fp.value) || fp.value; res.found.push('plate'); res.sure.plate = fp.sure; }
    // rok: „rok produkcji” (strona z tyłu), w razie braku rok pierwszej rejestracji
    const yv = {}; for (const s of S) { const y = prodYear(s.ls); if (y) yv[y] = (yv[y] || 0) + s.w; }
    const yb = Object.entries(yv).sort((a, b) => b[1] - a[1])[0];
    if (yb) { res.year = +yb[0]; res.notes.push('year-production'); }
    else { const ys = {}; for (const s of S) { const y = findYear(s.ls); if (y) ys[y.y] = (ys[y.y] || 0) + s.w * (y.how === 'B' ? 2 : 1); } const b = Object.entries(ys).sort((a, c) => c[1] - a[1])[0]; if (b) res.year = +b[0]; }
    if (res.year) res.found.push('year');
    // marka
    const mk = {}; let leftover = null;
    for (const s of S) {
      const d1 = after(s.ls, L_D1) || (s.hint === 'make' ? noLabel(s.ls.join(' ')) : null); if (!d1) continue;
      const mm = matchMake(d1);
      if (mm) { const name = PRETTY[mm.mk] || titleCase(mm.mk); mk[name] = (mk[name] || 0) + s.w; const rem = up(d1).replace(mm.mk.replace('-', '[- ]?'), ' ').trim(); if (rem && rem !== up(d1) && !leftover) leftover = rem; }
      else { const f = d1.split(/\s{2,}|\s[-–]\s/)[0].replace(/[^A-Za-zŠšÉéËë\- ]/g, '').trim(); if (f.length >= 3 && f.length <= 20) { const name = titleCase(up(f)); mk[name] = (mk[name] || 0) + s.w * .5; } }
    }
    let mkb = Object.entries(mk).sort((a, b) => b[1] - a[1])[0]; if (mkb) res.make = mkb[0];
    if (!res.make) for (const s of S) { for (const l of s.ls) { const mm = matchMake(l); if (mm) { res.make = PRETTY[mm.mk] || titleCase(mm.mk); break; } } if (res.make) break; }
    if (!res.make && res.vin && WMI[res.vin.slice(0, 3)]) { res.make = WMI[res.vin.slice(0, 3)]; res.notes.push('make-from-vin'); }
    if (res.make) res.found.push('make');
    // model (D.3 = nazwa handlowa); D.2 to typ/wariant/wersja
    const ml = [];
    for (const s of S) { const d3 = after(s.ls, L_D3) || (s.hint === 'model' ? noLabel(s.ls.join(' ')) : null); const m = cleanModel(d3); if (m) ml.push({ s: m, w: s.w }); }
    if (!ml.length && leftover) { const m = cleanModel(leftover); if (m) ml.push({ s: m, w: 1 }); }
    let model = consensusModel(ml.length > 1 ? ml : ml); if (!model && ml.length) model = ml.sort((a, b) => b.w - a.w)[0].s.split(' ').slice(0, 1).join(' ');
    if (model && res.make && up(model) === up(res.make)) model = null;
    if (model) { res.model = model; res.found.push('model'); res.sure.model = ml.length >= 2 && ml.every(m => m.s === ml[0].s); }
    // paliwo
    const fv2 = {}; for (const s of S) { const p3 = after(s.ls, L_P3) || (s.hint === 'fuel' ? noLabel(s.ls.join(' ')) : null); if (!p3) continue; const f = fuelFrom(p3.split(/\s{2,}/)[0]); if (f) fv2[f] = (fv2[f] || 0) + s.w; }
    const fb = Object.entries(fv2).sort((a, b) => b[1] - a[1])[0]; if (fb) { res.fuel = fb[0]; res.found.push('fuel'); }
    // termin badania technicznego (pieczątka): najnowsza data z pieczątek
    const sd = []; for (const s of S) if (/BADANIA|TERMIN|TECHNICZN/.test(up(s.ls.join(' '))) || s.hint === 'stamp') sd.push(...stampDates(s.ls.join('\n')));
    if (sd.length) { sd.sort(); res.inspection = sd[sd.length - 1]; res.found.push('inspection'); }
    return res;
  }
  function parse(text) { return parseSources([{ text, w: 1 }]); }

  const api = { parse, parseSources, findVin, findPlate, findYear, validVin, titleCase, stampDates, fuse, WMI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RegParse = api;
})(typeof window !== 'undefined' ? window : this);
