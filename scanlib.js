/* Skaner dowodu rejestracyjnego: przygotowanie obrazu i rozpoznawanie krok po kroku.
   Dlaczego tak: dowód ma wzór zabezpieczający (gilosz), który zbija OCR z tropu. Najpierw wyrównujemy tło (dzielenie przez
   rozmyty obraz), potem czytamy całą stronę, a pola, które łatwo przekłamać (VIN, tablica, model, paliwo), czytamy drugi raz
   z samej, powiększonej linii. Wszystkie odczyty z wielu zdjęć głosują nad wynikiem (RegParse.parseSources).
   Moduł nie zależy od przeglądarki: obraz to { w, h, g } (skala szarości), a silnik OCR dostarcza wywołujący (io.recognize). */
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // rozmycie pudełkowe (bieżące sumy), brzeg powielany
  function blur(src, w, h, r) {
    const tmp = new Float32Array(w * h), out = new Float32Array(w * h), k = 2 * r + 1;
    for (let y = 0; y < h; y++) {
      const o = y * w; let s = 0;
      for (let x = -r; x <= r; x++) s += src[o + clamp(x, 0, w - 1)];
      for (let x = 0; x < w; x++) { tmp[o + x] = s / k; s += src[o + clamp(x + r + 1, 0, w - 1)] - src[o + clamp(x - r, 0, w - 1)]; }
    }
    for (let x = 0; x < w; x++) {
      let s = 0; for (let y = -r; y <= r; y++) s += tmp[clamp(y, 0, h - 1) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = s / k; s += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x]; }
    }
    return out;
  }
  /* Wyrównanie tła: f = szarość / rozmyte tło. Tekst zostaje ciemny, wzór zabezpieczający i cienie jaśnieją. */
  function flatten(img) {
    const { w, h, g } = img, R = Math.max(8, Math.round(Math.max(w, h) * 0.018));
    let b = blur(blur(Float32Array.from(g), w, h, R), w, h, R);
    const f = new Uint8ClampedArray(w * h), e = new Uint8ClampedArray(w * h);
    for (let i = 0; i < f.length; i++) { const v = g[i] / (b[i] + 1) * 255; f[i] = v; e[i] = (v - 110) * 255 / 145; }
    return { flat: { w, h, g: e }, f: { w, h, g: f } };
  }
  const ink = (f, t) => { const o = new Uint8ClampedArray(f.g.length); for (let i = 0; i < o.length; i++) o[i] = f.g[i] < t ? 0 : 255; return { w: f.w, h: f.h, g: o }; };
  function crop(img, b, scale) {
    const x0 = clamp(Math.floor(b.x0), 0, img.w - 1), y0 = clamp(Math.floor(b.y0), 0, img.h - 1), x1 = clamp(Math.ceil(b.x1), x0 + 1, img.w), y1 = clamp(Math.ceil(b.y1), y0 + 1, img.h);
    const sw = x1 - x0, sh = y1 - y0, w = Math.max(1, Math.round(sw * scale)), h = Math.max(1, Math.round(sh * scale)), g = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) {
      const fy = clamp((y + .5) / scale - .5, 0, sh - 1), iy = Math.floor(fy), ty = fy - iy, iy2 = Math.min(sh - 1, iy + 1);
      for (let x = 0; x < w; x++) {
        const fx = clamp((x + .5) / scale - .5, 0, sw - 1), ix = Math.floor(fx), tx = fx - ix, ix2 = Math.min(sw - 1, ix + 1);
        const a = img.g[(y0 + iy) * img.w + x0 + ix], c = img.g[(y0 + iy) * img.w + x0 + ix2], d = img.g[(y0 + iy2) * img.w + x0 + ix], e = img.g[(y0 + iy2) * img.w + x0 + ix2];
        g[y * w + x] = (a * (1 - tx) + c * tx) * (1 - ty) + (d * (1 - tx) + e * tx) * ty;
      }
    }
    return { w, h, g };
  }

  const up = s => String(s || '').toUpperCase();
  const WL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .-/+';
  /* Wybór linii do ponownego, dokładnego odczytu. */
  function pickJobs(lines, W, H) {
    const RP = root.RegParse || (typeof require === 'function' ? require('./regparse.js') : null);
    const jobs = [], seen = new Set(), key = b => `${Math.round(b.x0 / 40)}:${Math.round(b.y0 / 25)}`;
    const add = (kind, line, ext) => {
      const b = line.box, hgt = Math.max(10, b.y1 - b.y0), k = kind + key(b); if (seen.has(k)) return; seen.add(k);
      if (ext) {   // pola z etykietą: wartość bywa niżej niż etykieta, więc zapas z dołu; szerokość od lewej krawędzi etykiety
        jobs.push({ kind, box: { x0: b.x0 - 14, y0: b.y0 - hgt * .25, x1: Math.min(W, b.x0 + ext * W) + 14, y1: b.y1 + hgt * .6 } });
      } else {     // VIN, tablica: ciasne i luźniejsze pudełko (ramka pola przy brzegu psuje odczyt, a ucięta litera też)
        jobs.push({ kind, box: { x0: b.x0 - 12, y0: b.y0 - Math.max(6, hgt * .12), x1: b.x1 + 14, y1: b.y1 + Math.max(6, hgt * .12) } });
        jobs.push({ kind, box: { x0: b.x0 - 12, y0: b.y0 - Math.max(8, hgt * .2), x1: b.x1 + 40, y1: b.y1 + Math.max(10, hgt * .25) }, loose: true });
      }
    };
    const vin = [], plate = [];
    for (const l of lines) {
      const U = up(l.text), compact = U.replace(/[^A-Z0-9]/g, '').replace(/[OQ]/g, '0').replace(/I/g, '1');
      if (compact.length >= 14 && compact.length <= 22) {
        const digits = (compact.match(/\d/g) || []).length; let sc = 0;
        if (digits >= 4) sc += 1; if (/^E[A-Z0-9]{16,}/.test(compact) || /^E[A-Z]?\s/.test(U)) sc += 1;
        if (RP && RP.WMI[compact.slice(0, 3)] || RP && RP.WMI[compact.slice(1, 4)]) sc += 2;
        if (compact.length >= 16 && compact.length <= 19) sc += 1;
        const wmi = RP && (RP.WMI[compact.slice(0, 3)] || RP.WMI[compact.slice(1, 4)]), lab = /^E[A-Z0-9]{16,}/.test(compact) || /^E[A-Z]?\s/.test(U);
        if (sc >= 3 && (wmi || lab)) vin.push({ l, sc });
      }
      if (RP && !/BADANIA|STAROSTA|ORGAN|WYDAJ/.test(U) && RP.findPlate([l.text], null)) plate.push({ l, sc: (/^A[\s.:)]|^AL\s/.test(U) ? 2 : 0) + (U.length < 20 ? 1 : 0) });
      if (/(^|\s)[D0O][.,]\s?3\b|\bD\s?3\b/.test(U)) add('model', l, .3);
      else if (/\bP\s?[.,]?\s?3\b/.test(U) && U.length < 40) add('fuel', l, .3);
    }
    vin.sort((a, b) => b.sc - a.sc).slice(0, 1).forEach(x => add('vin', x.l));
    plate.sort((a, b) => b.sc - a.sc).slice(0, 1).forEach(x => add('plate', x.l));
    return jobs;
  }

  /* photos: [{w,h,g}] · io: { recognize(img,{psm,whitelist}) → {text,lines:[{text,box}]}, progress(msg) } */
  async function scan(photos, io) {
    const RP = root.RegParse || require('./regparse.js'), srcs = [], say = io.progress || (() => {}), n = photos.length;
    for (let i = 0; i < n; i++) {
      const raw = photos[i], { flat, f } = flatten(raw), tag = n > 1 ? `zdjęcie ${i + 1}/${n}` : 'zdjęcie';
      say(`Rozpoznaję tekst — ${tag}, przebieg 1/2…`); const r1 = await io.recognize(flat, { psm: 3 });
      say(`Rozpoznaję tekst — ${tag}, przebieg 2/2…`); const r2 = await io.recognize(flat, { psm: 11 });
      srcs.push({ text: r1.text, w: 1 }, { text: r2.text, w: 1 });
      const jobs = pickJobs([...r1.lines, ...r2.lines], raw.w, raw.h);
      let done = 0;
      for (const j of jobs) {
        say(`Sprawdzam pola dokładniej — ${tag} (${++done}/${jobs.length})…`);
        // litery o różnej wielkości czyta się różnie dobrze, więc każdą linię czytamy w kilku skalach (małe obrazy, tanie)
        const vars = (j.kind === 'vin' || j.kind === 'plate') ? [[flat, 1], [flat, 2], [raw, 1.5], [raw, 1]] : [[flat, 1], [flat, 2], [raw, 1.5]];
        for (const [base, sc] of vars) {
          const r = await io.recognize(crop(base, j.box, sc), { psm: 7, whitelist: WL });
          if (r.text.trim()) srcs.push({ text: r.text, w: 2, hint: j.kind });
        }
      }
      if (/BADANIA|TERMIN/.test(up(r1.text + r2.text))) {
        say(`Czytam pieczątkę badania technicznego — ${tag}…`); const r = await io.recognize(ink(f, 150), { psm: 11 });
        srcs.push({ text: r.text, w: 1, hint: 'stamp' });
      }
    }
    return RP.parseSources(srcs);
  }

  const api = { flatten, crop, ink, pickJobs, scan };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ScanLib = api;
})(typeof window !== 'undefined' ? window : this);
