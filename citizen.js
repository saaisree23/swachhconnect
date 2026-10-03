/* Citizen portal additions. Loaded after app.js, backend.js, api.js and store.js.
   It wraps the existing rc() renderer and A.* actions instead of editing app.js. */
(() => {
  const { store, actions, unread, nextCollection } = window.SCStore, DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MINE = ['sched', 'alerts', 'list'], triedWard = new Set();

  const fmt = t => { const [h, m] = t.split(':'); return `${(+h % 12) || 12}:${m} ${+h < 12 ? 'AM' : 'PM'}`; };
  const ago = iso => { const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : new Date(iso).toLocaleDateString(); };
  const toast = (h, m) => { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = `<b>${esc(h)}</b>${esc(m)}`; $('#toasts').append(d); setTimeout(() => d.remove(), 5200); };
  const ward = () => +(U.sw ?? U.ws);
  const wardIds = () => { const w = store.get().wards.map(x => x.id); return w.length ? w : Object.keys(WN).map(Number).sort((a, b) => a - b); };
  const head = `<div class="ph-h"><button class="ib" data-a="cv" data-v="home" aria-label="Back">←</button><span class="tag">Citizen</span></div>`;

  const nextText = rows => {
    const n = nextCollection(rows);
    if (!n) return 'No collection scheduled for this ward.';
    const day = n.start.toDateString() === new Date().toDateString() ? 'Today' : DAYS[n.start.getDay()];
    return `${n.ongoing ? 'Happening now · ' : ''}${day} ${fmt(n.start_time)}–${fmt(n.end_time)} · ${esc(n.waste_type)}`;
  };

  function ensureSchedule(w) {
    const s = store.get();
    if (s.schedules[w] || triedWard.has(w)) return;
    triedWard.add(w); actions.loadSchedules(w);
  }

  /* ---------- views ---------- */
  const err = () => { const s = store.get(); return s.err ? `<p class="al" role="alert">${esc(s.err)}</p>` : ''; };

  function schedView() {
    const s = store.get(), w = ward(), rows = s.schedules[w];
    ensureSchedule(w);
    const saved = s.saved.map(l => `<div class="card"><div class="row"><b>${esc(l.label)}</b><small class="m">Ward ${l.ward ?? '?'}</small></div><div class="yn"><button class="btn sec sm" data-a="useW" data-v="${l.id}">Schedule</button><button class="btn sec sm" data-a="useL" data-v="${l.id}">Report here</button><button class="btn sec sm" data-a="delL" data-v="${l.id}" aria-label="Delete ${esc(l.label)}">✕</button></div></div>`).join('');
    return `<div class="col card pad"><h2>Collection schedule</h2>${err()}<label class="lb" for="swd">Ward</label>
      <select id="swd" data-c="sw">${wardIds().map(x => `<option value="${x}" ${x == w ? 'selected' : ''}>Ward ${x}</option>`).join('')}</select>
      <div class="card"><b>🚛 Next collection</b><p class="m">${rows ? nextText(rows) : s.req.schedules === 'error' ? 'Could not load the schedule.' : 'Loading…'}</p></div>
      <button class="btn sec" data-a="missRep">⚠️ Pickup didn't happen? Report it</button>
      ${rows && rows.length ? `<table class="st"><tr><th>Day</th><th>Time</th><th>Waste</th></tr>${rows.map(r => `<tr><td>${DAYS[r.weekday]}</td><td>${fmt(r.start_time)}–${fmt(r.end_time)}</td><td>${esc(r.waste_type)}</td></tr>`).join('')}</table>` : ''}
      <p class="lb">Saved places</p>${saved || '<p class="m">No saved places yet.</p>'}
      <div class="tx"><input data-u="lab" value="${esc(U.lab || '')}" placeholder="Label, e.g. Home" aria-label="Label for this place"><button class="btn" data-a="sloc">Save my location</button></div></div>`;
  }

  function alertsView() {
    const s = store.get(), ns = s.notifications;
    return `<div class="col"><div class="row"><h2>Notifications</h2>${unread(s) ? '<button class="btn sec sm" data-a="rall">Mark all read</button>' : ''}</div>${err()}` +
      (ns.map(n => `<button class="card nrow ${n.read ? '' : 'un'}" data-a="rd" data-v="${n.id}"><span>${n.read ? '' : '<i class="dot" aria-label="Unread"></i>'}${esc(n.message)}</span><small class="m">${ago(n.created_at)}</small></button>`).join('') ||
        '<p class="em">No notifications yet. Updates on your complaints appear here.</p>') + '</div>';
  }

  function listView() {
    const s = store.get(), m = new Map(S.c.filter(c => c.me).map(c => [c.id, c]));
    s.complaints.forEach(c => m.set(c.id, { ...m.get(c.id), ...c }));              // server rows win over local copies
    const f = U.lf || '', last = c => c.hist[c.hist.length - 1][1];
    const rows = [...m.values()].filter(c => c.hist && (!f || (f === 'open' ? c.st !== 'RESOLVED' : c.st === f))).sort((a, b) => last(b) - last(a));
    return `<div class="col"><h2>${T('mine')}</h2>${err()}<div class="chips" role="group" aria-label="Filter by status">${[['', 'All'], ['open', 'Open'], ['RESOLVED', 'Resolved'], ['MISSED', 'Missed']].map(([k, n]) => `<button class="chip ${f === k ? 'on' : ''}" data-a="lf" data-v="${k}" aria-pressed="${f === k}">${n}</button>`).join('')}</div>` +
      (rows.map(trk).join('') || `<p class="em">${T('none')}</p>`) + '</div>';
  }

  /* ---------- wrap the existing renderer ---------- */
  const _rc = rc;
  rc = function () {
    const p = $('#pc');
    if (MINE.includes(U.cv)) {
      if (busy(p)) return;
      gpsStop();
      p.innerHTML = `${head}<div class="bd2">${{ sched: schedView, alerts: alertsView, list: listView }[U.cv]()}</div>`;
      return;
    }
    _rc();
    if (U.cv === 'home') decorateHome();
  };

  function decorateHome() {
    const p = $('#pc'), s = store.get(), w = +U.ws;
    p.querySelectorAll('.tile.x').forEach(t => t.remove());
    const tiles = p.querySelector('.tiles'), n = unread(s);
    if (tiles) tiles.insertAdjacentHTML('beforeend', `<button class="tile x" data-a="cv" data-v="sched"><span>🗓️</span>Collection schedule</button><button class="tile x" data-a="cv" data-v="alerts"><span>🔔</span>Notifications${n ? `<b class="nb">${n}</b>` : ''}</button>`);
    ensureSchedule(w);
    const card = [...p.querySelectorAll('.card')].find(c => /Next collection/.test(c.textContent));
    if (card) card.innerHTML = `<b>🚛 Next collection · Ward ${w}</b><p class="m">${s.schedules[w] ? nextText(s.schedules[w]) : 'Loading…'}</p>`;
  }

  // Store changes: full re-render for our own views, light patch for the home screen (keeps the Leaflet map alive).
  let raf = 0;
  store.subscribe(() => {
    if (raf || document.body.dataset.v !== 'cit') return;
    raf = requestAnimationFrame(() => { raf = 0; MINE.includes(U.cv) ? rc() : U.cv === 'home' && $('#pc .tiles') && decorateHome(); });
  });

  /* ---------- actions ---------- */
  const _cv = A.cv;
  A.cv = v => {
    _cv(v);
    if (v === 'sched') { triedWard.delete(ward()); actions.loadSaved(); }
    if (v === 'alerts') actions.loadNotifications();
    if (v === 'list') actions.refreshComplaints();
  };
  Object.assign(A, {
    lf(v) { U.lf = v; rc(); },
    rd(v) { actions.markRead([+v]); },
    rall() { actions.markRead(); },
    useW(v) { const l = store.get().saved.find(x => String(x.id) === v); if (l?.ward) { U.sw = l.ward; triedWard.delete(l.ward); rc(); } },
    useL(v) { const l = store.get().saved.find(x => String(x.id) === v); if (!l) return; U.manual = 1; setPos(l.lat, l.lng); A.cv('report'); },
    delL(v) { const l = store.get().saved.find(x => String(x.id) === v); if (l) actions.removeLocation(l.id); },
    sloc() {
      const label = (U.lab || '').trim();
      if (!label) return toast('Saved places', 'Type a label first.');
      const put = (lat, lng) => { actions.saveLocation({ label, lat, lng, ward: wardOf(...toXY(lat, lng)) }); U.lab = ''; rc(); };
      if (U.lat != null) return put(U.lat, U.lng);
      if (!navigator.geolocation) return toast('Saved places', 'Location is not available on this device.');
      navigator.geolocation.getCurrentPosition(p => put(p.coords.latitude, p.coords.longitude), () => toast('Saved places', 'Allow location access to save this place.'), { enableHighAccuracy: true, timeout: 15000 });
    }
  });

  // Upload the photo to Storage first (live mode); if that fails the compressed image is sent inline as before.
  const _sub = A.submit; let sending = 0;
  A.submit = async () => {
    if (sending) return; sending = 1;
    try {
      if (API.live && U.img && U.img.startsWith('data:')) {
        try { U.img = await API.images.upload(U.img); } catch (e) { toast('Photo', 'Upload failed. Sending the photo with the report instead.'); }
      }
      _sub();
    } finally { sending = 0; }
  };

  /* ---------- notifications source ---------- */
  if (!API.live) {                       // demo mode: mirror citizen toasts into the inbox (live mode uses the DB trigger)
    const _note = note;
    note = (to, m) => { _note(to, m); if (to === 'cit') API.notifications.addLocal(m).then(actions.receiveNotification); };
  }

  let started = 0;
  async function start() {
    if (started) return; started = 1;
    actions.loadWards(); actions.loadSaved(); actions.loadNotifications(); actions.refreshComplaints();
    if (!API.live) return;
    const sb = window.SC_SB, uid = (await sb.auth.getSession()).data.session.user.id;
    sb.channel('notif-' + uid).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
      p => { actions.receiveNotification(p.new); actions.refreshComplaints(); }).subscribe();
  }
  document.addEventListener('change', e => { if (e.target.dataset.c === 'sw') { U.sw = +e.target.value; triedWard.delete(U.sw); rc(); } });
  if (API.live) { window.SC_SB.auth.onAuthStateChange((_, s) => { if (s) setTimeout(start, 0); }); window.SC_SB.auth.getSession().then(({ data }) => data.session && start()); }
  else start();
})();
