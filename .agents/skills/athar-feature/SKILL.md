---
name: athar-feature
description: Build a complete feature phase for the Athar portal (Next.js 14 + Supabase) end-to-end — SQL, pure lib, API route, learner/public/admin pages, MCP tool, vault registry, cron hook, tests, mock fixtures, Playwright E2E, one-zip GitHub delivery. Use when asked to add a new module/phase (P28+) to github.com/aabdalaziz/training-evaluation-platform. Updated after P27.
---

# Athar — build a feature phase (post-P27 pattern)

## Order of work (never reorder)
1. **Proposal first** (`P<N>-PROPOSAL-AR.txt`, Arabic, 1–2 pages): the idea in one sentence, the five "movements" of the experience, what stays private, what gets signed, what the agent may read, what the cron does, the DB tables, the constants. Wait for approval. Read `athar-product` before writing it.
2. **Read**: `AGENTS.md`, the previous two phases (`lib/org-journey/*`, `lib/horizon/*`; `lib/journey/load.ts` `loadJourneyInput` is the single source of a person's events; `lib/org-impact/auth.ts` for org-admin auth) — copy their shapes, not older ones. An organization-facing feature is a **tab inside `/org`** (`app/org/page.tsx` + `?tab=`), not a new top-level page.
3. **SQL** `supabase/migrations/YYYYMMDD_portal_pN.sql` (see `athar-sql`): tables with `user_id uuid` + `email text` (legacy rows have no user_id), `status text check (…)`, `meta jsonb default '{}'`, RLS own-read, `revoke` writes from anon/authenticated when only the server writes, extend `portal_vc_issuances_kind_check` if a new signed document kind is added, ONE diagnostic `union all` at the end with expected counts.
4. **Pure library** `lib/<module>/registry.ts`: constants (`*_DAYS`, `*_MONTHS`, `MAX_*`, `K = 5`), types, builders from plain inputs, validators returning `string | null` (Arabic), code formats (`ATH-XX-XXXX-XXXX` via `randomCode(4)` from `lib/portal/profile.ts`), local (non-AI) text builders. No DB, no `process.env` → unit-testable.
5. **DB layer** `lib/<module>/load.ts` (reuse `loadJourneyInput(db, me)` instead of re-querying events; a personal "state" loader returns `{ input, chapters, <current>, <past> }`) (`Promise.all` of `.or(\`user_id.eq.${id},email.ilike.${email}\`)` queries, every query wrapped so one failure yields `[]`), `share.ts`/`badge.ts` for signed documents (copy `lib/journey/share.ts`: insert issuance → `signDocument` with `status_index` → update `vc` + `documentDigest`), `cron.ts` exporting `runX(db, { dry, site, now })` returning `{ ok, counts…, errors[] }` — every scheduled effect must be idempotent (`meta.nudged_at`, status transitions, `.gt('review_at', now)` guards) because the daily cron re-runs; dry runs count only.
6. **AI (optional)**: `runAi({ system, user, parse, local, budgetMs, fast })` + `logAi(db, {...purpose})` from `lib/ai/athar.ts`. Always provide `local` fallback; feed only anonymized text or the user's own words; label the result (`source: 'ai' | 'local'`); never persist without a user action. Reuse an existing `AiPurpose` from `lib/ai/prompts.ts`.
7. **API** `app/api/<module>/route.ts`: `runtime='nodejs'`, `dynamic='force-dynamic'`, `maxDuration=60`; `svc()` service client; `who(req, db)` accepting both Bearer users and `delegateFromHeaders` with the right `pscope`; delegates may only read; `limitFor(db, 'council_write_ip', ipOf(req))` (or a new named bucket in `lib/shield/ratelimit.ts`) on POST; `{ action }` switch; `confirm: true` required for anything that publishes/signs/seals; public reads return `Cache-Control: public, s-maxage=…` + `Access-Control-Allow-Origin: *`; private reads `no-store`. Log learner actions to `portal_learning_events`.
8. **Pages**: learner `app/me/<module>/page.tsx` (`'use client'`, `PortalShell`, `useLang`, `fastToken(db)` from `app/components/Pocket.tsx`, `Channel` for any text/voice/video input, `data-testid` on every interactive block, `<style dangerouslySetInnerHTML>` with a unique class prefix); public `app/<module>/[code]/page.tsx` (`useParams`, explicit 404/410 states); admin page only when staff must decide something.
9. **Patches** (each is a whole-file replacement): `app/me/page.tsx` nav tab · `lib/portal/mcp.ts` tool entry (`tiers`, `pscope`, `kind: 'personal'`, `readOnlyHint`) · `lib/portal/mcp-server.ts` handler via `internal(c, '/api/<module>?view=summary')` · `lib/vault/registry.ts` one RoPA row per new personal table (unit test fails otherwise) · `app/api/followups/send/route.ts` cron hook + result key · `PortalAdminTabs.tsx` if admin page.
10. **Tests** `tests/pN.test.ts` (copy `fakeDb` from `tests/p26.test.ts`; `assert.ok` always with a message; pin `now` and pass it to `structuralChecks(doc, now)`), import in `tests/index.ts`.
11. **Mock**: `tools/mock-supabase.py` — add the new tables to the insert whitelist and a defaults branch (bigserial vs uuid ids!), copy the patched mock back to `dashboard-redesign/tools/` immediately.
12. **QA** per `athar-qa`, then **E2E** `tools/shot-pN.py` (API checks + OAuth delegate flow + cron + Playwright screenshots). Look at the screenshots.
13. **Package** `dashboard-redesign/phase6-pN/`: `files/<repo paths>`, `pN-code-only.zip` (zip `app lib tests` from inside `files/`), `NNN-pN-<name>.sql` + `.sql.txt` twin, `MANIFEST-PN-AR.txt` (numbered: SQL, NEW files, MOD files, sha256 each, next number), `STEPS-PN-AR.txt` (SQL → expected counts → upload zip → verify URLs), `SHA256-PN.txt`, `shots/`. Present the zip, then SQL and STEPS.

## Conventions that bit us
- Keys that can repeat (same skill approved twice) must include the distinguishing value (`level_approved:<skill>:<level>`).
- `Record<string, IconName>` for icon maps; `Icon` names are a fixed union.
- Routes must never export anything but handlers/config.
- Arabic in HTTP headers → `encodeURIComponent`.
- Browser caches `s-maxage` responses → client fetches needing fresh state use `cache: 'no-store'`.
- Cron runs other syncs first (e.g. مِعيار placement) — E2E expectations must be computed after the cron, not hard-coded.
- Mock `/auth/v1/user` returns the admin for ANY token → test 401 without a token, not 403 for other users.
- Event-derived progress compares ISO strings against `signed_at` **and** `now` — E2E fixtures dated in the future are invisible; seed events between the signed date and now.
- Buttons inside dark cards need their own `light` variant in the page CSS (`pt-btn ghost` is navy-on-white).
- Link only to routes that exist in `app/` (`/#daily`, `/me/data`, `/councils`, `/me/missions`) — `/me/daily` and `/me/vault` never existed (fixed in 898–899).
- Rate limits: reuse `limitFor(db, 'council_write_ip', ipOf(req))` for personal writes; E2E runs need a fresh `X-Forwarded-For` per step group.

## Delivery message (Arabic)
Table (number · path · role), QA line (tsc · tests N/N · build · E2E N/N), "ideas that emerged" (the owner welcomes them), then the 3 steps (SQL with expected counts → upload zip → verify URLs). After «تم»: verify every file with `cmp` against `raw.githubusercontent.com/<sha>/<path>` (URL-encode `[`), check the Vercel status API, smoke-test live routes, and close the phase explicitly with the next file number.
