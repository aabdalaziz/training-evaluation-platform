name: athar-dialogue
description: How to extend the Athar human dialogue loop (P51–P58 — «دفتر اليوم», «رسالة الشهر», «ردّ على الكلمة», «أمانة صوتية», «كلمة صوتية», «صدى الأسبوع», «نبض الجهة», «خريطة أثرك») without breaking its rules — nothing enters evaluation, k ≥ 5 for any aggregate, no names outside the owner's own screen, voice is private/temporary, no server AI, no new cron/env/deps.
Athar — the dialogue loop (P51–P58)
Read docs/ATHAR-DIALOGUE-LOOP-P51-P57-AR.txt first; this skill is the operational checklist.

The loop in one line
Trainer writes/speaks a «كلمة» (P51/P55) → learner answers with a touch/line/voice «أمانة» (P53/P54) → learner gets a weekly 🪞 «صدى» (P56) → the organization gets a monthly «رسالة الشهر» with an aggregated «نبض» (P52/P57) → the learner weaves their own «خيوط» into «خريطة أثرك» (P58).

Non‑negotiable rules (every new piece must honour all of them)
Nothing enters evaluation. No column read by lib/portal/skills.ts, lib/journey/registry.ts scoring, مِعيار, or credentials may be written by the loop. Say so in the UI footer and in the release doc.
k ≥ 5 for anything shown to an organization or the public (K_ORG = 5 in lib/org-impact/registry.ts). Below k: show the privacy mirror sentence, never a number.
No names outside the author's own screen: «مدرّبك», «زميل», «جلسة». Public faces hide sensitive titles (daily cases → topic via topicOf).
Voice = private bucket athar-media, path word-voice/<trainer_id>/…, signed temporary URLs, 180‑day purge in the existing media cleanup, limits TRAINER_VOICE_LIMITS (20 s) / VOICE_LIMITS (15 s · 10/h). Browser dictation (Web Speech) is allowed for text fields; never store new audio without a human listener on the other side.
No server AI in the loop. Rules must be explicit and visible to the user («حدث ثم حدث خلال N يومًا»).
Dedupe + ≤ 1/day for every notice kind (dedupe_key on portal_learner_notices); reuse the daily cron /api/followups/send — never add a Vercel cron.
Delete is immediate (no recycle bin); «declined» choices are never re‑proposed.
Zero new env, zero deps, one SQL first (with expected diagnostic counts), .txt twin for every .md.
Where things live
Pure cores (unit‑testable, no DB): lib/portal/day.ts, lib/portal/word-reply.ts, lib/portal/week-echo.ts, lib/org-impact/{letter,pulse}.ts, lib/map/registry.ts.
Glue (DB, auth, storage): lib/map/store.ts, lib/map/nudge.ts, routes under app/api/me/*, app/api/org/*, app/api/admin/org/*, app/api/verify/*.
UI: app/components/{VoiceRecorder,EchoSay,LetterSheet,AtharMapSvg}.tsx; learner pages under app/me/* load heavy desks with next/dynamic({ ssr:false }).
Notice kinds: extend NoticeKind, KIND_AR, KIND_ICON in lib/portal/notices.ts together.
New routes → lib/portal/way.ts; new tables → lib/vault/registry.ts; voice aliases → lib/portal/voice.ts.
Signed documents pattern (P52 letter · P58 snapshot)
Code ATH-XX-XXXX-XXXX (alphabet without 0/1/I/O) + sha256(jcs(body)) + /verify/<kind>?code= page that never shows private content unless the owner made it public. One live document per period (partial unique index … where revoked_at is null); re‑sign revokes the previous; revoked → the verify page says «أُبطلت». Do not reach for lib/portal/vc.ts unless a third party needs a W3C VC.

Service clients in GET routes
Use a noStore fetch (global: { fetch: (i, init) => fetch(i, { ...init, cache: 'no-store' }) }) for any route that must read freshly updated rows (public/revoked flags); Next 14 may cache identical upstream GETs otherwise.

Tests
Unit: one tests/pNN-*.test.ts with a fake db (from(table) builder supporting select/eq/neq/is/in/gte/lt/or/not/order/limit/maybeSingle/single/insert/upsert/update/delete/then) — upsert must return the stored row with id, else pushNotice reports duplicate.
E2E: tools/shot-pNN.py — API first, then browser (desktop + mobile ≤ 392 px scrollWidth + pageerror empty). Wait on DOM state, not fixed timeouts (API POSTs that rebuild a journey take ~2 s).
