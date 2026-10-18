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
  function findVin(ls) {
    const cands = [];
    ls.forEach((raw, li) => {
      const U = up(raw), labelled = /\bVIN\b|IDENTYF|NUMER IDENT|^E[\s.:]/.test(U) || /^E[A-Z0-9]{17}/.test(U.replace(/\s/g, ''));
      const compact = fixVin(U.replace(/[^A-Z0-9]/g, ''));
      for (let i = 0; i + 17 <= compact.length; i++) {
        const v = compact.slice(i, i + 17);
        if (!validVin(v)) continue;
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
    if (!cands.length) return null;
    cands.sort((a, b) => b.score - a.score || a.li - b.li);
    return cands[0];
  }

  /* ---------- tablica ---------- */
  function splitPlate(c) {
    const m = c.match(/^([A-Z]{2,3})([A-Z0-9]{4,5})$/); if (!m) return null;
    let pre = m[1], rest = m[2];
    const lead = c.match(/^[A-Z]+/)[0];
    if (lead.length >= 3 && c.length - 3 >= 4 && lead.length <= 3) { pre = lead; rest = c.slice(3); } else if (lead.length >= 2) { pre = lead.slice(0, 2); rest = c.slice(2); }
    if (!/\d/.test(rest)) return null;
    return `${pre} ${rest}`;
  }
  function findPlate(ls, vin) {
    const cands = [];
    ls.forEach((raw, li) => {
      let U = up(raw); if (vin && U.replace(/[^A-Z0-9]/g, '').includes(vin)) return;
      const labelled = /^A[\s.:)]|NUMER REJ|NR REJ|REJESTRACYJNY|REGISTRATION/.test(U);
      U = U.replace(/^A[\s.:)]+/, '').replace(/NUMER REJESTRACYJNY|NR REJ\.?|REGISTRATION NUMBER/g, ' ');
      const toks = U.split(/[\s,;:]+/).filter(Boolean);
      const tryC = (c, bonus) => { c = c.replace(/[^A-Z0-9]/g, ''); if (c.length < 6 || c.length > 8) return; const p = splitPlate(c); if (p) cands.push({ p, score: bonus + (labelled ? 3 : 0) + (toks.length <= 3 ? 1 : 0), li }); };
      for (let i = 0; i < toks.length; i++) {
        if (/\d/.test(toks[i])) tryC(toks[i], 0);                                                            // „WX4821K” jako jeden token
        if (toks[i + 1] && /^[A-Z]{2,3}$/.test(toks[i]) && /^[A-Z0-9]{4,5}$/.test(toks[i + 1]) && /\d/.test(toks[i + 1])) tryC(toks[i] + toks[i + 1], 1);   // „WX 4821K”
      }
      if (labelled && toks.length) tryC(toks.join(''), 2);
    });
    if (!cands.length) return null;
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
    if (s.length < 1 || s.length > 28) return null;
    return titleCase(s.toUpperCase());
  }
  function fuelFrom(str) {
    const U = ' ' + up(str).replace(/[^A-Z0-9+ ]/g, ' ') + ' ';
    const has = k => new RegExp('(^|[ +])' + k + '([ +]|$)').test(U);
    if (has('LPG') || /AUTOGAZ/.test(U)) return 'lpg';
    if (has('ON') || /DIESEL|NAPED/.test(U)) return 'on';
    if (has('PB') || /BENZ/.test(U)) return 'pb95';
    if (has('E') || has('EE') || has('EL') || /ELEKTR/.test(U)) return 'ev';
    return null;
  }

  function parse(text) {
    const ls = lines(text), res = { make: null, model: null, year: null, plate: null, vin: null, fuel: null, found: [], notes: [] };
    if (!ls.length) return res;
    const v = findVin(ls); if (v) { res.vin = v.v; res.found.push('vin'); }
    const plate = findPlate(ls, res.vin); if (plate) { res.plate = plate; res.found.push('plate'); }
    const yr = findYear(ls); if (yr) { res.year = yr.y; res.found.push('year'); }

    // marka
    const d1 = after(ls, /\bD\s?[.,]?\s?1\b[.:)]?|\bMARKA( POJAZDU)?\b|\bMAKE\b/);
    let leftover = null;
    if (d1) {
      const mm = matchMake(d1);
      if (mm) { res.make = PRETTY[mm.mk] || titleCase(mm.mk); const rem = up(d1).replace(mm.mk.replace('-', '[- ]?'), ' ').trim(); if (rem && rem !== up(d1)) leftover = rem; }
      else { const f = d1.split(/\s{2,}|\s[-–]\s/)[0].replace(/[^A-Za-zŠšÉéËë\- ]/g, '').trim(); if (f.length >= 2 && f.length <= 20) res.make = titleCase(up(f)); }
    }
    if (!res.make) { for (const l of ls) { const mm = matchMake(l); if (mm) { res.make = PRETTY[mm.mk] || titleCase(mm.mk); break; } } }
    if (!res.make && res.vin && WMI[res.vin.slice(0, 3)]) { res.make = WMI[res.vin.slice(0, 3)]; res.notes.push('make-from-vin'); }
    if (res.make) res.found.push('make');

    // model (D.3 = nazwa handlowa); D.2 to typ/wariant/wersja – nie jest modelem
    const d3 = after(ls, /\bD\s?[.,]?\s?3\b[.:)]?|\bMODEL\b|\bNAZWA HANDLOWA\b/);
    let model = cleanModel(d3);
    if (!model && leftover) model = cleanModel(leftover);
    if (model && res.make && up(model) === up(res.make)) model = null;
    if (model) { res.model = model; res.found.push('model'); }

    // paliwo
    const p3 = after(ls, /\bP\s?[.,]?\s?3\b[.:)]?|RODZAJ PALIWA|\bFUEL\b|\bPALIWO\b/);
    if (p3) { const f = fuelFrom(p3.split(/\s{2,}/)[0]); if (f) { res.fuel = f; res.found.push('fuel'); } }
    return res;
  }

  const api = { parse, findVin, findPlate, findYear, validVin, titleCase, WMI };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RegParse = api;
})(typeof window !== 'undefined' ? window : this);
