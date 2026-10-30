# AGENTS.md — أَثَر (Athar · TRACE) · Education, Training & Development Portal

> دستور البناء لأي وكيل برمجي أو مطوّر يعمل على هذا المستودع. اقرأه كاملًا قبل أي تعديل.
> Build constitution for any coding agent or developer. Read fully before changing anything.
> Last updated: 2026-10-30 (after P26 «رحلة الجهة»). Production HEAD at that time: `f304247`.

## 0. Ownership — الملكية (read first)
- All intellectual property in this repository — code, data model, UI, the brand «أَثَر / Athar · TRACE», methodologies and content — is the **exclusive property of Dr. Ahmed Mohamed Abdelaziz Badawi (د. أحمد محمد عبدالعزيز بدوي)**. See `COPYRIGHT.md` and `LICENSE`.
- Institutions mentioned anywhere (Prince Mugrin University, Global Center for Teaching Arabic, CenterGate for Excellence) are **employers/collaborators**, never owners. Never phrase UI, docs or emails in a way that attributes ownership to them.
- Commercial operations (invoices, quotes, contracts) currently run under **CenterGate for Excellence — شركة بوابة التميز للاستشارات والتدريب** (`BRAND.legal`). Ownership is `BRAND.owner`. Keep the two separate in code and copy.
- Every new source file starts with the header comment: `// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md` (SQL: `-- © 2026 …`).
- Agents must not publish, mirror or relicense any part of this repository.

## 1. What this repository is
- One Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, Storage, RLS) application deployed on Vercel (Hobby). Zero runtime npm additions since P1.
- Two faces, one codebase:
  - **Public portal «أَثَر»** at `/` — the institution homepage and the whole learner/organization/agent experience (P1–P26, see §6).
  - **Evaluation platform «منصة التقويم»** — the original training-evaluation product (surveys, attendance, impact follow-up, certificates, KPIs, reports). It remains one service of the portal. Do not break it.
- Production: https://athar-portal.vercel.app (alias: training-evaluation-platform.vercel.app). Supabase project `nybinzuqwhcctgwcimru`. 85 `portal_*` tables, all with RLS.
- Language: Arabic-first (RTL) with English parity on the public portal. Admin and learner pages are Arabic. **Terminology matters**: official professional names in contracts/certificates/admin UI; narrative names only on the homepage, `/2062` and «أثير». Renames already applied: «هندسة البرامج التدريبية» (not مصنع), «الميسِّر» (not الطيار المساعد), «مؤشر الأداء» (not طقس).
- Companion documents: `docs/OPERATIONS-AR.md` (legacy platform ops), `docs/SHIELD-AR.md` (security posture), `docs/RELEASE-*.md` (phase release notes), `supabase/migrations/*` (every SQL ever applied, in order).

## 2. Non-negotiable rules
1. **No new npm dependencies.** Use `fetch`, Canvas, WebCrypto/`node:crypto`, built-ins. PDFs on Canvas (`lib/certificates/render.ts`), Excel via `lib/export/xlsx.ts`, Ed25519 via `lib/portal/vc-server.ts`.
2. **No new Vercel cron jobs and no new env vars** unless the owner approves explicitly. Scheduled work piggybacks on the daily `/api/followups/send` chain (see `runCouncils`, `runJourney`, vault/observatory/outreach runners) — add a `runX(db, { dry, site })` and wire it there.
3. **Whole-file deliverables.** The owner edits only through the GitHub website. Deliver one code zip with `app/ lib/ tests/` at its root (dragged into `/upload/main` → one commit), SQL as a separate `.sql` + `.txt` twin, and Arabic step guide. Dot-dirs (`.agents`, `.well-known`) go through `/new/main?filename=` or `/edit/main/...` links. Numbering is global and sequential (next number is stated in the latest `MANIFEST-P*-AR.txt`; after P26 it is **880**).
4. **SQL migrations are idempotent** (`if not exists`, `create or replace`, DO blocks for constraints/policies) and end with ONE `union all` diagnostic query whose expected counts are stated in the step guide. Commit a copy under `supabase/migrations/`.
5. **Row Level Security on every new table.** Learner rows: `user_id = auth.uid()` (+ email fallback where legacy rows have no user_id). Writes go through server routes with the service role; `revoke insert, update, delete … from anon, authenticated` when the client must never write.
6. **Zero hydration errors.** `<style dangerouslySetInnerHTML={{ __html: CSS }} />`; client-only values start as `null` and are set in `useEffect`; page files export only the default component (+ `dynamic`/`runtime` when needed).
7. **Every pushed file is verified** byte-for-byte (`raw.githubusercontent.com/<sha>/<path>` + `cmp`) and Vercel status checked via `api.github.com/repos/.../commits/<sha>/status`.
8. **Bilingual by construction** on public surfaces: `T = { ar, en }` + `t(x, lang)` from `lib/portal/content.ts`; dates in `toLocaleDateString('ar-SA-u-nu-latn-ca-gregory')`; currency via `money()`.
9. **Future-proof data model**: skills first-class (`portal_skills`), unified sectors, `portal_learning_events` (xAPI-like: `verb, object_type, object_id, skills[], context`) for every learner action, `portal_organizations` for B2B. New content carries `sector`, `skills[]`, `level`, `delivery`, `ai_ready`, `lang`.
10. **Product principles (since P10, owner-approved — never violate):**
    - **AI assists, a human approves.** Computed levels ≠ approved levels. AI output is labelled and editable; nothing AI-written is published or stored as fact without an explicit user/staff action.
    - **No personal identifiers reach AI models.** Anonymize («عضو 1/2…») before `runAi`; declared in `/.well-known/privacy.json`.
    - **k ≥ 5 (and ≥ 2 organizations where relevant) for any aggregate shown to anyone else.** Never lower it for small groups — say «below quorum» honestly instead.
    - **Private by default; selective disclosure; revocable.** Shares/badges/charters are Ed25519-signed OpenBadge documents (`portal_vc_issuances`, kinds `credential|snapshot|dataset|council_badge|org_charter|journey|org_journey`), verifiable at `/verify/vc?code=`, and revocation is always one click.
    - **Compare only with self**, never rank people or organizations.
    - **The user's own words only.** Quotes attributed to a person come from their own text; a peer's words are never attributed to them.
    - **Not «تقليدي».** The owner rejects dashboards/tables/reports as the shape of new features. Build experiences (story chapters, rooms, mirrors, councils, letters to one's future self); official terminology stays in admin/contract surfaces.
    - **Every interaction accepts text, voice or video** through the single `Channel` component (`app/components/Channel.tsx`, media in `portal_media`).

## 3. Map of the code
| Area | Path | Notes |
|---|---|---|
| Portal shell & brand | `app/components/PortalShell.tsx` | nav, footer, `useLang`, `pt-*` classes, `AtharMark` |
| Content & i18n | `lib/portal/content.ts` | `BRAND`, `SERVICES`, `NAV`, `UI`, `t()` |
| Homepage & living memory (P10/P14) | `lib/portal/home.ts`, `app/page.tsx`, `app/2062` | 3 daily anonymized impact threads (k≥5) |
| Catalog · enrollment · payments · consulting (P2–P4) | `lib/portal/catalog.ts`, `payments.ts`, `consulting.ts`, `app/programs`, `app/pay`, `app/consulting` | invoices `ATH-YYYY-00001`, Moyasar + bank transfer |
| Resources · live learning · WebRTC rooms (P5/P6/P13c) | `lib/portal/resources.ts`, `live.ts`, `app/live`, `app/room`, `app/api/rooms` | unlimited parallel rooms |
| مِعيار placement sync (P7) | `lib/portal/placement*.ts` | separate app https://miaar-placement-test.vercel.app; results become skill evidence |
| Skills · levels · organizations (P8) | `lib/portal/skills.ts`, `profile.ts`, `org.ts`, `app/me/skills`, `app/org`, `app/admin/orgs` | computed vs approved levels; org admins confirm membership |
| Program engineering · simulations · missions (P11/P12) | `lib/portal/factory.ts`, `sim.ts`, `missions*.ts`, `app/sim`, `app/me/missions` | supervisor confirms missions |
| كل يوم مهارة (P13a) | `lib/portal/daily-case.ts`, `app/api/daily`, `app/me` | situation → user's own handling → performance mirror (never MCQ) |
| Companion «أثير» · copilot «الميسِّر» (P13b/d) | `lib/portal/copilot.ts`, `app/athir`, `app/api/copilot` | |
| Messaging (P16) | `lib/portal/notify.ts`, `messages.ts`, `whatsapp.ts`, `lib/email/resend.ts`, `push.ts` | `notify(db, msg)` tries channels in order, logs to `portal_message_log`; email/WhatsApp activation deferred by owner |
| Sovereign wallet · VC (P17) | `lib/portal/vc.ts` (pure), `vc-server.ts` (sign), `app/verify/vc`, `app/.well-known/did.json` | did:web, Bitstring status list, `VC_SIGNING_KEY` |
| Observatory (P18) · PWA «أَثَر في الجيب» (P19) | `lib/portal/observatory*.ts`, `pocket*.ts`, `public/sw.js`, `app/components/Pocket.tsx` (`fastToken`) | |
| Embassy · MCP · OAuth 2.1 (P20) | `lib/portal/mcp.ts` (tool registry), `mcp-server.ts` (handlers), `oauth*.ts`, `app/mcp`, `app/oauth`, `app/.well-known/*` | public tools at `/mcp/public`; personal tools need delegate token + `pscope`; add handler via `internal(c, '/api/...?view=summary')` |
| Shield (P21) | `lib/shield/*`, `app/admin/shield` | `limitFor(db, name, ipOf(req))` buckets in `LIMITS`; security events; CSP report-only |
| Vault · PDPL (P22) | `lib/vault/registry.ts` (RoPA — **every personal table must be registered**), `app/me/data`, `app/admin/vault`, `app/privacy` | 30+30 day DSR, 72 h incidents, 7-day erasure hold |
| Councils (P23) | `lib/councils/*`, `app/councils`, `app/me/council`, `app/admin/councils` | 5–7 members, ≥2 orgs, 6-week cycles, scribe AI on anonymized text |
| Organization impact (P24) | `lib/org-impact/*` (`auth.ts` has `svc/who/bad/siteOf`), `app/api/org/*`, `app/components/OrgImpact.tsx` | echo k=5 · 28 d · self-mirror 90 d · charter `ATH-OC` · return payment 55/20/15/10 |
| Practitioner journey (P25) | `lib/journey/*` (`registry.ts` pure chapter builder, `load.ts`, `share.ts`, `cron.ts`), `app/api/journey`, `app/me/journey`, `app/journey/[code]` | chapters derived from events only; share `ATH-J` 12 months; time capsule 365 d; `attachPeers` adds the count-only «الفصل المشترك» from the org journey (never in the public share) |
| Organization journey (P26) | `lib/org-journey/*` (`registry.ts` `buildOrgChapters` k=5 by quarter × kind, `load.ts`, `share.ts`, `cron.ts` `runOrgJourney`), `app/api/org/journey`, `app/components/OrgJourney.tsx` (tab `journey` in `/org`), `app/org-journey/[code]`, `/councils#yearbooks` | org_admin writes, staff reads; yearbook `ATH-OY` 12 months (one per org on the public shelf, opt-in); org capsule 365 d delivered to the org admins of that day; MCP public `org_yearbook` |
| Learner home | `app/me/page.tsx` | add a `me-tablink` for every new learner surface |
| Admin tabs | `app/components/PortalAdminTabs.tsx` | add a tab for every new admin page |
| Evaluation platform (legacy) | `app/dashboard`, `app/reports`, `app/impact`, `app/attend`, `lib/{surveys,attendance,impact,outcomes,…}` | `profiles.role` is a Postgres ENUM in prod → `upper(role::text)` |
| Icons | `lib/ui/icons.tsx` | fixed `IconName` union — type `Record<string, IconName>` maps |
| Tests | `tests/*.test.ts` + `tests/index.ts` | `npx tsx tests/index.ts`; 443 tests after P26 |
| Local QA | `tools/mock-supabase.py`, `tools/shot-p*.py` | kept in the owner's workspace (`dashboard-redesign/tools`), not in the repo |
| Migrations | `supabase/migrations/YYYYMMDD_portal_pN.sql` | applied manually in the Supabase SQL editor; keep the folder complete |

## 4. Roles & auth
- `PLATFORM_ADMIN, SUPER_ADMIN, ADMIN, PROGRAM_MANAGER` = writers; `+ QUALITY_ANALYST` = staff (`STAFF` arrays in routes); `TRAINER`; learners authenticate by email OTP/password and own rows via `auth.uid()`.
- Route pattern: `Authorization: Bearer <access_token>` → service client `auth.getUser(token)` → `profiles.role/full_name`. Delegated agents arrive with the `X-Athar-Delegate` header (`delegateFromHeaders`) and a scope (`wallet:read | daily:write | missions:read | snapshot:issue | council:write`) — **agents read; only the person writes/publishes**.
- Org admins: `portal_org_members.role='org_admin' and status='confirmed'` (`isOrgAdmin`).

## 5. Skills (detailed playbooks)
- `.agents/skills/athar-feature/SKILL.md` — how to build a complete phase end-to-end (current pattern, post-P26).
- `.agents/skills/athar-product/SKILL.md` — how to design a phase that the owner will not call «تقليدي» (principles, checklists, examples).
- `.agents/skills/athar-sql/SKILL.md` — migrations, RLS, RPCs, diagnostics.
- `.agents/skills/athar-ui/SKILL.md` — PortalShell, `pt-*`, RTL, Canvas PDFs, known pitfalls.
- `.agents/skills/athar-qa/SKILL.md` — tsc → tests → build → mock → Playwright → delivery verification.

## 6. Roadmap context (all LIVE unless noted)
P1 identity · P2 catalog+enrollment · P3 payments · P4 consulting · P5 resources+skills+events · P6 live/hybrid · P7 مِعيار · P8 skill profile+orgs · P9 homepage · P10 living memory («الذاكرة الحية») · P11 program engineering · P12 simulations+missions · P13 كل يوم مهارة · أثير · channel (text/voice/video) · foresight · P14 impact threads · P15 glass office · P16 messaging (channels; activation deferred) · P17 sovereign wallet (Ed25519) · P18 observatory · P19 PWA · P20 embassy/MCP/OAuth 2.1 (real-Claude validated) · P21 shield · P22 vault (PDPL) · P23 councils · P24 organization impact · P25 practitioner journey · P26 organization journey («رحلة الجهة»: chapters k≥5 by quarter, «ما تغيّر فينا», yearbook `ATH-OY`, org letter to itself).
Pending by owner decision: P21-ب CSP enforce; Resend domain + `REPORTS_FROM_EMAIL`; WhatsApp (direct Meta vs BSP); SDAIA controller registration, legal review → `NOTICE_DRAFT=false`; DPAs.
Candidate next phases (ideas raised in `docs/RELEASE-P26-AR.md` §7): «ليلة الكتاب» (live reading room when a yearbook is issued), «رفّ القطاع» (sector thread once ≥5 orgs publish), «الفصل القادم» (facilitator suggests one step to complete a near-quorum chapter); operations pause (email/WhatsApp activation) awaits owner decisions.
