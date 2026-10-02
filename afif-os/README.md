# Afif OS

A private **personal operating system** — one system for academic work, self-study,
learning, projects and life tracking, instead of twenty disconnected productivity tools.

Next.js · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Zod · Vitest

---

## Current state

Phases 1–4 of the build plan are implemented and working end to end, plus the reminder
engine (Phase 3) and a deterministic version of the advisor (Phase 9). Everything else is
wired into navigation with an honest "not built yet" page — no empty CRUD that pretends to
work, and no invented data anywhere.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Authentication, database, layout, dashboard | **Done** |
| 2 | Tasks, calendar, study timer, study history | **Done** |
| 3 | Reminder engine, notifications | **Done** (in-app delivery; web push not configured) |
| 4 | Semesters, courses, assessments, CGPA, target calculator | **Done** |
| 5 | Books, projects, achievements, opportunities | Schema + read on dashboard/today; no CRUD UI |
| 6 | Polymath, notes, questions, skills, knowledge graph | Schema only |
| 7 | Life modules (prayer, medication, diary, photos, timeline) | Schema + read-only on Today |
| 8 | Analytics | Partial (study analytics live in Study History) |
| 9 | AI advisor | Deterministic rule engine, permission-gated, LLM-ready |

The database schema for **every** phase is already migrated — 41 tables — so later phases
are additive.

---

## Running it

```bash
cd afif-os
npm install

# 1. Point at a PostgreSQL database
cp .env.example .env.local        # then edit DATABASE_URL and AUTH_SECRET

# 2. Create the schema
npm run db:migrate

# 3. Optional: realistic development data (refuses to run in production)
npm run db:seed -- --confirm

# 4. Start
npm run dev
```

Seeded development login: `afif` / `AfifOs!2026` (change it in Settings → Password).

### Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `0.0.0.0:3000` |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest integration suite against PostgreSQL |
| `npm run db:generate` | Generate SQL migrations from the Drizzle schema |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed -- --confirm` | Seed the development database |

---

## Architecture

```
src/
  app/
    (auth)/login, (auth)/setup        public screens
    (app)/…                           protected screens (requireUser in the layout)
    api/health, api/study/*           JSON endpoints, each doing its own auth
  proxy.ts                            edge fast-path redirect only
  server/
    auth/                             password, session, rate limiting, actions
    db/                               drizzle client + schema (41 tables)
    lib/                              action wrapper, timezone maths
    services/                         study, tasks, reminders, dashboard, academic,
                                      advisor, search, export, settings
  components/                         layout, dashboard, study, tasks, reminders, …
drizzle/                              SQL migrations
scripts/                              migrate + seed
tests/                                integration tests
```

**Where the boundaries are**

- `proxy.ts` only decides whether to bother rendering. It cannot reach the database.
  Real authorization is `requireUser()` in the protected layout plus a session check in
  every server action and route handler.
- Server actions are the only mutation path from the UI. Next verifies the `Origin`
  header for them; hand-written route handlers call `assertSameOrigin()`.
- All input is validated with Zod at the action boundary.

---

## The study timer

The piece most personal trackers get wrong, so it is worth spelling out:

- The session lives in PostgreSQL the moment you press Start. Refresh, close the tab or
  lose power and the session is still there.
- **Duration is computed on the server** from the stored `started_at`, `running_since` and
  `accumulated_seconds`. The browser never reports how long you studied.
- Pause banks the elapsed time; Resume starts a new interval.
- "Stop & save" is a single conditional `UPDATE … RETURNING`, so pressing it twice saves
  one session, not two. A second press returns the saved session with `alreadySaved: true`.
- Start is idempotent through a `client_key` unique index, so a double tap or a retried
  request cannot create two sessions.
- If the tab stops heart-beating, the session is capped at the last heartbeat plus a
  45-minute grace period — an abandoned timer cannot inflate your hours.
- **University class time never enters these totals.** It is calculated separately from
  your timetable and shown beside self-study as "Total academic time".

---

## Security

- Passwords hashed with bcrypt (cost 12). The hash is never returned by any route and is
  asserted absent from the serialised user in the test suite.
- Sessions are opaque random tokens; only their SHA-256 digest is stored, so a database
  leak cannot be replayed as a cookie.
- Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` in production. 12h, or 30 days with
  "remember me".
- Login: generic error messages, an in-process sliding window **and** a persisted lockout
  that survives restarts, plus a dummy bcrypt comparison so timing does not reveal whether
  an account exists.
- Logout revokes the row server-side, so replaying an old cookie fails.
- All queries go through Drizzle's parameterisation; the one place raw SQL is built
  (export) quotes identifiers from a fixed allowlist.

---

## Privacy

Settings → Privacy & AI access controls what the advisor may read. Sensitive modules —
diary, photos, medication, prayer — default to **off** and require an explicit opt-in.
`hasAccess()` is the single gate every advisor path goes through, and the tests assert that
a disabled module produces "switched off" rather than data.

---

## Backup and export

Settings → Data & backup exports every row you own as JSON (password hashes and session
tokens excluded), plus CSV for the time-series tables. You are never locked in.

---

## Tests

```bash
npm test
```

63 tests across 6 files, all running against a real PostgreSQL database:

- **auth** — hashing, policy, session resolution, expiry, revocation, lockout, no hash leak
- **study** — start, duplicate prevention, refresh persistence, pause, resume, stop,
  double-stop, discard, and the class-time/self-study separation
- **tasks** — create, validation, completion timestamps, buckets, recurrence, archiving
- **academic** — weighted progress, configurable grading bands, credit-weighted CGPA,
  target feasibility
- **reminders** — scheduling, dedupe, delivery + logging, recurrence, missed handling,
  retry, completion
- **permissions** — sensitive defaults, explicit opt-in, blocked-module behaviour

Verified separately over HTTP against a production build: anonymous access redirects from
every protected route; a wrong password returns a generic error with no cookie; correct
credentials set the session cookie; and logout clears the cookie *and* revokes the row so
the old cookie no longer works.

---

## Notes and deliberate choices

- **No localStorage persistence.** Browser state is only a cache; the server is the source
  of truth.
- **No productivity score.** Study analytics report hours, sessions, distribution and
  consistency — evidence, not a number invented to look good.
- **Stages, not percentages.** Skills and knowledge domains use Exposure → Foundation →
  Working Knowledge → Applied → Advanced, backed by evidence rows.
- **Archive over delete.** Completed work stays in history.
- **Medication is tracking only.** Nothing in this app prescribes, adjusts or recommends
  doses.
- **Reminders are honest.** A reminder is only marked `sent` when a notification actually
  exists; if browser notifications are blocked, the UI says so instead of pretending.
