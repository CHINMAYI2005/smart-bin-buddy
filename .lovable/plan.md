
## Smart Waste Collection — Mobile Web App

A mobile-first web app (works in any phone browser, installable) that monitors smart bins and controls a waste-collection truck via ESP32 over HTTP, backed by Lovable Cloud.

### Defaults I'm assuming (tell me to change any)
- **App type**: Mobile-friendly responsive web app (built in this stack).
- **ESP32 link**: Cloud-mediated HTTP — ESP32 polls/posts to backend endpoints; app talks to backend. Works over the internet, no same-Wi-Fi requirement. (Direct LAN HTTP also possible if preferred.)
- **Map**: Interactive Leaflet + OpenStreetMap (free, no API key) for bins + truck marker.
- **Auth**: Single operator dashboard, simple login required (so the public can't drive your truck).

### Screens
1. **Login** — operator email/password.
2. **Dashboard (home)**
   - Truck status card: mode (AUTO/MANUAL), state (Idle/Moving/Dumping/Returning), fill level, last-seen.
   - "Full bins" alert strip with quick "Dispatch" button.
   - Live notification feed (latest 10 events).
3. **Map view**
   - All bins as colored markers (green = ok, amber = nearly full, red = FULL).
   - Truck marker with heading; path line when moving toward a target.
   - Tap a bin → details + "Send truck here".
4. **Bins list**
   - Sortable list: ID, location name, status, last update, fill %.
   - Add / edit / delete bins (ID, label, lat/lng or predefined location).
5. **Truck control**
   - Mode toggle: AUTO ↔ MANUAL.
   - Manual D-pad: Forward `/F`, Backward `/B`, Stop `/S`.
   - Buttons: Dispatch to selected bin, Trigger dump, Return to base, Emergency stop.
   - Override banner: manual commands always win, even mid-AUTO run.
6. **Notifications** — full history with filters (bin events, truck events).
7. **Settings** — base location, truck capacity threshold, polling interval, ESP32 device tokens.

### Backend (Lovable Cloud)
**Tables**
- `bins` — id, label, lat, lng, status (`ok|nearly_full|full|emptied`), fill_percent, updated_at.
- `truck_state` — singleton row: mode, state, lat, lng, heading, fill_percent, target_bin_id, updated_at.
- `commands` — queue for ESP32: id, type (`F|B|S|DUMP|GOTO|RETURN`), payload (e.g., bin_id), status (`pending|sent|done`), created_at.
- `events` — id, type, message, bin_id?, created_at (drives notifications).
- `profiles` + `user_roles` (operator role) — for auth.

**HTTP endpoints (server routes for ESP32)**
- `POST /api/bin/status` — body `{ bin_id, lat, lng, status, fill }` → upserts bin + emits event when transitioning to FULL.
- `POST /api/truck/telemetry` — body `{ lat, lng, state, fill, ir_triggered }` → updates truck_state, emits events ("Reached bin", "Dump completed").
- `GET /api/truck/commands?since=...` — ESP32 polls; returns pending commands and marks them sent.
- `POST /api/truck/ack` — ESP32 confirms command done.
- All ESP32 endpoints authenticated via a device token header.

**Server functions (app → backend)**
- `dispatchTruckToBin(binId)` — sets target, queues `GOTO`, emits "Truck moving to …".
- `sendManualCommand('F'|'B'|'S')` — queues raw movement.
- `triggerDump()` / `returnToBase()`.
- `setMode('AUTO'|'MANUAL')`.

### Logic flow
- Bin reports FULL → event "Bin X Full at Location Y" → red marker + toast.
- Operator (or AUTO) dispatches → `GOTO` queued → ESP32 starts moving → telemetry updates marker live.
- IR sensor on ESP32 detects bin → ESP32 stops, runs dump, posts telemetry → events "Truck Reached Bin", "Dump Completed".
- If truck `fill ≥ threshold` OR dump complete → auto-queue `RETURN` → events "Truck Returning".
- Manual commands (`/F /B /S`) bypass AUTO instantly via the same command queue with a `priority` flag.

### Realtime / polling
- App subscribes to `truck_state`, `bins`, and `events` via Lovable Cloud realtime → instant marker + notification updates. No manual refresh.

### Notifications
- Toast + persistent feed entries for: Bin Full, Truck Moving, Truck Reached, Dump Completed, Truck Returning, Truck Full, Manual Override Engaged.

### Design
- Mobile-first, dark-friendly dashboard, large tap targets for the D-pad, status colors: green/amber/red bins, blue truck.
- Bottom tab nav: Dashboard · Map · Bins · Control · Alerts.

### Out of scope (can add later)
- Native iOS/Android wrapper, multi-truck fleet, route optimization across multiple full bins, driver/admin role split, ESP32 firmware itself (I'll provide a sample sketch in README).
