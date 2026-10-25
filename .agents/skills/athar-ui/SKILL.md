name: athar-ui
description: Build Athar portal pages (public and admin) with PortalShell, pt-* classes, RTL/bilingual rules, Canvas-rendered PDFs and the React/Next pitfalls already solved in this repo. Use when creating or editing any page under app/ in github.com/aabdalaziz/training-evaluation-platform.
Athar — UI rules
Brand
Navy #0f2a4e · Teal #0b8a83 · Gold #c9a24b · slate greys. Fonts via var(--font-ar). Tagline «نتعلّم، نتدرّب، نتطوّر… ونقيس الأثر». Legal entity «بوابة التميز للاستشارات والتدريب / CenterGate for Excellence».

Public pages
'use client', wrap in <PortalShell>; const { lang } = useLang(); everything bilingual via t() or lang === 'ar' ? … : ….
Layout skeleton: pt-main > section.pt-pagehead > .pt-wrap > .pt-crumbs + h1 + p then section.pt-sec > .pt-wrap (.pt-two for main+aside). Reusable classes: pt-box, pt-form (label > input), pt-alert ok|err, pt-btn [gold|light|ghost|small], pt-grid, pt-card, pt-ic <tone>, pt-tag, pt-chips, pt-empty, pt-prose, pt-facts, pt-sechead.
pt-steps/pt-step are styled for DARK sections only; on light backgrounds define module-local classes.
Page-local CSS: const CSS = \...`+<style dangerouslySetInnerHTML={{ __html: CSS }} />at the end of<main>. Prefix module classes (cs-, rs-, lv-`).
Mobile: breakpoints 960/760/640px; sticky asides become static under 760px.
RTL: text-align:start, margin-inline-start, border-inline-start; wrap dates/numbers/IBAN/codes in <bdi>; dir="ltr" on email/phone inputs.
Hero actions/links use Icon from lib/ui/icons.tsx — verify the name exists in IconName.
Admin pages (Arabic only)
Pattern from app/admin/enrollments/page.tsx: .en wrapper, .en-wrap, .en-head, <PortalAdminTabs counts={{ '/admin/x': n }} />, .en-card, .en-tabs filters, .en-tools (select/input/Excel/refresh), .en-row.<status> expandable with .en-top → .en-body, .en-btn [ok|warn|ghost], .en-err/.en-ok notices.
Keep the top-level admin nav untouched (width-critical at 1366px); link new admin pages from dashboard/PortalAdminTabs.
Global admin shell is fixed; page padding-top 92px.
Data access from pages
const db = useMemo(() => supabase(), []); Supabase-js inferred never types → cast as any[]/as Type.
API calls: fetch('/api/x', { headers: { Authorization: \Bearer ${session.access_token}` } }), parse { success, error, mail_error }`.
Confirmations with window.confirm (Playwright auto-accepts via dialog handler).
PDFs (client-side Canvas)
A4 portrait 1654×2339 (IW/IH, QW/QH); canvasToJpeg, jpegToPortraitPdf, downloadBytes, cleanFilename from lib/certificates/render.ts / lib/portal/payments.ts.
RTL layout: x0 + dir*k; columns ≥ ~200px from the edge; fillText(text, x, y, maxWidth); await document.fonts.ready before drawing; preview with pymupdf at 60dpi.
Uint8Array<ArrayBufferLike> is not a BlobPart → copy into a fresh ArrayBuffer.
Pitfalls
Hydration: no <style>{CSS}</style>; no Date.now()/localStorage during render; render only after client loaded.
useSearchParams requires a <Suspense> boundary in the page export.
athar_resume in localStorage triggers a redirect on the next authenticated portal load — clear it when the resumed page mounts.
Buttons inside forms default to submit; add type="button" for non-submit actions; E2E selectors use form button:not([type=button]).
Catalog values used in fixtures/tests must match lib/portal/* option lists exactly.
