/* Predictable state container for the citizen app: one state object, a pure reducer,
   async actions that call API.* (optimistic where it matters), and selectors. */
(() => {
  const init = { complaints: [], schedules: {}, wards: [], saved: [], notifications: [], req: {}, err: null };

  function reducer(s, a) {
    switch (a.type) {
      case 'req': return { ...s, req: { ...s.req, [a.k]: a.v }, err: a.v === 'error' ? a.e : a.v === 'loading' ? s.err : null };
      case 'complaints/set': return { ...s, complaints: a.rows };
      case 'schedules/set': return { ...s, schedules: { ...s.schedules, [a.ward]: a.rows } };
      case 'wards/set': return { ...s, wards: a.rows };
      case 'saved/set': return { ...s, saved: a.rows };
      case 'saved/add': return { ...s, saved: [...s.saved, a.row] };
      case 'saved/swap': return { ...s, saved: s.saved.map(x => x.id === a.tmp ? a.row : x) };
      case 'saved/del': return { ...s, saved: s.saved.filter(x => x.id !== a.id) };
      case 'notif/set': return { ...s, notifications: a.rows };
      case 'notif/add': return s.notifications.some(n => n.id === a.n.id) ? s : { ...s, notifications: [a.n, ...s.notifications] };
      case 'notif/read': return { ...s, notifications: s.notifications.map(n => !a.ids || a.ids.includes(n.id) ? { ...n, read: true } : n) };
      default: return s;
    }
  }

  function createStore(reduce, initial) {
    let state = initial; const subs = new Set();
    return {
      get: () => state,
      dispatch(a) { const n = reduce(state, a); if (n !== state) { state = n; subs.forEach(f => f(state, a)); } },
      subscribe(f) { subs.add(f); return () => subs.delete(f); }
    };
  }
  const store = createStore(reducer, init);

  /* Runs an API call while tracking loading / ok / error per key. Returns undefined on failure. */
  const run = async (k, fn) => {
    store.dispatch({ type: 'req', k, v: 'loading' });
    try { const r = await fn(); store.dispatch({ type: 'req', k, v: 'ok' }); return r; }
    catch (e) { store.dispatch({ type: 'req', k, v: 'error', e: e.message || 'Something went wrong.' }); }
  };

  const actions = {
    loadSchedules: ward => run('schedules', async () => store.dispatch({ type: 'schedules/set', ward, rows: await API.schedules.byWard(ward) })),
    loadWards: () => run('wards', async () => store.dispatch({ type: 'wards/set', rows: await API.locations.wards() })),
    loadSaved: () => run('saved', async () => store.dispatch({ type: 'saved/set', rows: await API.locations.saved() })),
    loadNotifications: () => run('notifications', async () => store.dispatch({ type: 'notif/set', rows: await API.notifications.list() })),
    refreshComplaints: () => run('complaints', async () => {
      const rows = await API.complaints.mine();
      store.dispatch({ type: 'complaints/set', rows: rows.map(r => ({ ...r.data, id: r.id, st: r.status, pri: r.priority, ward: r.ward, updated: r.updated_at })) });
    }),
    receiveNotification: n => store.dispatch({ type: 'notif/add', n }),

    async saveLocation(l) {                                  // optimistic add, swap in the server row, roll back on failure
      const tmp = 'tmp' + Date.now();
      store.dispatch({ type: 'saved/add', row: { ...l, id: tmp } });
      try { store.dispatch({ type: 'saved/swap', tmp, row: await API.locations.save(l) }); }
      catch (e) { store.dispatch({ type: 'saved/del', id: tmp }); store.dispatch({ type: 'req', k: 'saved', v: 'error', e: e.message }); }
    },
    async removeLocation(id) {
      const row = store.get().saved.find(x => x.id === id);
      store.dispatch({ type: 'saved/del', id });
      try { await API.locations.remove(id); }
      catch (e) { if (row) store.dispatch({ type: 'saved/add', row }); store.dispatch({ type: 'req', k: 'saved', v: 'error', e: e.message }); }
    },
    async markRead(ids) {                                    // ids omitted = mark everything read
      store.dispatch({ type: 'notif/read', ids });
      try { await API.notifications.markRead(ids); } catch (e) { actions.loadNotifications(); }
    }
  };

  /* ---- selectors ---- */
  const unread = s => s.notifications.filter(n => !n.read).length;

  // Soonest slot that has not finished yet. weekday uses JS getDay() (0 = Sunday).
  function nextCollection(rows, now = new Date()) {
    let best = null;
    for (const r of rows || []) {
      const [sh, sm] = r.start_time.split(':'), [eh, em] = r.end_time.split(':');
      for (let d = 0; d < 8; d++) {
        const s = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d, +sh, +sm);
        const e = new Date(s.getFullYear(), s.getMonth(), s.getDate(), +eh, +em);
        if (s.getDay() !== r.weekday || e <= now) continue;
        if (!best || s < best.start) best = { ...r, start: s, end: e, ongoing: s <= now };
        break;
      }
    }
    return best;
  }

  window.SCStore = { store, actions, unread, nextCollection, reducer, createStore };
})();
