---
name: athar-iqra
description: Author, voice and ship content for «اقْرَأْ — من أَثَر» (Iqra, `/iqra`, `/admin/iqra`) — the self-paced Arabic course placed by مِعيار. Covers the pack format (منزلة → حلقة → بطاقات → تمارين), the fairness/skills lint, the «100 hours» contract, and the voice studio (edge-tts sprites with one Athar voice identity, full ضبط, speaker rules, no device voice). Use when adding a unit/level (A2, B1…), fixing a lesson, regenerating audio, or changing how voices are assigned. State after A1 batches 1–8 + voice rounds 1–7 (2026-11-17): 8 منازل · 40 حلقات · 16 library texts · 56/56 sprites live.
---

# Athar — Iqra content & voice (post-A1 pattern)

## Non-negotiables (owner decisions, do not reopen)
- Official spelling **«اقْرَأْ — من أَثَر»**; level names = friendly Arabic + CEFR code (تمهيدي Pre-A1 · مكتشف A1 · مبتدئ A2 · متوسط B1 · مستقل B2 · متقدّم C1 · متقن C2). «المستوى» (never «الرِّواق»). Learner UI Arabic only.
- Entry only with an approved مِعيار placement; paid service later (task 112) — content never gates on payment yet.
- Nothing in Iqra affects evaluation; aggregates k ≥ 5; no names; voice from the learner never leaves the device.
- **No browser/device speech anywhere** (`720603c`): a lesson has an official sprite or shows the badge «🎙 التسجيل الرسمي لهذه الحلقة قادم» (`data-voice='pending'`, zero `iq-say`/`iq-stage-play`). The owner heard a device voice once and judged it as ours.
- One Athar voice identity = مِعيار's narrator حامد (ar-SA-Hamed). Every named character has ONE fixed voice across all levels; two distinct real voices per dialogue speaker.
- Full author-written ضبط (every حرف, المدود, التشكيل, إعراب incl. tanwīn) for every spoken segment. Auto-diacritizers (CAMeL, mishkal) were tried and REJECTED.
- Rejected voices (owner's ear 2026-11-17): OM-Aysha, OM-Abdullah, SY-Amany, LB-Rami, SY-Laith, EG-Shakir → `voices.json.rejected`, test-enforced. Any new voice must pass the audition sentence first and be approved by the owner.

## Files
- Packs `tools/iqra/packs/iqra-pack-<LEVEL>-U0N.json` (`units[]`, `lessons[]` with `content{intro_ar, text{kind: dialogue|narrative, body}, grammar{examples}}`, `cards[] {word_ar, example_ar}`, `exercises[]` 9 kinds, 30 items/lesson over 3 visits of 10; `library[] {code, kind: read|listen, title_ar, body_ar}`); precheck `dashboard-redesign/tools/iqra-precheck.py`, smoke `iqra-pack-smoke.py`.
- Voice: `tools/iqra-tts.py` (studio), `tools/iqra/voices.json` (cast · aliases · authors · fallback · rejected · rates · role_avatars · female_markers), `tools/iqra/dabt/<code>.json` (full ضبط, key = exact `speakable_raw` output), `tools/iqra/tashkil.json` (small fallback lexicon only), `tools/iqra/tests/test_tts_rules.py` (offline rules, run after ANY tts.py change), outputs `public/iqra/audio/<code>.mp3` + `<code>.cues.json`.
- UI: `lib/iqra/voice.ts` (cues loader, `Sprite` over one `<audio>`), `app/iqra/IqraApp.tsx` (`Say`, `Stage` «مسرح الحلقة» + «◌ّ أَظْهِرِ التَّشْكِيل» + «العب الدور», cards «اسمع ثمّ أعد», library 2-play cap), tests `tests/iqra-voice.test.ts`, `tests/iqra-step2.test.ts`, browser smoke `dashboard-redesign/tools/iqra-voice-smoke.py`.
- Docs `docs/RELEASE-IQRA-*-AR.txt` (one per batch; voice rounds appended to `RELEASE-IQRA-VOICE-AR.txt`).

## Authoring a unit (content)
1. Same strategy per batch, creativity welcome: a recurring cast (ليلى، ماريا، يوسف، كين، أحمد، هند، سارة، نورة، فاطمة الجدّة، حسن الجدّ، عمر، ريم، سامي، فهد، أبو سعد…) living one story across units; realia texts (signs, forms, voicemails, receipts) as library texts.
2. Dialogue lines are `اسم: نصّ`; scene headers `(١ — مكان)`; stage notes in parentheses after the name `ليلى (٨:٣٠):`. Narrative texts may still contain `اسم: …` lines — they will be voiced by that character (see rules).
3. Every lesson delivers CEFR can-do + skills mapping; exercises varied across the 9 kinds; gender-fair (keep both genders — avoid over-swing); readable fonts already handled by the app.
4. First-person texts without a speaker prefix (letters, diaries, cards, guides) need an entry in `voices.json.authors` → `"A1-U0N-L0M": "ليلى"` or `{"start": "كين"|null, "at": {"رسالة كين": "كين", "ردّ أحمد": "أحمد"}}` for multi-author texts. Forgetting this = narrator reads a woman's letter (owner noticed).
5. Import via `/admin/iqra` → `validate` → `import` → approve each lesson/text. Approved lessons are skipped by importPack — «إرجاع إلى مسوَّدة» first to re-import.

## Voicing a unit (studio)
1. `python3 tools/iqra-tts.py --check` (edge-tts drops voices some days). `pip install edge-tts mutagen`, `apt-get install ffmpeg`, `export TMPDIR=/var/tmp`.
2. `python3 tools/iqra-tts.py <pack> --plan` → prints every unique raw segment lacking ضبط. Write `tools/iqra/dabt/<code>.json` (one JSON object, key = printed line verbatim). Conventions: «١)» → أَوَّلًا…; «[لافتة ١ ، …]» → اللَّافِتَةُ الْأُولَى، …:; arrows → إِلَى الْيَمِينِ/الْيَسَارِ/الْأَمَامِ; Latin codes/emails/wifi keys paraphrased; all digits, dates, phones, prices, ranges spelled out; stray « ، » dropped; «الله» = اللَّهُ; names مَارْيَا، كِينْ، نَيْجِيرْيَا، إِسْبَانْيَا، غَارْثِيَا، قُبَاءَ; «هههه» → هَهْ هَهْ. Re-run `--plan` until «بلا ضبط 0»; run `dabt_lint` (the test file shows how) until clean.
3. Generate in ONE `start_process bash -c` chain (≈2 min/sprite, sandbox RAM ~2 GB): `(python3 tools/iqra-tts.py <packs…> [--only CODE,…] --force --strict; echo TTS_EXIT=$?; echo TTS_DONE) > /tmp/ttsN.log 2>&1; sleep 100000`. `--strict` exits 2 on any segment without full ضبط.
4. Verify: cues count, `cue.d` present on every cue, `ffprobe` duration == `dur` (±0.05 s), speaker set per sprite (`{c.r}`) matches the story. Cut a 30–90 s sample with ffmpeg and present it — the owner judges by ear.
5. `next start` snapshots `public/` at build time → new sprites 404 locally until a rebuild; production (Vercel) serves them. Browser smoke needs a rebuild; for data-only batches the raw-cmp + live-URL poll is the gate.

## Speaker rules implemented in `iqra-tts.py` (keep tests green when touching them)
- `who(label)`: alias → cast name (longest match, word-bounded) → `_ROLE` (a role defined with a name earlier in the same text: «الموظّف فهد:» ⇒ later «الموظّف:» = فهد; «السائق (أبو محمد):» ⇒ «السائق:» = أبو محمد) → gender from `female_markers`/ta-marbuta → numbered fallback per text (`fallback.f/m` lists; numbered labels «النداء ١…٦» share one slot). `scene_reset()` per text.
- Dialogue texts: every `اسم:` line is voiced. Narrative texts: `اسم:` lines voiced only when the speaker is cast; a line that joins several cast speakers «كين: … — يوسف: …» (`split_speakers`) becomes ONE cue with several voiced parts (first speaker is the cue's `r`); non-cast multi-speaker lines → narrator.
- Library `read` texts: cast-named lines voiced unless multi-speaker; `listen` texts: any ≤3-word speaker label voiced; voicemail lines «الرسالة الأولى، اليوم في…: صباح الخير، أنا نورة…» → header by «الهاتف», body by the cast member named inside («أنا/هذه/معك + اسم»).
- `author_of`: numbered headers with ≤5 Arabic words or ending with «:» stay narrator; longer numbered steps (a guide) are the author's voice; `{start,at}` switches author at header prefixes.
- Rates per level: PRE_A1 −25 · A1 −20 · A2 −15 · B1 −5 · B2 0 · C1 +5 · C2 +10 %; «ببطء» is playbackRate 0.75 in the browser. Pausal form: `waqf()` ة → هْ, tanwīn dropped at pause.
- Cue schema `{k: intro|line|card|ex|gex|dict|pic, i?, r?, g?, a?, t?, s, e, d}`; `cast: 'athar-voices-1'`; mono 24 kHz 32 kbps, no Xing/ID3 (exact seeking).

## Shipping
- Zip whose root is the repo tree (`docs public tools …`), < 100 files per zip (count files, not dirs); audio ≈ 0.8 MB/sprite. Hidden `.agents` files are a separate single-file upload named exactly `SKILL.md`.
- Workspace cap ≈ 128 MB: after prod verification (raw cmp per file at head sha + live mp3 poll every 40 s ≈ 3 min), delete local mp3s of shipped units (keep `.cues.json`; keep one sprite for the browser smoke) and the shipped zip; note it in `dashboard-redesign/tools/LOCAL-DELETIONS-NOTE.txt`.
- Append the round to `docs/RELEASE-IQRA-VOICE-AR.txt` and `dashboard-redesign/BACKLOG-AR.txt`.

## Deferred (recorded, not approved)
«ظلّ الصوت» (local length comparison, no upload) · «صوت المعلّم» for the human facilitator · offline download of a unit's sprites (ق٢) · word-level highlight (edge-tts word boundaries) · Gemini tutor stays a disabled «قريبًا» slot (no key, no cost).
