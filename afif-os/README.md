# Afif OS

A private **personal operating system** — one system for academic work, self-study,
learning, projects and life tracking, instead of twenty disconnected productivity tools.

Next.js · TypeScript · Tailwind CSS v4 · PostgreSQL · Drizzle ORM · Zod · Vitest

---

## Current state

All nine phases of the build plan are implemented and working end to end. Every route in
the sidebar reaches a real page reading and writing PostgreSQL — no route renders a "not
built yet" screen, and no page invents data.

| Phase | Scope | Status |
| --- | --- | --- |
| 1 | Authentication, database, layout, dashboard | **Done** |
| 2 | Tasks, calendar, study timer, study history | **Done** |
| 3 | Reminder engine, notifications | **Done** (in-app delivery + `POST /api/tick` cron; web push not configured) |
| 4 | Semesters, courses, assessments, CGPA, target calculator, resources | **Done** |
| 5 | Books, projects, achievements, opportunities | **Done** |
| 6 | Polymath, notes, questions, skills, knowledge graph | **Done** |
| 7 | Life modules (activities, prayer, medication, diary, photos, timeline) | **Done** |
| 8 | Analytics | **Done** |
| 9 | AI advisor | **Done** — deterministic rule engine, permission-gated, LLM-ready |

The database schema is 41 tables, all migrated.

### Things this deliberately does not do

- **No productivity score.** Analytics reports counts, sums and distributions of things
  you actually recorded. A single blended number would be invented, and it would become
  the thing optimised instead of the work.
- **No skill percentages.** Skills are a mastery stage plus the evidence records behind it.
- **No fake AI.** The advisor is a rule engine that names the tables it read, and every
  read goes through the permission gate. It is not a chatbot, and there is no LLM call.
- **No medical advice.** Medication tracking logs what you took; it never recommends
  changing, skipping or adjusting a dose.
- **No invented prayer or diary content.** Unlogged prayers stay unlogged; prayer data,
  photos, diary and medication are closed to the advisor unless explicitly enabled.

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

### Scheduling the reminder engine

The engine runs whenever you open the dashboard or the reminders page. For days when you
don't open it, point a cron job at the engine endpoint:

```bash
curl -X POST https://your-host/api/tick \
  -H "Authorization: Bearer $REMINDER_TICK_TOKEN"
# => {"ok":true,"scanned":3,"sent":1,"failed":0,"missed":0,"rescheduled":2,"ranAt":"…"}
```

Without `REMINDER_TICK_TOKEN` (minimum 16 characters) the endpoint returns **503** and runs
nothing — it never becomes an unauthenticated way to mutate reminder state.

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
                                      books, projects, achievements, opportunities,
                                      learning, life, analytics, advisor, search,
                                      export, settings
                                      (each with a -validation sibling; the actions
                                      live in *-actions.ts)
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

214 tests across 18 files, all running against a real PostgreSQL database:

- **auth** — hashing, policy, session resolution, expiry, revocation, lockout, no hash leak
- **study** — start, duplicate prevention, refresh persistence, pause, resume, stop,
  double-stop, discard, and the class-time/self-study separation
- **tasks** — create, validation, completion timestamps, buckets, recurrence, archiving
- **academic** — weighted progress, configurable grading bands, credit-weighted CGPA,
  target feasibility
- **academic-modules** — semester activation and archiving, course counts and restore,
  resource ownership, and that a foreign user cannot activate, edit or delete
- **reminders** — scheduling, dedupe, delivery + logging, recurrence, missed handling,
  retry, completion
- **books** — page progress derived from the stored page, reading sessions, rejection of
  a page beyond the book's length
- **phase5** — projects, achievements and opportunities, including urgency windows and
  completion stamping
- **learning** — domains, notes, questions, skills, evidence stages, and the knowledge
  graph's refusal of self-links, cross-owner links and duplicates
- **life** — derived activity duration, prayer streak rules, dose uniqueness, diary
  `aiAllowed` defaulting to false and being withdrawn on re-save, reflections
- **analytics** — every aggregate reconciled against the raw tables, zeros present for
  empty days, class time never merged into self-study
- **advisor** — no question falls through to the default arm, and gated modules return
  "switched off" with `blocked:*` in the recorded context
- **permissions** — sensitive defaults, explicit opt-in, blocked-module behaviour
- **tick route** — the cron endpoint refuses to run unconfigured, rejects bad tokens, and
  delivers a due reminder when called correctly
- **login-pending** — renders the login form under jsdom and asserts a rejected action
  can never leave the button stuck on "Signing in…", and that success navigates
- **session-cookie** — the `Secure` attribute follows the connection actually in use, not
  the build mode, so a browser on plain http is not handed a cookie it must discard

Verified separately over HTTP against a production build: anonymous access redirects from
every protected route; a wrong password returns a generic error with no cookie; correct
credentials set the session cookie; and logout clears the cookie *and* revokes the row so
the old cookie no longer works.

---

## Notes and deliberate choices

- **No localStorage persistence.** Browser state is only a cache; the server is the source
  of truth.
- **No productivity score.** Analytics report hours, sessions, distribution and
  consistency — evidence, not a number invented to look good.
- **Stages, not percentages.** Skills and knowledge domains use Exposure → Foundation →
  Working Knowledge → Applied → Advanced, backed by evidence rows.
- **Archive over delete.** Completed work stays in history.
- **Medication is tracking only.** Nothing in this app prescribes, adjusts or recommends
  doses.
- **Reminders are honest.** A reminder is only marked `sent` when a notification actually
  exists; if browser notifications are blocked, the UI says so instead of pretending.
