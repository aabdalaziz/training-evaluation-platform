---
name: athar-feature
description: Build a complete feature phase for the Athar portal (Next.js 14 + Supabase) end-to-end — SQL, lib, API, pages, tests, mock, E2E, numbered GitHub deliverables. Use when asked to add a new module/phase (e.g. resources, live sessions, profiles) to github.com/aabdalaziz/training-evaluation-platform.
---

# Athar — build a feature phase

## Order of work (never reorder)
1. **Read first**: `AGENTS.md`, the previous phase's `lib/portal/*.ts`, `PortalShell.tsx` class list, `PortalAdminTabs.tsx`, the last migration for numbering/policy style.
2. **SQL** `supabase/migrations/YYYYMMDD_portal_pN.sql` → see `athar-sql`. Validate with `pglast`.
3. **Library** `lib/portal/<module>.ts`: types, catalogs (`{ value, label: T }[]`), label helpers, validators (return `string | null`, bilingual via `lang`), pure computations, Excel sheet builder (`{ name, rtl, widths, rows }`), email builders (`shell()` + `esc()`), Canvas renderers. Keep route files free of helpers (app-router `route.ts` may export only handlers).
4. **API** `app/api/<module>/route.ts`: `POST` with `Authorization: Bearer <access_token>`; verify user via service client `auth.getUser(token)`; check role from `profiles`; `{ action }` switch; always return `{ success, mail_error? }`; emails are best-effort.
5. **Pages**: public `app/<module>/page.tsx` (+ `[id]`), admin `app/admin/<module>/page.tsx`. Wrap `useSearchParams` users in `<Suspense>`. See `athar-ui`.
6. **Patches**: `PortalAdminTabs.tsx` (+tab), `content.ts` (service `status:'live'`, cta href, NAV), any cross-module fallbacks.
7. **Tests** `tests/<module>.test.ts` + import in `tests/index.ts`; update counts in `tests/portal.test.ts` when services/NAV change.
8. **QA** per `athar-qa` (tsc, tests, build, mock fixtures + RPCs, Playwright shots, PDF/Excel downloads).
9. **Package**: copy files to `/home/user/dashboard-redesign/phase6-pN/` numbered sequentially (continue global numbering), write `STEPS-PN-AR.md` (table: # · path · new/replace; SQL expected counts; Supabase config; production test script), present links.

## Conventions
- Status enums as `text` + `check` constraint; labels in `Record<Status, T>`.
- Client access pattern: anonymous → email gate (`signInWithOtp`, `emailRedirectTo: window.location.origin + path`, set `localStorage.athar_resume = path`) → authenticated form/page; `localStorage.removeItem('athar_resume')` once loaded.
- Admin pages: `STAFF`/`WRITERS` arrays, redirect to `/login?next=` when unauthenticated, `/dashboard` when unauthorized; `run(key, fn)` wrapper for busy/error/notice.
- Filters: `.eq('visible_to_client', true)` on the client even when RLS already hides rows (defense in depth).
- IDs in links: `/admin/<module>?open=<id>`; `?new=1` after creation shows a success alert.
- New content tables must include: `sector text`, `skills uuid[]` (or link table), `level`, `delivery`, `ai_ready boolean`, `lang`.
- Log learner actions into `portal_learning_events(user_id, verb, object_type, object_id, context jsonb)`.

## Delivery message (Arabic)
Numbered table of files with absolute GitHub links, SQL first with expected diagnostic counts, Supabase Auth/Storage settings if any, a 5-step production test, and "what changed outside the module". Ask for the final commit SHA, then verify with `cmp` and the Vercel status API.
