# 🌱 SwachhConnect

**Real-time municipal waste management for citizens, workers and operators.**

SwachhConnect closes the loop between a resident reporting waste and the municipality clearing it. Citizens report by voice, photo or text. Operators assign workers and manage schedules and missed pickups. Workers collect and upload proof. Every status change updates all three screens live and notifies the citizen.

## Features

**Citizens**
- Voice reporting in English, Telugu and Hindi
- Photo capture and a live GPS map with a draggable pin
- AI-assisted category and priority suggestion (keyword heuristic)
- Live complaint tracking with before and after photos
- Collection schedule per ward, saved places and a notification inbox
- One-tap "Pickup didn't happen? Report it"

**Workers**
- Large-button, voice-readable task screen with navigation link
- Live GPS sharing while on duty
- Photo proof, waste type and weight on completion
- "Could not collect" with a reason

**Operators**
- Dashboard: collection volume, complaints raised vs resolved, recycling rate, unresolved requests by age
- Missed-pickup queue with one-click reschedule (nearest worker plus next scheduled slot) and escalation
- Collection schedule editor per ward
- Live map of complaints and vehicles, auto-assign by priority, activity feed and operations assistant

## Tech stack
Vanilla JavaScript (no framework, no server) · Supabase (Auth, Postgres with Row-Level Security, Realtime, Storage) · Leaflet and OpenStreetMap · Web Speech API · SVG charts · Vercel

## Quick start (demo mode, no backend)
```bash
git clone https://github.com/<your-username>/swachhconnect.git
cd swachhconnect
npx serve public
```
Open http://localhost:3000. For the live multi-user version, see the setup guide below.

## License
MIT
