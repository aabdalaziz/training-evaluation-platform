---
name: athar-dialogue
description: How to extend the Athar human dialogue loop (P51–P59 — «دفتر اليوم», «رسالة الشهر», «ردّ على الكلمة», «أمانة صوتية», «كلمة صوتية», «صدى الأسبوع», «نبض الجهة», «خريطة أثرك», «نسيج الشعبة») without breaking its rules — nothing enters evaluation, k ≥ 5 for any aggregate, no names outside the owner's own screen, voice is private/temporary, no server AI, no new cron/env/deps.
---

# Athar — the dialogue loop (P51–P59)

Read `docs/ATHAR-DIALOGUE-LOOP-P51-P57-AR.txt` first; this skill is the operational checklist.

## The loop in one line
Trainer writes/speaks a «كلمة» (P51/P55) → learner answers with a touch/line/voice «أمانة» (P53/P54) → learner gets a weekly 🪞 «صدى» (P56) → the organization gets a monthly «رسالة الشهر» with an aggregated «نبض» (P52/P57) → the learner weaves their own «خيوط» into «خريطة أثرك» (P58) → the trainer reads what the section wove together in «نسيج الشعبة» and answers with a 🧶 word on it (P59) — which is again a «كلمة», so the loop closes on itself.

## Non‑negotiable rules (every new piece must honour all of them)
1. **Nothing enters evaluation.** No column read by `lib/portal/skills.ts`, `lib/journey/registry.ts` scoring, مِعيار, or credentials may be written by the loop. Say so in the UI footer and in the release doc.
2. **k ≥ 5** for anything shown to an organization or the public (`K_ORG = 5` in `lib/org-impact/registry.ts`). Below k: show the privacy mirror sentence, never a number.
3. **No names** outside the author's own screen: «مدرّبك», «زميل», «جلسة». Public faces hide sensitive titles (daily cases → topic via `topicOf`).
4. **Voice** = private bucket `athar-media`, path `word-voice/<trainer_id>/…`, signed temporary URLs, 180‑day purge in the existing media cleanup, limits `TRAINER_VOICE_LIMITS` (20 s) / `VOICE_LIMITS` (15 s · 10/h). Browser dictation (Web Speech) is allowed for text fields; never store new audio without a human listener on the other side.
5. **No server AI** in the loop. Rules must be explicit and visible to the user («حدث ثم حدث خلال N يومًا»).
6. **Dedupe + ≤ 1/day** for every notice kind (`dedupe_key` on `portal_learner_notices`); reuse the daily cron `/api/followups/send` — never add a Vercel cron.
7. **Delete is immediate** (no recycle bin); «declined» choices are never re‑proposed.
8. **Zero new env, zero deps, one SQL first** (with expected diagnostic counts), `.txt` twin for every `.md`.

## Where things live
- Pure cores (unit‑testable, no DB): `lib/portal/day.ts`, `lib/portal/word-reply.ts`, `lib/portal/week-echo.ts`, `lib/org-impact/{letter,pulse}.ts`, `lib/map/registry.ts`, `lib/map/weave.ts` (section aggregation: `weave` · `groupKey` · `orgStrongestThread` · `peersOf`).
- Glue (DB, auth, storage): `lib/map/store.ts`, `lib/map/nudge.ts`, `lib/map/weave-load.ts` (roster = `collectDayBook` classrooms · P58 maps in batches of 6 · consented notes always read fresh), routes under `app/api/me/*`, `app/api/org/*`, `app/api/admin/org/*`, `app/api/verify/*`.
- UI: `app/components/{VoiceRecorder,EchoSay,LetterSheet,AtharMapSvg}.tsx`; learner pages under `app/me/*` load heavy desks with `next/dynamic({ ssr:false })`.
- Notice kinds: extend `NoticeKind`, `KIND_AR`, `KIND_ICON` in `lib/portal/notices.ts` together.
- New routes → `lib/portal/way.ts`; new tables → `lib/vault/registry.ts`; voice aliases → `lib/portal/voice.ts`.

## Aggregating learner-authored content (P59 pattern)
- **Consent is a column on the learner's own row** (`portal_map_threads.share_trainer` + `shared_at`, check `share_trainer=false or status='kept'`), default off, revocable instantly, withdrawn automatically when the row leaves the «kept» state. Never cache consented text — cache only the heavy part (maps) and re-read consents on every request.
- **Roster = the same source the trainer already sees** (`collectDayBook` → enrollments ∪ attendance). Do not invent a second membership query; two screens showing different counts destroys trust.
- Aggregates: stations shown only when ≥ k learners reached them; threads `woven` (kept ≥ k) / `untaken` (kept 0 and offered ≥ k); 1–4 keepers are invisible, not «nobody». Personal stations (`credential:`/`badge:`) group by title, individual ids (`mission:`/`hand:`/`horizon*`) by kind, daily cases by topic (`groupKey`).
- Quotes: none before k distinct consenters; ≤ 10; order seeded by day so timing never leaks. No name, no date, no counts below k anywhere in the payload (test the raw JSON for emails).
- The trainer's answer must re-enter the loop as an ordinary `trainer_word` (`meta.weave=1`, dedupe `weave_word:<trainer>:<email>:<day>`) so replies/echo/pulse keep working untouched.
- Org admins get one sentence in the monthly letter (`pulse.thread_ar`, `manual` excluded, k ≥ 5) — never the weave itself.

## Signed documents pattern (P52 letter · P58 snapshot)
Code `ATH-XX-XXXX-XXXX` (alphabet without 0/1/I/O) + `sha256(jcs(body))` + `/verify/<kind>?code=` page that never shows private content unless the owner made it public. One live document per period (partial unique index `… where revoked_at is null`); re‑sign revokes the previous; revoked → the verify page says «أُبطلت». Do **not** reach for `lib/portal/vc.ts` unless a third party needs a W3C VC.

## Service clients in GET routes
Use a `noStore` fetch (`global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) }`) for any route that must read freshly updated rows (public/revoked flags); Next 14 may cache identical upstream GETs otherwise.

## Tests
- Unit: one `tests/pNN-*.test.ts` with a fake db (`from(table)` builder supporting `select/eq/neq/is/in/gte/lt/or/not/order/limit/maybeSingle/single/insert/upsert/update/delete/then`) — upsert must return the stored row with `id`, else `pushNotice` reports `duplicate`.
- E2E: `tools/shot-pNN.py` — API first, then browser (desktop + mobile ≤ 392 px scrollWidth + `pageerror` empty). Wait on DOM state, not fixed timeouts (API POSTs that rebuild a journey take ~2 s).
