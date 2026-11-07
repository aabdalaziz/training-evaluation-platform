---
name: athar-dialogue
description: How to extend the Athar human dialogue loop (P51–P62 — «دفتر اليوم», «رسالة الشهر», «ردّ على الكلمة», «أمانة صوتية», «كلمة صوتية», «صدى الأسبوع», «نبض الجهة», «خريطة أثرك», «نسيج الشعبة», «لأن… بصوتك», «نسيج البرنامج», «رسالة إلى نفسي بعد سنة») without breaking its rules — nothing enters evaluation, k ≥ 5 for any aggregate, no names outside the owner's own screen, voice is private/temporary, no server AI, no new cron/env/deps.
---

# Athar — the dialogue loop (P51–P62)

Read `docs/ATHAR-DIALOGUE-LOOP-P51-P62-AR.txt` (and the data-travel matrix `docs/diagrams/athar-dialogue-travel-matrix.svg`) first; this skill is the operational checklist.

## The loop in one line
Trainer writes/speaks a «كلمة» (P51/P55) → learner answers with a touch/line/voice «أمانة» (P53/P54) → learner gets a weekly 🪞 «صدى» (P56) → the organization gets a monthly «رسالة الشهر» with an aggregated «نبض» (P52/P57) → the learner weaves their own «خيوط» into «خريطة أثرك» (P58) → the trainer reads what the section wove together in «نسيج الشعبة» and answers with a 🧶 word on it (P59) — which is again a «كلمة», so the loop closes on itself. The learner can also speak each «لأن…» (P60) — voice stays with its owner only. At program level the kept threads become **counted** evidence in the living accreditation file «نسيج البرنامج» (P61) — never quoted.

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
- Pure cores (unit‑testable, no DB): `lib/portal/day.ts`, `lib/portal/word-reply.ts`, `lib/portal/week-echo.ts`, `lib/org-impact/{letter,pulse}.ts`, `lib/map/registry.ts`, `lib/map/weave.ts` (section aggregation: `weave` · `groupKey` · `orgStrongestThread` · `peersOf`), `lib/map/program-weave.ts` (program aggregation: `programWeave` · `weaveEvidence` · `programPeersOf`).
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

## Voice that never travels (P60 pattern)
- Voice is identity: a learner's recorded «لأن…» is stored in the private bucket under `map-voice/<user_id>/<row_id>.<ext>` and exposed to the owner only (signed URL, 5 min). It never enters the weave, the letter, the snapshot or `/verify/*` — only a count line («N من خيوطك بصوتك»). Guard this with a raw-JSON test (`!/map-voice|note_voice|"voice"/`).
- One file per row; re-record replaces and removes the old object; `decline`/`remove` of the row removes the object too. Client payloads carry `{sec, at}` only — never the path.
- Keep browser-side libs light: a file imported by a client component must not import server chains (`word-reply` → `practice` → …). Duplicate the few constants and pin them with a unit test against the server source of truth.

## Counting without quoting (P61 pattern — program-level aggregates)
- Scope of consent is literal: «شارك كلمتي مع مدرّبي» authorises the trainer's weave only. Any other reader (accreditation file, ETEC reviewer, public strip) gets **counts only** — `lib/map/program-weave.ts` never reads `note_ar`/`note_voice`, and the raw-JSON test asserts no email, no note, no voice path.
- A thread belongs to a program when one end is one of its stations (`scopeKeys`: `program:<pid>` · `session:<id>` from `attendance_sessions`/`portal_sessions` · `mission:<id>`); `manual` is excluded; rows are deduped per (learner, from, to). Learners are the program's enrollments (`approved|placed|active|completed`), cohort = year of `placed_at || created_at`.
- Evidence attaches itself (`weaveEvidence` → `kind: 'weave'`, `href: '#weave'`) under ETEC sub-standards per rule (`WEAVE_EVIDENCE_CODES`) and only at n ≥ k; «graduates still weaving» = roster learners who decided any non-manual thread after `programs.end_date` → 3.5. It flows through `collectEvidence`, so coverage, freeze (`weave_ar`/`weave_n` in the snapshot body), `/verify`, the public strip and `/admin/accreditation` all see it without extra plumbing.
- Transparency back to the learner: `/api/me/map` returns `program_peers` («خيطك جزء من نسيج برنامج … — نسجه معك N») computed from counts on the program key excluding the learner; a silent aggregate is not an honest one.
- Cache only the heavy part (10 min per program, `fresh` bypass); never store the weave in the DB.

## Second edition, not a second table (P62 pattern — «رسالة إلى نفسي بعد سنة»)
- Before adding a feature, grep for its ancestor: the P25 time capsule (`portal_time_capsules`, `/api/journey`, `runJourney`) already held «رسالة إلى نفسي بعد سنة». P62 extends that table with `ALTER … ADD COLUMN IF NOT EXISTS` (horizon · opened_at · opened_early · reply_ar · chain_of · prompt_key · context_key · program_id · scope) and backfills `context_key='journey'`; old capsules appear in the new desk untouched.
- The sealed body never leaves the server: `toPublicLetter` strips `body_ar`/`media_id` until `opened_at` is set; the E2E asserts the seeded sealed text is absent from the raw GET JSON. Early opening is allowed but honest — `opened_early=true` + `early_days`, shown as «فُتحت قبل أوانها».
- Opening hour = writing hour (Riyadh): `deliverAt(written, horizon, programEnd)` adds days or takes `programs.end_date` at the same HH:MM:SS; `grad` falls back to the nearest **future** end_date only, and must be ≥ tomorrow.
- Mirror «ما حدث فعلًا» = counts only from the learner's own rows (chapters · skill levels · credentials · councils · letters) — no percentages, no verdicts, no AI. `snapshot_now` is stored at opening so the mirror never drifts.
- Voice capsules: `portal_media.expires_at` (+180 d) + `media_cleanup` would delete audio before a 1‑year letter opens → `keepMedia` pushes `expires_at = deliver_at + 400 d` and tags `context_type='self_letter'`. Any future deferred feature with media must do the same.
- Cohort envelope «رسالة الدفعة»: one line per graduate per program (`scope='cohort'`, unique partial index), 10–160 chars, no email, opens 1 year after `end_date` at 09:00 Riyadh and only at n ≥ 5 (deterministic shuffle, no names). Writers can delete their own line until the envelope opens.
- Cron key `self_letters` (after `org_letters`) only pushes the notice on the opening day (`todayNoticeText`, dedupe `self_letter:<id>`); it never opens the letter for the learner — the learner opens it.
- Limits are part of the design: ≤ 3 sealed letters, delete is immediate (text + media), `rateLimit('letter:<uid>', 3600, 20)`, audit kind `self_letter`.

## Signed documents pattern (P52 letter · P58 snapshot)
Code `ATH-XX-XXXX-XXXX` (alphabet without 0/1/I/O) + `sha256(jcs(body))` + `/verify/<kind>?code=` page that never shows private content unless the owner made it public. One live document per period (partial unique index `… where revoked_at is null`); re‑sign revokes the previous; revoked → the verify page says «أُبطلت». Do **not** reach for `lib/portal/vc.ts` unless a third party needs a W3C VC.

## Service clients in GET routes
Use a `noStore` fetch (`global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) }`) for any route that must read freshly updated rows (public/revoked flags); Next 14 may cache identical upstream GETs otherwise.

## Tests
- Unit: one `tests/pNN-*.test.ts` with a fake db (`from(table)` builder supporting `select/eq/neq/is/in/gte/lt/or/not/order/limit/maybeSingle/single/insert/upsert/update/delete/then`) — upsert must return the stored row with `id`, else `pushNotice` reports `duplicate`.
- E2E: `tools/shot-pNN.py` — API first, then browser (desktop + mobile ≤ 392 px scrollWidth + `pageerror` empty). Wait on DOM state, not fixed timeouts (API POSTs that rebuild a journey take ~2 s).
