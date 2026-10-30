---
name: athar-product
description: Design a new Athar phase the owner will approve — the product principles behind P10–P27 (AI assists / human approves, k≥5, own words, selective disclosure, signed and revocable, compare with self, text/voice/video, no dashboards). Use before writing any proposal, naming any feature, or deciding what an agent/AI/organization may see. Includes the vocabulary and a pre-proposal checklist.
---

# Athar — designing a phase that is not «تقليدي»

The owner (د. أحمد بدوي) explicitly rejected incremental, dashboard-style features ("more reports, tables, foresight grids"). Approved phases share one shape: **a human experience with a few clear movements, honest limits, and a signed artifact the person controls.** Use this before any proposal.

## 1. The eight principles (owner-approved, cumulative since P10)
1. **AI assists, a human approves.** Computed level ≠ approved level. Supervisors confirm missions, org admins approve peer attestations, staff approve councils. AI text is labelled (`source: 'ai' | 'local'`), editable, and never stored as fact without a click.
2. **No identifiers to models.** Anonymize («عضو 1/2…») or pass only the user's own words; declare it in `privacy.json`.
3. **k ≥ 5, never lowered.** Any aggregate shown to someone else needs ≥ 5 people (and ≥ 2 organizations for council/observatory data). Below quorum → say so («لم يكتمل النصاب بعد») instead of showing numbers.
4. **Compare only with self.** Mirrors compare the same person/organization with their previous cycle/quarter. No rankings, no "better than".
5. **Private by default, selective disclosure, revocable.** The person chooses what is shown (chapters, name mode, quotes). Anything shared is an Ed25519 OpenBadge in `portal_vc_issuances` (`ATH-XX-XXXX-XXXX`), verifiable at `/verify/vc?code=`, with an expiry and a one-click revoke that also kills the public URL.
6. **Own words only.** Quotes attributed to a person come from their own text (daily-case answers, commitments, returns, notes). A peer's or AI's words are never attributed to them.
7. **Derived from events, not self-asserted.** Chapters, badges, echoes and paths are computed from recorded events (`portal_learning_events`, confirmed missions, approved levels…). Users write *what changed in them*, not *what they achieved*. No progress bars, no percentages, no «mark done» (P27 «الدرب»).
8. **Every input is text, voice or video** via the single `Channel` component; every output that matters can be read aloud (`ReadAloud`).

## 2. Shape of an approved phase (copy this structure in the proposal)
- **One sentence** the owner can repeat («الجهة لا تدفع للمقعد؛ تدفع للعودة» · «ليست سجلًّا ولا تقريرًا»).
- **Five movements** (P23: case → deliberation → commitment → return → attestation; P25: chapters → my note → shared version → verify → letter to myself; P26: org chapters k≥5 → «ما تغيّر فينا» → yearbook → shelf → org letter to itself; P27: horizon «أنا في 2036» → three one-year steps → pledge → path from events → annual review «ما وعدتُ / ما وقع»).
- **A time element**: cycles (6 weeks), windows (28 d echo, 90 d mirror, 30 d review), expiry (12 months), delay (365-day capsule/review), one gentle mid-way nudge (day 182, in-app/push only). Time runs inside the existing daily cron.
- **A signed artifact** with its own code prefix: `ATH-IC` contracts · `ATH-OC` org charter · `ATH-CB` council badge · `ATH-J` journey · `ATH-OY` org yearbook · `ATH-HZ` horizon pledge.
- **What the agent may do**: one read-only MCP tool (`my_*`) with a `pscope`; writing/publishing stays with the person (`council_commit` is the only agent write, and it requires explicit confirmation).
- **What the organization may see**: aggregates (k≥5), its own mirror, charters it signed — never its people's content.
- **Honest empty states**: «الصفحة الأولى بيضاء», «لم يكتمل النصاب», «ما لم يُكشف ليس غيابًا», «ما لم يُراجَع ليس فشلًا».
- **A gate that must be earned, not bought**: the horizon opens only after 3 real chapters; the three steps are only actions the platform can witness. A feature that can be «completed» by typing is not an Athar feature.
- **Something that stays absolutely private**: P27's scenario is never in the VC, the verify page, the agent summary or any org view — only its character count leaves the owner's account. Decide the private core in the proposal.
- **Vault row** for every personal table (delete vs anonymize decided in the proposal).
- **Zero**: new npm deps, new cron, new env, new tables for things derivable from events.

## 3. Vocabulary (use the official term in admin/contracts, the narrative term on the homepage / 2062 / أثير)
الذاكرة الحية · خيط الأثر · المكتب الزجاجي · محفظة القدرة السيادية · مرصد أَثَر · أَثَر في الجيب · سفارة أَثَر · مؤشر الأداء (not طقس) · درع أَثَر · خزنة أَثَر · مجالس أَثَر (المجلس · الميثاق · الكرسي · القضية · المداولة · الالتزام · العودة · المُوفِّق · كاتب المجلس · مرآة المجلس · خريطة الحكمة) · أثر الجهة (صدى الجهة · إحاطة 90 ثانية · مرآة الجهة · دفعة العودة · ميثاق الجهة · مقاعد الجهة · توأمة المجالس) · رحلة الممارس (رحلتي · الفصل · الحقبة · ما الذي تغيّر فيّ · نسخة للمشاركة · رسالة إلى نفسي بعد سنة · أين كنت / أين صرت) · رحلة الجهة (الفصل الجماعي · فصول تقترب · ما تغيّر فينا · مرآة السنة · كتاب السنة · رفّ كتب السنة · رسالة الجهة إلى نفسها · الفصل المشترك) · أفق الممارس (official: أفق الممارس · عهد الأفق · المراجعة السنوية — narrative: رسالتي من 2036 · أنا في 2036 · ثلاث خطوات لسنة · عهد مع نفسي · أين أنا من عهدي · ما وعدتُ / ما وقع · ما تغيّر · عهود مع النفس) · هندسة البرامج التدريبية (not مصنع) · الميسِّر (not الطيار المساعد) · كل يوم مهارة (situation → own handling → performance mirror; never MCQ).

## 4. Pre-proposal checklist (all must be "yes")
- [ ] Could a person explain it to a colleague in one sentence without the word "dashboard"?
- [ ] Does every number shown to a third party pass k≥5 / ≥2 orgs, or is the below-quorum state designed?
- [ ] Is every quote the person's own words?
- [ ] Is there a human approval step wherever AI or computation produces a claim about a person?
- [ ] Is the shared artifact signed, time-limited and revocable — and is "not disclosed ≠ absent" stated?
- [ ] Does the agent get at most one read-only tool? Does the organization see only aggregates/its own mirror?
- [ ] Does time live inside `/api/followups/send`? No new env/cron/deps?
- [ ] Are the official and narrative names both chosen and placed on the right surfaces?
- [ ] Did you list "ideas that emerged" — the owner asks for them every phase?

## 5. Candidates already discussed with the owner
- ~~Collective journey~~ — shipped as P26 «رحلة الجهة». ~~Letter from 2036~~ — shipped as P27 «أفق الممارس».
- **«عهدان متقابلان»**: two practitioners (same council or same org) each pledge one step *to the other*; one signed document with two holders, the path witnesses both, the annual review is read together. Almost no new tables (a `pair_id` on pledges).
- **«أفق الجهة»**: the org admin writes the organization's ten-year horizon (private to the org), chooses one org-level step for a year (a council on a topic · N confirmed missions · a yearbook), and the org journey gains a «عهد الجهة» chapter; member pledges stay a k≥5 count.
- **`/2062` horizon thread**: opt-in anonymized fragments of horizons (own words, k≥5, no names) as a living «what practitioners see in 2036» on the futures page.
- **«ليلة الكتاب»**: when an org issues its yearbook, a short live room where members read the chapters together (reuses P6/P13-ج live infra).
- **«رفّ القطاع»**: once ≥5 orgs in one sector publish yearbooks, an anonymous homepage thread «ما تعلّمه القطاع هذه السنة» (same k rule).
- **«الفصل القادم»**: from «فصول تقترب», the facilitator proposes one step (council seats · a mission) that would complete the quorum — org admin decides.
- **Operations pause**: Resend domain + `REPORTS_FROM_EMAIL`, WhatsApp decision (direct Meta vs BSP), SDAIA registration, CSP enforce — requires owner decisions, not code first.
