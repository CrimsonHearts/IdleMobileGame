# 🌐 Online Sects — Backend Setup

The sect system runs **fully on-device today** (preset sects + NPC disciple
rosters). To let **real players join each other's sects**, you plug in a cloud
backend. The game already routes every sect data call through a swappable
`SectBackend`, so enabling online play is config + a thin adapter — no changes
to game logic or UI.

## How it's wired

`www/js/sect.js` defines:

- `LocalBackend` — ships now, offline, preset sects + fake members.
- `CloudBackend` — stub with the methods you implement against your provider.
- `Sect.goOnline(config)` — swaps in the cloud backend at startup.

At boot, `main.js` runs:

```js
if (window.SECT_ONLINE_CONFIG && window.Sect) Sect.goOnline(window.SECT_ONLINE_CONFIG);
```

So you enable online play by defining `window.SECT_ONLINE_CONFIG` (e.g. in a new
`www/js/config.js` loaded before `main.js`) and filling in `CloudBackend`.

## The backend contract

Implement these in `CloudBackend` (all async):

| Method | Returns | Purpose |
|---|---|---|
| `listSects()` | `[{id,name,nameCN,seal,color,bonus...}]` | preset + player-created sects |
| `members(sectId)` | `[{name, realm, rank}]` | real roster of a sect |
| `join(sectId)` | `{ok}` | record this player's membership |
| `leave()` | `{ok}` | remove membership |
| `createSect(def)` | `{ok,id}` | let a player found a new sect |
| `leaderboard()` | `[{sect, power}]` | sect rankings |

## Recommended providers (both have free tiers)

### Option A — Firebase (easiest)
1. Create a project at <https://console.firebase.google.com>.
2. Enable **Anonymous Auth** (gives each player an id with no signup) and
   **Cloud Firestore**.
3. `npm i firebase`, then in `CloudBackend` use Firestore collections:
   - `sects/{sectId}` — sect doc (name, seal, founderId, memberCount)
   - `sects/{sectId}/members/{uid}` — { name, realm, rank, contribution }
4. Provide config:
   ```js
   window.SECT_ONLINE_CONFIG = { provider: 'firebase', firebase: { /* your config */ } };
   ```

### Option B — Supabase (SQL + nicer free tier)
1. Create a project at <https://supabase.com>.
2. Tables: `sects(id, name, seal, color, founder)` and
   `sect_members(sect_id, user_id, name, realm, rank, contribution)`.
3. `npm i @supabase/supabase-js`, implement `CloudBackend` with queries.
4. Config: `window.SECT_ONLINE_CONFIG = { provider: 'supabase', url, anonKey }`.

## Security (important)

- Use **server-side rules** (Firestore Security Rules / Supabase RLS) so a
  client can only edit **its own** membership row and can't fake contribution.
- Treat any number coming from a client as **untrusted** — validate ranks /
  contribution server-side, or compute them from authenticated actions.
- Anonymous auth is fine to start; add real accounts (Google/Apple sign-in)
  later if you want cross-device persistence and friend systems.

## Suggested rollout

1. Ship the local version now (already done).
2. Add Firebase Anonymous Auth + Firestore; implement `members()` and
   `join()` first (read real rosters, record membership).
3. Add player-founded sects (`createSect`) and a leaderboard.
4. Layer in sect chat / sect wars later if desired.
