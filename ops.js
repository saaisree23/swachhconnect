/* Operator additions: schedule editor, missed-pickup workflow, dashboard injection; worker weight + waste-type capture.
   Wraps ro()/rw() and extends A.* so app.js stays untouched except for demo seed data. */
(() => {
  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], WARDS = Object.keys(WN).map(Number).sort((a, b) => a - b), SR = {}, tried = new Set();
  const ft = t => { const [h, m] = t.split(':'); return `${(+h % 12) || 12}:${m} ${+h < 12 ? 'AM' : 'PM'}`; };
  const toast = (h, m) => { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = `<b>${esc(h)}</b>${esc(m)}`; $('#toasts').append(d); setTimeout(() => d.remove(), 5200); };
  const age = ms => ms < 36e5 ? Math.max(1, Math.round(ms / 6e4)) + ' min' : ms < 864e5 ? Math.round(ms / 36e5) + ' h' : (ms / 864e5).toFixed(1) + ' d';
  const slotLabel = n => n ? `${n.start.toDateString() == new Date().toDateString() ? 'Today' : DAYS[n.start.getDay()]} ${ft(n.start_time)}` : null;
  const load = w => { if (SR[w] || tried.has(w)) return; tried.add(w); API.schedules.byWard(w).then(r => { SR[w] = r; ro(); }).catch(e => { SR[w] = []; toast('Schedule', e.message); ro(); }); };
  const reload = async w => { SR[w] = await API.schedules.byWard(w); ro(); };

  /* ---------- missed-pickup queue ---------- */
  const isMiss = c => c.st == 'MISSED' || (c.cat == 'Missed pickup' && c.st == 'SUBMITTED');
  function missedPanel() {
    const q = S.c.filter(isMiss).sort((a, b) => (b.pri == 'HIGH') - (a.pri == 'HIGH') || a.t - b.t);
    const row = c => {
      const tries = c.hist.filter(h => h[0] == 'MISSED').length, last = c.hist[c.hist.length - 1][1], next = SR[c.ward] && slotLabel(SCStore.nextCollection(SR[c.ward])), wk = S.w.find(w => w.id == c.w);
      load(c.ward);
      return `<div class="mi2"><div class="row"><b><button class="lk" data-a="sel" data-v="${c.id}">${c.id}</button> · W${c.ward}</b>${bd(c.st)}</div>
<p class="m">${c.st == 'MISSED' ? `Reason: ${esc(c.mr || 'Not given')} · ${esc(wk ? wk.n : '—')} · ${tries}× missed` : 'Citizen-reported, not yet assigned'} · waiting ${age(Date.now() - (c.st == 'MISSED' ? last : c.t))} · ${pb(c.pri)}</p>
${c.resched ? `<p class="m">🗓️ Rescheduled: ${esc(c.resched.label)}</p>` : ''}${tries > 1 && c.pri != 'HIGH' ? '<p class="al">Missed more than once. Consider escalating.</p>' : ''}
<div class="row"><button class="btn sm" data-a="resched" data-v="${c.id}" title="Assigns the nearest worker and books the next slot">🗓️ Reschedule${next ? ' → ' + esc(next) : ''}</button>${c.pri != 'HIGH' ? `<button class="btn sec sm" data-a="esc" data-v="${c.id}">🔺 Escalate</button>` : ''}</div></div>`;
    };
    return `<section class="card" style="margin:0"><div class="row"><h3>⚠️ Missed pickups <span class="tag">${q.length}</span></h3></div>${q.map(row).join('') || '<p class="m">No missed pickups. Workers flag a miss with a reason; citizens can also report one from the schedule screen.</p>'}</section>`;
  }

  /* ---------- schedule editor ---------- */
  function schedPanel() {
    const w = +(U.sw2 || WARDS[0]), rows = SR[w], sv = U.sv || '', opt = (a, cur) => a.map(([v, n]) => `<option value="${v}" ${String(cur) == String(v) ? 'selected' : ''}>${n}</option>`).join('');
    load(w);
    return `<section class="card" style="margin:0"><h3>🗓️ Collection schedule</h3><select data-c="sw2" aria-label="Ward">${opt(WARDS.map(x => [x, 'Ward ' + x]), w)}</select>
${rows ? `<div class="tw"><table class="st"><tr><th>Day</th><th>Time</th><th>Waste</th><th>Vehicle</th><th></th></tr>${rows.map(r => `<tr><td>${DAYS[r.weekday]}</td><td>${ft(r.start_time)}–${ft(r.end_time)}</td><td>${esc(r.waste_type)}</td><td>${esc(r.vehicle || '—')}</td><td><button class="lk" data-a="delSlot" data-v="${r.id}" aria-label="Delete slot">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="m">No slots yet.</td></tr>'}</table></div>` : '<p class="m">Loading…</p>'}
<p class="lb">Add a slot</p><div class="sf"><select data-c="sd" aria-label="Weekday">${opt(DAYS.map((d, i) => [i, d]), U.sd ?? 1)}</select><input type="time" data-u="ss" value="${U.ss || '06:30'}" aria-label="Start"><input type="time" data-u="se" value="${U.se || '07:30'}" aria-label="End">
<select data-c="sy" aria-label="Waste type">${opt(['Wet (organic)', 'Dry (plastic, paper, metal)', 'Mixed', 'E-waste', 'Construction'].map(x => [x, x]), U.sy || 'Wet (organic)')}</select>
<select data-c="sv" aria-label="Vehicle">${opt([['', 'No vehicle'], ...S.w.map(x => [x.v, x.v + ' · ' + x.n])], sv)}</select><button class="btn sm" data-a="addSlot">Add</button></div></section>`;
  }

  const _ro = ro;
  ro = function () {
    _ro();
    const k = $('#po .kp');
    if (k) { const h = document.createElement('div'); h.innerHTML = `<div id="dash">${SCDash.render(S.c, { days: U.dr || 7 })}</div><div class="og2">${missedPanel()}${schedPanel()}</div>`; k.replaceWith(...h.childNodes); }
  };

  /* ---------- worker: weight + waste type before submit ---------- */
  const IC = { Organic: '🍌', Plastic: '🧴', Paper: '📄', Metal: '🥫', Glass: '🍾', 'E-waste': '🔌', Mixed: '🗑️' };
  const _rw = rw;
  rw = function () {
    _rw();
    const b = $('#pw [data-a=done]'); if (!b || $('#pw .kx')) return;
    b.disabled = !(U.proof && +U.kg && U.wt);
    b.insertAdjacentHTML('beforebegin', `<div class="kx"><p class="lb">Waste type</p><div class="wg">${WT.map(t => `<button class="wt2 ${U.wt == t ? 'on' : ''}" data-a="wt" data-v="${t}" aria-pressed="${U.wt == t}"><span>${IC[t]}</span>${t}</button>`).join('')}</div><p class="lb">Weight collected</p><div class="kgr"><button class="btn sec" data-a="kgm" aria-label="Less weight">−</button><div class="kgv">${+U.kg || 0}<small> kg</small></div><button class="btn" data-a="kgp" aria-label="More weight">+</button></div></div>`);
  };
  const _done = A.done;

  Object.assign(A, {
    wt(v) { U.wt = v; rw(); }, kgp() { U.kg = (+U.kg || 0) + 5; rw(); }, kgm() { U.kg = Math.max(0, (+U.kg || 0) - 5); rw(); },
    done() { const c = S.c.find(c => c.w == U.wid && c.st == 'IN_PROGRESS'); if (!c || !U.proof || !+U.kg || !U.wt) return; c.kg = +U.kg; c.wt = U.wt; U.kg = 0; U.wt = ''; _done(); },

    async resched(v) {                                   // nearest worker + next scheduled slot for the ward; citizen is told when
      const c = S.c.find(c => c.id == v), w = c && suggest(c); if (!w) return toast('Reschedule', 'No worker is available.');
      let rows = SR[c.ward]; if (!rows) try { rows = SR[c.ward] = await API.schedules.byWard(c.ward); } catch (e) { rows = []; }
      const n = SCStore.nextCollection(rows), lb = slotLabel(n);
      c.resched = n ? { at: n.start.getTime(), label: `${lb} · ${n.waste_type}` } : null;
      assign(c.id, w.id);
      if (c.me && lb) note('cit', `🗓️ ${c.id}: new pickup slot ${lb}`);
    },
    esc(v) { const c = S.c.find(c => c.id == v); if (!c) return; c.pri = 'HIGH'; note('op', `🔺 ${c.id} escalated to HIGH (missed pickup)`); commit(); },
    async addSlot() {
      const w = +(U.sw2 || WARDS[0]), s = U.ss || '06:30', e = U.se || '07:30'; if (e <= s) return toast('Schedule', 'End time must be after start time.');
      try { await API.schedules.add({ ward: w, weekday: +(U.sd ?? 1), start_time: s, end_time: e, waste_type: U.sy || 'Wet (organic)', vehicle: U.sv || null }); await reload(w); }
      catch (x) { toast('Schedule', x.status == 403 ? 'Only operators can edit schedules.' : x.message); }
    },
    async delSlot(v) { const w = +(U.sw2 || WARDS[0]); try { await API.schedules.remove(v); await reload(w); } catch (x) { toast('Schedule', x.message); } },
    /* citizen: report that a scheduled pickup did not happen */
    missRep() { const w = +(U.sw ?? U.ws), [x, y] = WN[w] || [U.px, U.py], c = newReport('Scheduled pickup did not happen', 'Missed pickup', { x, y, ward: w, lat: U.lat, lng: U.lng }); commit(); toast('Reported', `${c.id} sent to the operator.`); }
  });
  document.addEventListener('change', e => { if (e.target.dataset.c == 'sw2') { U.sw2 = +e.target.value; ro(); } });
})();
