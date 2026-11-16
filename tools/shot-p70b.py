# E2E P70-ب «رجع الصدى» — API + واجهات: أستاذ المقرّر (admin u1 = t1) يفتح «الممرّ» لمحاضرة اليوم في المستوى 2 من p70x → يرى صدى المستوى 1 لشعبة AR-1
#  (5 ختموا · 6 كتبوا · معوّقات · التزامات · «عبروا» بكلماتهم) → يكتب «كلمة العبور» → ريم (u5) تراها في «سطري» تحت كلمتها التي تعبر → تردّ 🌱 → الأستاذ يرى الوصول
#  بذرة المحاكي: جلسة 0070d1 (اليوم · t1 · c70x · المقرّر 3 المستوى 2) · زملاء u81..u85 سطور learn/apply/commit عبر المستوى 1 + صفحات مختومة 9601–9605
import sys, json, urllib.request, urllib.error, urllib.parse, os, time, datetime, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p70b'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
def api(path, body=None, tok='tok', ip=None, method=None):
    h = {'Content-Type': 'application/json', 'X-Forwarded-For': ip or f'10.{R}.71.2'}
    if tok: h['Authorization'] = f'Bearer {tok}'
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(B + path, data=data, method=method or ('POST' if data is not None else 'GET'), headers=h)
    try:
        r = urllib.request.urlopen(req); rb = r.read(); return r.status, (json.loads(rb) if rb else {})
    except urllib.error.HTTPError as e:
        rb = e.read() or b''
        try: return e.code, json.loads(rb or b'{}')
        except Exception: return e.code, {}
reset(); time.sleep(31)
SES = '00000000-0000-4000-8000-0000000070d1'; RM = 'tok-u5'; KH = 'tok-u3'
WORD = 'أهلًا بكم في المستوى الثاني — قرأتُ صداكم بلا أسماء: الوقت ضيّق، نعم، لكن الحرف صار يُسمع. نبدأ من هناك.'
# ---- 1) الممرّ يحمل الصدى (أستاذ المحاضرة)
st, c = api(f'/api/diploma?corridor={SES}'); raw = json.dumps(c, ensure_ascii=False); co = c.get('corridor') or {}; e = co.get('echo') or {}
check('corridor 200 · classroom c70x · program p70x · echo present (phase week · prev 1 · level 2 · shown)', st == 200 and co.get('classroom_id') == 'c70x' and co.get('program_id') == 'p70x' and e.get('phase') == 'week' and e.get('prev_level_no') == 1 and e.get('level_no') == 2 and e.get('shown') is True)
check('echo: title «رجع الصدى — المستوى 1» · sealed «5 من 6» · people 6 · roster 6 · can_write true · word null', e.get('title_ar') == '🔁 رجع الصدى — المستوى 1' and e.get('sealed_ar') == 'ختم صفحةَ مستواهم 5 من 6.' and e.get('people') == 6 and e.get('roster') == 6 and e.get('can_write') is True and e.get('word') is None)
check('echo: 3 lines · lines_ar «6 من 6» · blockers 2 (people 6) · commits «أوفوا بـ 4 من 7» · crossed from sealed bodies (A1 → A2 · 4 of 5) · no reem/زميل names · no %', len(e.get('lines') or []) == 3 and '6 من 6' in str(e.get('lines_ar')) and len(e.get('blockers') or []) == 2 and e.get('blockers_ar') == 'أكثر ما عاقهم في التطبيق (6):' and e.get('commits_ar') == 'التزاماتهم: أوفوا بـ 4 من 7.' and 'عبورهم بكلماتهم' in str(e.get('crossed_ar')) and 'A1 — وأعبره اليوم إلى ما بعد A2' in str(e.get('crossed_ar')) and 'كتب 4 منهم' in str(e.get('crossed_ar')) and 'ريم' not in raw and 'زميل' not in raw and 'ar1@' not in raw and '%' not in raw)
check('lines are from level-1 span only (reem D-50 line excluded · her level-2 lines not yet)', 'خارج النافذة' not in raw)
st, _ = api(f'/api/diploma?corridor={SES}', tok=RM); check('learner → 403', st == 403)
st, k = api(f'/api/diploma?corridor={SES}', tok=KH); check('staff viewer (khalid) → 200 · echo visible · can_write false', st == 200 and (k.get('corridor') or {}).get('echo', {}).get('can_write') is False)
st, c66 = api('/api/diploma?corridor=00000000-0000-4000-8000-0000000066d1'); check('P66-ب corridor (level 1 program) → echo null · unchanged', st == 200 and c66['corridor'].get('echo') is None and c66['corridor'].get('title_ar'))
# ---- 2) كلمة العبور
st, w = api('/api/me/day', {'action': 'word', 'classroom_id': 'c70x', 'mode': 'all', 'text': WORD, 'echo': 2})
check('POST word echo=2 → sent 6 (reem + 5)', st == 200 and w.get('sent') == 6 and w.get('recipients') == 6)
ns = rest('portal_learner_notices?kind=eq.trainer_word&dedupe_key=like.echo_word:c70x:2:%25')
check('6 notices · dedupe echo_word:c70x:2:t1:<email> · title «كلمة العبور من أستاذك د. أحمد الحربي — المستوى 2» · url /me/line · meta.echo 2', len(ns) == 6 and all(n['dedupe_key'].startswith('echo_word:c70x:2:t1:') for n in ns) and ns[0]['title_ar'] == '🔁 كلمة العبور من أستاذك د. أحمد الحربي — المستوى 2' and ns[0]['url'] == '/me/line' and all((n.get('meta') or {}).get('echo') == 2 for n in ns))
st, w2 = api('/api/me/day', {'action': 'word', 'classroom_id': 'c70x', 'mode': 'all', 'text': WORD + ' (معدَّلة)', 'echo': 2})
ns2 = rest('portal_learner_notices?kind=eq.trainer_word&dedupe_key=like.echo_word:c70x:2:%25')
check('re-send replaces (still 6 rows · new text)', st == 200 and len(ns2) == 6 and all('(معدَّلة)' in n['body_ar'] for n in ns2))
st, c2 = api(f'/api/diploma?corridor={SES}'); e2 = c2['corridor']['echo']
check('echo after word: word.sent 6 · replies 0 · text present', e2['word'] and e2['word']['sent'] == 6 and e2['word']['reach']['replies'] == 0 and '(معدَّلة)' in e2['word']['text_ar'])
st, w3 = api('/api/me/day', {'action': 'word', 'classroom_id': 'c70x', 'mode': 'one', 'email': 'reem@example.com', 'text': 'كلمة فردية', 'echo': 2})
check('echo ignored unless mode=all (one → ordinary trainer_word)', st == 200 and len(rest('portal_learner_notices?kind=eq.trainer_word&dedupe_key=like.echo_word:c70x:2:%25')) == 6 and len(rest('portal_learner_notices?dedupe_key=like.trainer_word:t1:reem%25')) == 1)
# ---- 3) ريم في «سطري»
st, le = api('/api/me/level?echo=1', tok=RM)
check('learner echo view: own echo (level 1 line? none — not sealed) · word present (notice id · level 2 · text) · open nudge (level 1 page still open)', st == 200 and le.get('word') and le['word']['level_no'] == 2 and '(معدَّلة)' in le['word']['text_ar'] and le['word']['notice_id'] and le.get('open') and le['open']['level_no'] == 1 and le['open']['href'].startswith('/me/level?level=en-p70x-u5'))
nid = le['word']['notice_id']
st, rp = api('/api/notices', {'action': 'word_reply', 'notice_id': nid, 'chip': 'got_it'}, tok=RM); check('reem replies 🌱 via P53 → 200', st == 200 and rp.get('success'))
st, c3 = api(f'/api/diploma?corridor={SES}'); e3 = c3['corridor']['echo']
check('instructor sees reach: replies 1 · 🌱 1', e3['word']['reach']['replies'] == 1 and e3['word']['reach']['chips'].get('🌱') == 1)
st, kk = api('/api/me/level?echo=1', tok=KH); check('khalid (other program) → no word · no open', st == 200 and kk.get('word') is None and kk.get('open') is None)
# ---- 4) الاعتماد
st, ac = api('/api/accreditation?program=p70x'); acr = json.dumps(ac, ensure_ascii=False)
check('accreditation evidence has level:pages (kind level · 3.5 · n 5)', st == 200 and '"level:pages"' in acr and 'عبروا بكلماتهم' in acr and 'بأيديهم 5' in acr)
# ---- 5) المتصفّح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar'); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda x: errs.append(str(x)))
    login(pg, 'admin@upm.edu.sa')
    pg.goto(B + '/me/day', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="dy-corridor"]', timeout=60000)
    btns = pg.locator('[data-testid="dy-corridor"]'); n = btns.count(); opened = False
    for i in range(n):
        btns.nth(i).click(); pg.wait_for_selector('[data-testid="dy-corridor-card"]', timeout=20000); pg.wait_for_timeout(400)
        if pg.locator('[data-testid="dy-lvecho"]').count(): opened = True; break
        btns.nth(i).click(); pg.wait_for_timeout(300)
    check('browser: a corridor card carries the echo layer', opened)
    echo = pg.locator('[data-testid="dy-lvecho"]'); txt = echo.inner_text() if opened else ''
    check('echo layer: data-level 1 · phase week · sealed · lines · blockers · commits · crossed · reach line (word sent) · write button', opened and echo.get_attribute('data-level') == '1' and echo.get_attribute('data-phase') == 'week' and pg.locator('[data-testid="dy-lvecho-sealed"]').count() == 1 and pg.locator('[data-testid="dy-lvecho-lines"] li').count() == 3 and pg.locator('[data-testid="dy-lvecho-blockers"] li').count() == 2 and pg.locator('[data-testid="dy-lvecho-commits"]').count() == 1 and pg.locator('[data-testid="dy-lvecho-crossed"]').count() == 1 and pg.locator('[data-testid="dy-lvecho-reach"]').count() == 1 and pg.locator('[data-testid="dy-lvecho-word"]').count() == 1)
    check('echo text: رجع الصدى · 5 من 6 · وصلت كلمة العبور إلى 6 · 🌱 1 · no names · no %', 'رجع الصدى' in txt and '5 من 6' in txt and 'وصلت كلمة العبور إلى 6' in txt and '🌱 1' in txt and 'ريم' not in txt and 'زميل' not in txt and '%' not in txt)
    pg.screenshot(path=f'{OUT}/01-day-echo.png', full_page=True)
    pg.locator('[data-testid="dy-lvecho-word"]').evaluate('e => e.click()'); pg.wait_for_selector('[data-testid="dy-lvecho-on"]', timeout=20000)
    check('write button opens word form with echo flag (level 2)', pg.locator('[data-testid="dy-lvecho-on"]').get_attribute('data-level') == '2')
    pg.fill('[data-testid="dy-word-text"]', 'كلمة عبور من المتصفّح'); pg.once('dialog', lambda d: d.accept()); pg.locator('[data-testid="dy-word-send"]').click()
    pg.wait_for_timeout(2500)
    ns3 = rest('portal_learner_notices?kind=eq.trainer_word&dedupe_key=like.echo_word:c70x:2:%25')
    check('UI send → 6 echo notices replaced with browser text', len(ns3) == 6 and all(n['body_ar'] == 'كلمة عبور من المتصفّح' for n in ns3))
    pg.screenshot(path=f'{OUT}/02-day-after-word.png', full_page=True)
    check('no page errors (instructor)', not errs)
    # ريم
    pg2 = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar').new_page(); e2s = []; pg2.on('pageerror', lambda x: e2s.append(str(x)))
    login(pg2, 'reem@example.com'); pg2.goto(B + '/me/line', wait_until='domcontentloaded'); pg2.wait_for_selector('[data-testid="ln-echo-word"]', timeout=60000); pg2.wait_for_timeout(400)
    w = pg2.locator('[data-testid="ln-echo-word"]'); wt = w.inner_text()
    check('reem «سطري»: word box level 2 · title with instructor name · browser text · replied state (her 🌱 earlier is per notice — new notice id? chips visible or replied)', w.get_attribute('data-level') == '2' and 'كلمة العبور من أستاذك' in wt and 'كلمة عبور من المتصفّح' in wt)
    check('open-page nudge visible (level 1 page still open)', pg2.locator('[data-testid="ln-level-open"]').count() == 1 and pg2.locator('[data-testid="ln-level-open"]').get_attribute('data-level') == '1')
    if pg2.locator('[data-testid="ln-echo-chip-will_attend"]').count():
        pg2.locator('[data-testid="ln-echo-chip-will_attend"]').click(); pg2.wait_for_selector('[data-testid="ln-echo-replied"]', timeout=20000)
        check('reply chip 🕐 from «سطري» → replied state', '🕐' in pg2.locator('[data-testid="ln-echo-replied"]').inner_text())
    else: check('chips hidden only when already replied', False)
    pg2.screenshot(path=f'{OUT}/03-line-word.png', full_page=True)
    check('no page errors (reem)', not e2s)
    # جوّال
    pm = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True).new_page(); login(pm, 'reem@example.com'); pm.goto(B + '/me/line', wait_until='domcontentloaded'); pm.wait_for_selector('[data-testid="ln-echo-word"]', timeout=60000)
    check('mobile ≤ 392 no horizontal scroll', pm.evaluate('document.documentElement.scrollWidth') <= 392); pm.screenshot(path=f'{OUT}/04-line-mobile.png', full_page=True)
    br.close()
# ---- 6) صدى الصدى بعد ردّ ثانٍ
st, c4 = api(f'/api/diploma?corridor={SES}'); e4 = c4['corridor']['echo']
check('instructor reach after reem 🕐 (same notice row replaced → her reply row persists per notice id): replies ≥ 1', e4['word']['reach']['replies'] >= 1)
fails = [n for n, c in ok if not c]; print(f'\n{len(ok) - len(fails)}/{len(ok)} PASS'); print('FAILS:', fails) if fails else None; sys.exit(1 if fails else 0)
