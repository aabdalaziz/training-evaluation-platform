AGENTS.md — أَثَر (Athar · TRACE) · Education, Training & Development Portal
دستور البناء لأي وكيل برمجي أو مطوّر يعمل على هذا المستودع. اقرأه كاملًا قبل أي تعديل.
Build constitution for any coding agent or developer. Read fully before changing anything.

1. What this repository is
One Next.js 14 (App Router, TypeScript) + Supabase (Postgres, Auth, Storage, RLS) application deployed on Vercel.
Two faces, one codebase:
Public portal «أَثَر» at / — services, programs catalog, enrollment (OTP), payments/invoices, consulting, resources, live learning, learner profile.
Evaluation platform «منصة التقويم» — the original training-evaluation product (surveys, attendance, impact follow-up, certificates, KPIs, reports). It remains one service of the portal.
Production: https://athar-portal.vercel.app (alias: training-evaluation-platform.vercel.app). Supabase project nybinzuqwhcctgwcimru.
Language: Arabic-first (RTL) with full English parity on the public portal. Admin pages are Arabic.
2. Non-negotiable rules
No new npm dependencies. Use fetch, Canvas, built-ins. PDFs are rendered client-side on Canvas (lib/certificates/render.ts). Excel via lib/export/xlsx.ts.
No new Vercel cron jobs (Hobby plan). Scheduled work piggybacks on existing /api/cron/* or runs on demand.
Whole-file deliverables. The owner edits only through the GitHub website. Every change is a complete file, numbered sequentially (e.g. 326-page.tsx), with an absolute link https://github.com/aabdalaziz/training-evaluation-platform/edit/main/<path> (existing) or /new/main?filename=<path> (new; encode [id] as %5Bid%5D). SQL first, then lib/, then app/api, then pages, then tests.
SQL migrations are idempotent (if not exists, create or replace, DO blocks) and end with ONE union all diagnostic query whose expected counts are stated in the step guide. Validate syntax with pglast before delivery.
Row Level Security on every new table. Service-role only via SUPABASE_SERVICE_ROLE_KEY on the server (app/api/*). Never expose service key to the client.
Zero hydration errors. <style dangerouslySetInnerHTML={{ __html: CSS }} /> (never <style>{CSS}</style>); client-only values start as null and are set in useEffect.
Every pushed file is verified with curl -g raw.githubusercontent.com/... | cmp against the delivered file, and Vercel status checked via api.github.com/repos/.../commits/<sha>/status.
Bilingual by construction: public content uses T = { ar, en } + t(x, lang) from lib/portal/content.ts; dates/numbers in <bdi>; currency via money() in lib/portal/payments.ts.
Future-proof data model (strategic decisions, 2026-10): skills are first-class (portal_skills, link tables), unified sector list, portal_learning_events (xAPI-like), portal_organizations for B2B, and every content item carries sector, skills[], level, delivery, ai_ready.
3. Map of the code
Area	Path	Notes
Portal shell & brand	app/components/PortalShell.tsx	nav, footer, useLang, CSS pt-* classes, AtharMark; localStorage athar_lang, athar_resume
Portal content & i18n	lib/portal/content.ts	BRAND, SERVICES, NAV, UI, CONTACT, t()
Catalog & enrollment	lib/portal/catalog.ts, app/programs/*, app/admin/enrollments, app/api/enrollments	magic-link OTP pattern
Payments	lib/portal/payments.ts, lib/portal/webhook.ts, app/pay/[id], app/admin/payments, app/api/payments/*	invoices ATH-YYYY-00001, bank transfer + Moyasar, receipts bucket portal-receipts
Consulting	lib/portal/consulting.ts, app/consulting/*, app/admin/consulting, app/api/consulting	request → quote → invoice → milestones
Admin portal tabs	app/components/PortalAdminTabs.tsx	add a tab for every new admin page
Evaluation platform	app/dashboard, app/reports, app/impact, app/attend, lib/*	legacy product — do not break
Email	lib/email/resend.ts sendViaResend	HTML emails built in lib/portal/* (shell() helper)
Icons	lib/ui/icons.tsx	fixed IconName set — check before using a name
Tests	tests/*.test.ts + tests/index.ts	run npx tsx tests/index.ts
Local QA	tools/mock-supabase.py, tools/shot-*.py	mock PostgREST/Auth/Storage + Playwright E2E
Migrations	supabase/migrations/YYYYMMDD_*.sql	applied manually in Supabase SQL Editor
4. Roles
PLATFORM_ADMIN, SUPER_ADMIN, ADMIN, PROGRAM_MANAGER = writers (portal_is_writer()); + QUALITY_ANALYST = staff readers (portal_is_staff()); TRAINER; learners authenticate by email OTP and own rows via auth.uid().

5. Skills (detailed playbooks)
.agents/skills/athar-feature/SKILL.md — how to build a complete phase end-to-end.
.agents/skills/athar-sql/SKILL.md — migrations, RLS, RPCs, diagnostics.
.agents/skills/athar-ui/SKILL.md — PortalShell, pt-*, RTL, Canvas PDFs, known pitfalls.
.agents/skills/athar-qa/SKILL.md — tsc → tests → build → mock → Playwright → delivery verification.
6. Roadmap context
P1 identity · P2 catalog+enrollment · P3 payments · P4 consulting — LIVE.
P5 resources repository (+ skills taxonomy, sectors, learning events) · P6 live & hybrid learning · P7 مِعيار placement integration (results as skill evidence) · P8 unified learner skill profile + organizations (B2B) + sector impact reports + public Catalog API.
