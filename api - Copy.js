/* REST layer. Live mode talks to Supabase PostgREST (/rest/v1) and Storage (/storage/v1) with fetch.
   Demo mode (empty config.js) serves the same interface from localStorage. */
(() => {
  const C = window.SC_CONFIG || {}, LIVE = !!(C.url && C.anon && window.supabase);
  const sess = async () => (await window.SC_SB.auth.getSession()).data.session;
  const wait = ms => new Promise(r => setTimeout(r, ms));

  async function rest(path, { method = 'GET', body, prefer } = {}) {
    for (let attempt = 0; ; attempt++) {
      const s = await sess();
      if (!s) throw Object.assign(new Error('Please sign in again.'), { status: 401 });
      let res;
      try {
        res = await fetch(`${C.url}/rest/v1/${path}`, {
          method,
          headers: { apikey: C.anon, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'application/json', ...(prefer && { Prefer: prefer }) },
          body: body && JSON.stringify(body)
        });
      } catch (e) {                                   // network failure: retry reads once
        if (method === 'GET' && attempt < 1) { await wait(600); continue; }
        throw new Error('Network error. Check your connection.');
      }
      if (res.status >= 500 && method === 'GET' && attempt < 1) { await wait(600); continue; }
      if (!res.ok) throw Object.assign(new Error((await res.json().catch(() => ({}))).message || res.statusText), { status: res.status });
      return res.status === 204 ? null : res.json();
    }
  }

  /* ---------- demo backing store ---------- */
  const DK = 'sc3-api', WARDS = [3, 7, 9, 12];
  const seedDemo = () => {
    const schedules = [];
    WARDS.forEach(w => [1, 2, 3, 4, 5, 6].forEach(d => {
      const h = 6 + (w % 3) * .5, f = x => `${String(Math.floor(x)).padStart(2, '0')}:${x % 1 ? '30' : '00'}:00`;
      schedules.push({ id: schedules.length + 1, ward: w, weekday: d, start_time: f(h), end_time: f(h + 1), waste_type: d % 2 ? 'Wet (organic)' : 'Dry (plastic, paper, metal)', vehicle: w == 3 ? 'V03' : w == 12 ? 'V07' : null });
    }));
    return { schedules, saved: [], notifications: [], seq: 1 };
  };
  const D = () => { try { return JSON.parse(localStorage.getItem(DK)) || seedDemo(); } catch (e) { return seedDemo(); } };
  const W = d => { try { localStorage.setItem(DK, JSON.stringify(d)); } catch (e) { } return d; };

  const API = LIVE ? {
    live: true,
    complaints: {
      async mine() {
        const s = await sess();
        return rest(`complaints?select=id,status,priority,ward,data,updated_at&citizen_id=eq.${s.user.id}&order=updated_at.desc`);
      },
      async get(id) { return (await rest(`complaints?select=*&id=eq.${encodeURIComponent(id)}`))[0] || null; }
    },
    schedules: {
      byWard: ward => rest(`collection_schedules?select=*&ward=eq.${+ward}&active=eq.true&order=weekday,start_time`),
      add: r => rest('collection_schedules', { method: 'POST', body: r }),
      remove: id => rest(`collection_schedules?id=eq.${+id}`, { method: 'DELETE' })
    },
    locations: {
      wards: () => rest('wards?select=*&order=id'),
      saved: () => rest('saved_locations?select=*&order=created_at'),
      async save(l) { return (await rest('saved_locations', { method: 'POST', body: l, prefer: 'return=representation' }))[0]; },
      remove: id => rest(`saved_locations?id=eq.${+id}`, { method: 'DELETE' })
    },
    notifications: {
      list: (n = 30) => rest(`notifications?select=*&order=created_at.desc&limit=${n}`),
      markRead: ids => rest(ids ? `notifications?id=in.(${ids.map(Number).join(',')})` : 'notifications?read=eq.false', { method: 'PATCH', body: { read: true } })
    },
    images: {
      async upload(dataUrl) {
        const s = await sess(), blob = await (await fetch(dataUrl)).blob();
        const path = `${s.user.id}/${Date.now().toString(36)}.jpg`;
        const r = await fetch(`${C.url}/storage/v1/object/complaint-images/${path}`, { method: 'POST', headers: { apikey: C.anon, Authorization: 'Bearer ' + s.access_token, 'Content-Type': 'image/jpeg' }, body: blob });
        if (!r.ok) throw new Error('Photo upload failed');
        return `${C.url}/storage/v1/object/public/complaint-images/${path}`;
      }
    }
  } : {
    live: false,
    complaints: { mine: async () => [], get: async () => null },
    schedules: {
      byWard: async ward => D().schedules.filter(r => r.ward == ward).sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time)),
      async add(r) { const d = D(), t = x => x.length == 5 ? x + ':00' : x; d.schedules.push({ ...r, id: d.seq++, start_time: t(r.start_time), end_time: t(r.end_time) }); W(d); },
      async remove(id) { const d = D(); d.schedules = d.schedules.filter(x => x.id != id); W(d); }
    },
    locations: {
      wards: async () => WARDS.map(id => ({ id, name: 'Ward ' + id })),
      saved: async () => D().saved,
      async save(l) { const d = D(), row = { ...l, id: d.seq++, created_at: new Date().toISOString() }; d.saved.push(row); W(d); return row; },
      async remove(id) { const d = D(); d.saved = d.saved.filter(x => x.id != id); W(d); }
    },
    notifications: {
      list: async () => D().notifications.slice().reverse(),
      async markRead(ids) { const d = D(); d.notifications.forEach(n => { if (!ids || ids.includes(n.id)) n.read = true; }); W(d); },
      async addLocal(message, kind = 'INFO') { const d = D(), n = { id: d.seq++, kind, message, read: false, created_at: new Date().toISOString() }; d.notifications.push(n); W(d); return n; }
    },
    images: { upload: async dataUrl => dataUrl }       // demo keeps the compressed image inline
  };
  window.API = API;
})();
