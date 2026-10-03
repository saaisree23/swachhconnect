# SwachhConnect — deploy guide

Static frontend (`public/`) + Supabase backend (Postgres, Auth, Realtime, Row-Level Security). No build framework, no server to run.

## 1. Create the backend (5 min)
1. Create a project at supabase.com.
2. SQL Editor → paste `supabase/schema.sql` → Run.
3. Authentication → Providers → Email: for quick testing turn **off** "Confirm email".
4. Project Settings → API: copy the **Project URL** and **anon public key**.

## 1b. Add schedules, saved places, notifications and photo storage
SQL Editor → paste `supabase/migration_v2.sql` → Run (once, after `schema.sql`). It adds `wards`, `collection_schedules`, `saved_locations`, `notifications` (filled by a trigger on complaint changes), and the `complaint-images` Storage bucket. Edit `collection_schedules` rows to match your real routes.

## 2. Deploy the frontend
**Vercel:** push this folder to GitHub → Import in Vercel → add env vars `SUPABASE_URL` and `SUPABASE_ANON_KEY` → Deploy. (`build.js` writes `public/config.js` from them.)
**Netlify / any static host:** put your URL and anon key in `public/config.js`, then deploy the `public/` folder.
**Local:** edit `public/config.js`, run `npx serve public`.

## 3. Create roles
Everyone who signs up is a **citizen**. Sign up each user in the app first, then run in the SQL Editor:
```sql
update profiles set role='admin' where id=(select id from auth.users where email='you@example.com');
update profiles set role='operator' where id=(select id from auth.users where email='operator@example.com');
update profiles set role='worker', worker_key='w1' where id=(select id from auth.users where email='ravi@example.com');  -- Ravi, V07
update profiles set role='worker', worker_key='w2' where id=(select id from auth.users where email='anita@example.com'); -- Anita, V03
```
Add more workers: `insert into workers(id,name,vehicle) values('w3','Name','V11');`

## What each role sees
| Role | App | Access (enforced by RLS) |
|---|---|---|
| citizen | Citizen | create and read own complaints |
| worker | Worker | only complaints assigned to them; can set In progress / Resolved / Missed |
| operator | Operator | all complaints, assign, live map, analytics, activity |
| admin | Operator + Citizen + Worker tabs | everything, plus roles and workers |

## Three-device demo
Phone 1: citizen account. Laptop: operator account. Phone 2: worker account. Report → assign → start duty → complete; every screen updates live.

## Frontend structure (citizen app)
| File | Role |
|---|---|
| `api.js` | REST client: PostgREST for complaints, schedules, locations, notifications; Storage for photos. Same interface in demo mode (localStorage). |
| `store.js` | State container: reducer, async actions with optimistic updates and rollback, selectors (`unread`, `nextCollection`). |
| `citizen.js` | Citizen screens: schedule and saved places, notification inbox, filtered complaint tracking, photo upload on submit. Wraps `rc()` and `A.*` from `app.js`. |

## Scheduling, missed pickups and dashboard (v3)
| File | Role |
|---|---|
| `dashboard.js` | `SCDash.render(complaints,{days})`: KPI row plus SVG charts for collection volume, complaints raised vs resolved, recycling rate by waste type, and unresolved requests by age. Pure function of the data; 7 / 30 day toggle. |
| `ops.js` | Operator **schedule editor** (add/delete slots per ward), **missed-pickup queue** (reason, repeat count, one-click *Reschedule* = nearest worker + next scheduled slot, *Escalate*), and worker **weight + waste type** capture before submit (feeds volume and recycling charts). |

Workflow: worker flags *Could not collect* with a reason, or a citizen taps *Pickup didn't happen? Report it* on the schedule screen. Either lands in the operator's missed queue. *Reschedule* assigns a worker, stores the slot on the complaint, and notifies the citizen. No new SQL: slot edits use the existing `collection_schedules` table and its operator/admin RLS policy.
Demo mode: click **Reset** once so the new 7-day seed history loads.

## Known limits
- Photos upload to the public `complaint-images` bucket (URLs are unguessable but not private). If the upload fails, the compressed image is stored inline as before.
- Complaint writes still go through `backend.js` sync; `api.js` reads them back for the citizen list.
- AI category suggestion is a keyword heuristic; voice uses the browser's Web Speech API (Chrome/Edge/Android work best; language support depends on the device).
- The map is a schematic ward grid, not real tiles. Worker GPS is real when permitted; otherwise it is simulated and labelled DEMO.
- Leaving `config.js` empty runs a local demo mode with seeded data and no login.
