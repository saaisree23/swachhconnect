/* Dashboard component. SCDash.render(complaints,{days}) returns an HTML string: KPI row + four SVG charts
   (collection volume, complaints, recycling rate, unresolved requests). Pure function of the data, theme tokens, no libraries. */
(() => {
  const DAY = 864e5, sum = (a, f) => a.reduce((s, x) => s + f(x), 0), isR = c => RECY.includes(c.wt);
  const fm = n => n >= 1000 ? (n / 1000).toFixed(1) + ' t' : Math.round(n) + ' kg';
  const age = ms => ms < 36e5 ? Math.max(1, Math.round(ms / 6e4)) + ' min' : ms < DAY ? Math.round(ms / 36e5) + ' h' : (ms / DAY).toFixed(1) + ' d';

  function stats(cs, n, now = Date.now()) {
    const e = new Date(now).setHours(0, 0, 0, 0) + DAY, s = e - n * DAY, p = s - n * DAY, inr = (t, a, b) => t >= a && t < b;
    const coll = (a, b) => cs.filter(c => c.kg && c.rt && inr(c.rt, a, b));
    const days = [...Array(n)].map((_, i) => {
      const a = s + i * DAY, b = a + DAY, d = coll(a, b);
      return { a, rec: sum(d, c => isR(c) ? c.kg : 0), oth: sum(d, c => isR(c) ? 0 : c.kg), nw: cs.filter(c => inr(c.t, a, b)).length, res: cs.filter(c => c.rt && inr(c.rt, a, b)).length };
    });
    const cur = coll(s, e), prv = coll(p, s), kg = sum(cur, c => c.kg), pk = sum(prv, c => c.kg), rk = sum(cur, c => isR(c) ? c.kg : 0), prk = sum(prv, c => isR(c) ? c.kg : 0);
    const byT = {}, byC = {}; cur.forEach(c => byT[c.wt] = (byT[c.wt] || 0) + c.kg);
    cs.filter(c => inr(c.t, s, e)).forEach(c => byC[c.cat] = (byC[c.cat] || 0) + 1);
    const done = cs.filter(c => c.rt && c.t && inr(c.rt, s, e));
    return { days, kg, pk, rate: kg ? rk / kg * 100 : 0, prate: pk ? prk / pk * 100 : 0, byT, byC, made: sum(days, d => d.nw), pmade: cs.filter(c => inr(c.t, p, s)).length,
      open: cs.filter(c => c.st != 'RESOLVED'), missed: cs.filter(c => c.st == 'MISSED').length, avg: done.length ? sum(done, c => c.rt - c.t) / done.length : 0, now };
  }

  const dl = (a, b, unit = '', goodUp = true) => { if (!b) return '<em class="dl">no prior data</em>'; const d = a - b, up = d >= 0; return `<em class="dl ${up == goodUp ? 'good' : 'bad'}">${up ? '▲' : '▼'} ${Math.abs(Math.round(d))}${unit} vs previous</em>`; };

  function bars(days, ser, stack, lbl) {
    const W = 320, H = 130, L = 28, B = 18, T = 8, n = days.length, sw = (W - L - 4) / n, ch = H - B - T;
    const mx = Math.max(1, ...days.map(d => stack ? sum(ser, s => d[s.k]) : Math.max(...ser.map(s => d[s.k])))), y = v => T + ch - v / mx * ch, step = n > 14 ? 5 : 1;
    let g = `<line x1="${L}" x2="${W}" y1="${y(0)}" y2="${y(0)}" class="ax"/><line x1="${L}" x2="${W}" y1="${y(mx / 2)}" y2="${y(mx / 2)}" class="ax gl"/><text x="${L - 4}" y="${T + 3}" class="at e">${Math.ceil(mx)}</text><text x="${L - 4}" y="${y(0) + 3}" class="at e">0</text>`;
    days.forEach((d, i) => {
      const x0 = L + i * sw; let acc = 0;
      ser.forEach((s, j) => {
        const v = d[s.k], bw = stack ? sw * .6 : sw * .7 / ser.length, x = stack ? x0 + sw * .2 : x0 + sw * .15 + j * bw, h = v / mx * ch, yy = stack ? y(acc + v) : y(v); acc += v;
        if (v > 0) g += `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${(bw - .6).toFixed(1)}" height="${h.toFixed(1)}" rx="1.2" class="${s.c}"><title>${s.n}: ${v}${stack ? ' kg' : ''}</title></rect>`;
      });
      if (i % step == 0 || i == n - 1) g += `<text x="${(x0 + sw / 2).toFixed(1)}" y="${H - 4}" class="at">${lbl(d.a)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="ch" role="img" aria-label="${ser.map(s => s.n + ' ' + Math.round(sum(days, d => d[s.k]))).join(', ')} over ${n} days">${g}</svg><p class="lgd">${ser.map(s => `<span><i class="sw ${s.c}"></i>${s.n}</span>`).join(' ')}</p>`;
  }

  const donut = (pct, sub) => `<svg viewBox="0 0 42 42" class="dn" role="img" aria-label="${Math.round(pct)}% ${sub}"><circle cx="21" cy="21" r="15.9" class="dt"/><circle cx="21" cy="21" r="15.9" class="dv" stroke-dasharray="${pct.toFixed(1)} ${(100 - pct).toFixed(1)}" transform="rotate(-90 21 21)"/><text x="21" y="22.5" class="dp">${Math.round(pct)}%</text><text x="21" y="28" class="ds">${sub}</text></svg>`;
  const hbar = (rows, cls = '') => { const mx = Math.max(1, ...rows.map(r => r[1])); return rows.map(([k, v, t]) => `<div class="hb"><span>${esc(k)}</span><div><i class="${cls}" style="width:${Math.max(3, v / mx * 100)}%"></i></div><b>${t ?? v}</b></div>`).join('') || '<p class="m">No data in this period.</p>'; };

  function render(cs, o = {}) {
    const n = o.days || 7, s = stats(cs, n), lbl = a => new Date(a).toLocaleDateString([], n <= 7 ? { weekday: 'short' } : { day: 'numeric' }), now = s.now;
    const kp = [['Collected', fm(s.kg), dl(s.kg, s.pk, ' kg')], ['Complaints', s.made, dl(s.made, s.pmade, '', false)], ['Recycling rate', Math.round(s.rate) + '%', dl(s.rate, s.prate, ' pts')],
      ['Unresolved', s.open.length, '<em class="dl">right now</em>'], ['Missed pickups', s.missed, `<em class="dl ${s.missed ? 'bad' : 'good'}">${s.missed ? 'need rescheduling' : 'all clear'}</em>`], ['Avg. resolution', s.avg ? age(s.avg) : '—', '<em class="dl">in period</em>']];
    const bk = [['< 24 h', s.open.filter(c => now - c.t < DAY).length, ''], ['1–3 days', s.open.filter(c => now - c.t >= DAY && now - c.t < 3 * DAY).length, 'wn'], ['> 3 days', s.open.filter(c => now - c.t >= 3 * DAY).length, 'bd3']];
    const oldest = s.open.slice().sort((a, b) => a.t - b.t).slice(0, 5);
    return `<div class="row dh"><h3>Operations dashboard</h3><div class="chips" role="group" aria-label="Period">${[7, 30].map(d => `<button class="chip ${n == d ? 'on' : ''}" data-a="dr" data-v="${d}" aria-pressed="${n == d}">${d} days</button>`).join('')}</div></div>
<div class="kp k6">${kp.map(([a, b, c]) => `<div class="k"><small>${a}</small><b>${b}</b>${c}</div>`).join('')}</div>
<div class="dg"><section class="card"><h3>⚖️ Collection volume</h3>${bars(s.days, [{ k: 'rec', c: 's1', n: 'Recyclable' }, { k: 'oth', c: 's2', n: 'Other' }], true, lbl)}</section>
<section class="card"><h3>📣 Complaints raised vs resolved</h3>${bars(s.days, [{ k: 'nw', c: 's4', n: 'Raised' }, { k: 'res', c: 's1', n: 'Resolved' }], false, lbl)}<p class="lb">Top categories</p>${hbar(Object.entries(s.byC).sort((a, b) => b[1] - a[1]).slice(0, 4), 's4')}</section>
<section class="card"><h3>♻️ Recycling rate</h3><div class="dr">${donut(s.rate, 'recycled')}<div>${hbar(Object.entries(s.byT).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, v, v + ' kg']), 's1')}</div></div></section>
<section class="card"><h3>⏳ Unresolved requests <span class="tag">${s.open.length}</span></h3>${hbar(bk.map(([k, v]) => [k, v]), '')}
<p class="lb">Oldest open</p>${oldest.map(c => `<div class="row"><button class="lk" data-a="sel" data-v="${c.id}">${c.id}</button><span class="m">W${c.ward} · ${esc(c.cat)}</span><span class="m">${age(now - c.t)}</span>${bd(c.st)}</div>`).join('') || '<p class="m">Nothing unresolved 🎉</p>'}</section></div>`;
  }

  window.SCDash = { render, stats };
  A.dr = v => { U.dr = +v; ro(); };
})();
