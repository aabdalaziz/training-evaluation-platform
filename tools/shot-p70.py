# E2E P70 «بكلماتي عبر المستوى» — API + واجهات: ريم (u5) في دبلوم p70x: المستوى 1 انتهى أمس (النافذة مفتوحة) · المستوى 2 بدأ اليوم (أسبوع «الكلمة التي تعبر»)
#  بذرة المحاكي: p70x · c70x (AR-1) · سطورها (3 learn · 2 apply · 2 commit داخل النافذة + 1 خارجها) · تقرير «عُبور» B1 passed بنصّ كتابتها وصوت 95 ث · 5 زملاء ختموا (k=5)
#  يختبر: GET view (بطاقات من كلماتها فقط · لا درجة) · line/keep/public/seal/revoke/delete · التحقّق والوجه العام · الصدى في «سطري» · صفحة التخرّج تحمل سطور المستويات · الخزنة · الواجهة
import sys, json, urllib.request, urllib.error, urllib.parse, os, time, datetime, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p70'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
def api(path, body=None, tok='tok', ip=None, method=None):
    h = {'Content-Type': 'application/json', 'X-Forwarded-For': ip or f'10.{R}.70.2'}
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
A = '/api/me/level'; RM = 'tok-u5'; KH = 'tok-u3'; KEY = 'en-p70x-u5:1'
T = (datetime.datetime.utcnow() + datetime.timedelta(hours=3)).date(); D = lambda d: (T + datetime.timedelta(days=d)).isoformat()
LINE = 'صرتُ أسمع الحرف قبل أن أنطقه — وأُخطئ أمام طلابي عمدًا كي يتكلّموا'
# ---- 1) العرض
st, d = api(A, tok=RM); raw = json.dumps(d, ensure_ascii=False)
check('GET /api/me/level 200 · names «بكلماتي عبر المستوى» · levels ≥ 1 · view for level 1 open', st == 200 and d['names']['title'] == 'بكلماتي عبر المستوى' and len(d['levels']) >= 1 and d['view'] and d['view']['level']['level_no'] == 1 and d['view']['level']['phase'] == 'open')
v = d['view']; L = v['level']; keys = [c['key'] for c in v['cards']]
check(f'level item: key {KEY} · program p70x · window from D-40 to D-1 · next_from today · section_ar · is_first', L['key'] == KEY and L['program_id'] == 'p70x' and L['window']['from_day'] == D(-40) and L['window']['to_day'] == D(-1) and L['next_from'] == D(0) and L['is_first'])
check('cards: day_lines · apply_lines · commits · exam_writing · exam_speaking · crossed (no prev_line for level 1)', keys == ['day_lines', 'apply_lines', 'commits', 'exam_writing', 'exam_speaking', 'crossed'])
dl = next(c for c in v['cards'] if c['key'] == 'day_lines'); ap = next(c for c in v['cards'] if c['key'] == 'apply_lines'); cm = next(c for c in v['cards'] if c['key'] == 'commits'); ew = next(c for c in v['cards'] if c['key'] == 'exam_writing'); es = next(c for c in v['cards'] if c['key'] == 'exam_speaking'); cr = next(c for c in v['cards'] if c['key'] == 'crossed')
check('day_lines 3 inside window only (D-50 excluded) · «قبل أن أغادر» tag on unit line · apply 2 with blocker + week · commits 2 (yes ✓ + none)', len(dl['items']) == 3 and 'خارج النافذة' not in json.dumps(dl, ensure_ascii=False) and any(i.get('state_ar') == 'قبل أن أغادر' for i in dl['items']) and len(ap['items']) == 2 and 'وما عاقني: ضيق الوقت' in ap['items'][0]['text_ar'] and ap['items'][0]['state_ar'] == 'الأسبوع 2' and len(cm['items']) == 2 and cm['items'][0]['state_ar'] == 'أوفيتُ ✓' and 'صار عادة' in cm['items'][0]['text_ar'] and cm['items'][1]['state_ar'] == 'لم أُجب بعدُ')
check('exam_writing = her text (31 كلمة — كما كتبتُها، بلا درجة) · exam_speaking no text · voice_sec 95 · «لك وحدك» · crossed «دخلتُ … A2 — وأعبره … B1» state عبرتُ', ew['text_ar'].startswith('في صفّي نبدأ') and '31 كلمة' in ew['state_ar'] and es['text_ar'] is None and es['voice_sec'] == 95 and 'لك وحدك' in es['state_ar'] and 'A2' in cr['text_ar'] and 'B1' in cr['text_ar'] and cr['state_ar'] == 'عبرتُ')
check('counts: day_lines 3 · apply 2 · commits 2 · done 1 · training_days 29 · apply_weeks 2 · exam_voice true · section line k=5 · no score/percent anywhere', v['counts'] == {'day_lines': 3, 'apply_lines': 2, 'commits': 2, 'commits_done': 1, 'training_days': 29, 'apply_weeks': 2} and v['exam_voice'] is True and d['section_line_ar'] == '5 من شعبتك ختموا صفحة هذا المستوى' and 'score' not in raw and '%' not in raw and 'درجة' not in raw.replace('بلا درجة', '').replace('أو درجة', ''))
check('no other learner names/emails in payload', 'زميل' not in raw and 'ar1@' not in raw and 'khalid' not in raw)
st, k = api(A, tok=KH); check('khalid (no p70x enrollment, p66x level 1 still before) → levels [] · view null', st == 200 and k['levels'] == [] and k['view'] is None)
st, _ = api(A, tok=None); check('no token → 401', st == 401)
st, e = api(A, {'action': 'line', 'level': 'en-p66x-u3:1', 'line_ar': 'سطر لمستوى ليس مفتوحًا بعد'}, tok=KH); check('line on a level not open → 404', st == 404)
# ---- 2) السطر · keep · الختم
st, e = api(A, {'action': 'line', 'level': KEY, 'line_ar': 'قصير'}, tok=RM); check('short line → 400', st == 400)
st, e = api(A, {'action': 'line', 'level': KEY, 'line_ar': 'راسلوني reem@example.com لو أردتم'}, tok=RM); check('line with email → 400', st == 400)
st, r = api(A, {'action': 'line', 'level': KEY, 'line_ar': LINE}, tok=RM); check('line saved · view.line_ar · row in portal_level_pages (classroom c70x, level 1)', st == 200 and r['view']['line_ar'] == LINE and any(x['user_id'] == 'u5' and x['level_no'] == 1 and x['classroom_id'] == 'c70x' for x in rest('portal_level_pages?enrollment_id=eq.en-p70x-u5')))
st, r = api(A, {'action': 'keep', 'level': KEY, 'key': 'exam_speaking', 'on': False}, tok=RM); check('keep exam_speaking off', st == 200 and r['keep']['exam_speaking'] is False and r['keep']['crossed'] is True)
st, r = api(A, {'action': 'seal', 'level': KEY}, tok=RM); code = r.get('code', '')
check('seal → ATH-LV code · digest · seal in view · public off · keys line+counts', st == 200 and code.startswith('ATH-LV-') and len(r['digest']) == 64 and r['view']['seal']['code'] == code and r['view']['live_public'] is False and r['view']['public_keys'] == ['line', 'counts'])
row = rest(f'portal_level_pages?code=eq.{code}')[0]; body = row['body']
check('sealed body: v p70 · program level 1 · exam_speaking dropped (keep) · exam_writing kept (her words) · no href · counts', body['v'] == 'p70' and body['program']['level_no'] == 1 and 'exam_speaking' not in [c['key'] for c in body['cards']] and 'exam_writing' in [c['key'] for c in body['cards']] and all('href' not in c for c in body['cards']) and body['counts']['day_lines'] == 3)
st, s2 = api(A, {'action': 'seal', 'level': KEY}, tok=RM); code_a, code = code, s2.get('code', '')
check('seal again → newer seal replaces: new code · previous 1 · old code in history', st == 200 and code.startswith('ATH-LV-') and code != code_a and s2['view']['seal']['previous'] == 1 and api(f'/api/verify/level?code={code_a}', tok=None)[1].get('replaced') is True)
row = rest(f'portal_level_pages?code=eq.{code}')[0]; body = row['body']
# ---- 3) التحقّق والوجه العام
st, vf = api(f'/api/verify/level?code={code}', tok=None); check('verify: valid · intact · level 1 · program · public false · no face', st == 200 and vf['valid'] and vf['intact'] and vf['level_no'] == 1 and 'دبلوم تعليم العربية' in vf['program_ar'] and vf['public'] is False and 'face' not in vf)
st, vf = api(f'/api/verify/level?code={code}&face=1', tok=None); check('face=1 on private → no face', st == 200 and vf.get('face') is None)
st, r = api(A, {'action': 'public', 'level': KEY, 'live_public': True, 'public_keys': ['line', 'counts', 'crossed', 'exam_writing']}, tok=RM); check('public on · exam_writing key rejected silently · crossed kept', st == 200 and r['view']['live_public'] is True and r['view']['public_keys'] == ['line', 'counts', 'crossed'])
st, vf = api(f'/api/verify/level?code={code}&face=1', tok=None); f = vf.get('face') or {}; fraw = json.dumps(f, ensure_ascii=False)
check('public face: line · counts · crossed card only · no name · no exam text · no voice', f.get('line_ar') == LINE and f.get('counts', {}).get('day_lines') == 3 and [c['key'] for c in f.get('cards', [])] == ['crossed'] and f.get('name') is None and 'في صفّي نبدأ' not in fraw and 'voice_sec' not in fraw)
st, bad = api('/api/verify/level?code=ATH-LV-ZZZZ-ZZZZ', tok=None); check('unknown code → valid false', st == 200 and bad['valid'] is False)
# ---- 4) الصوت: GET exam voice (signed) · POST line voice too long → 400
st, ev = api(f'/api/me/level/voice?level={KEY}&exam=1', tok=RM); check('exam voice signed url for owner (sec 95)', st == 200 and ev.get('url') and ev.get('sec') == 95)
st, ev2 = api(f'/api/me/level/voice?level={KEY}&exam=1', tok=KH); check('exam voice for non-owner → 404', st == 404)
# ---- 5) الصدى في «سطري» (أول أسبوع في المستوى 2) · صفحة التخرّج تحمل سطر المستوى
st, ec = api(A + '?echo=1', tok=RM); check('echo=1 → «قلتَ وأنت تعبر المستوى 1:» + line · next 2 · href', st == 200 and ec['echo'] and ec['echo']['intro_ar'] == 'قلتَ وأنت تعبر المستوى 1:' and ec['echo']['line_ar'] == LINE and ec['echo']['next_level_no'] == 2 and ec['echo']['href'] == f'/me/level?level={urllib.parse.quote(KEY)}')
st, ec2 = api(A + '?echo=1', tok=KH); check('echo for khalid → null', st == 200 and ec2['echo'] is None)
# ---- 6) الإبطال ثم الختم من جديد (history) ثم الحذف
st, r = api(A, {'action': 'revoke', 'level': KEY}, tok=RM); check('revoke → seal.revoked_at set · public off', st == 200 and r['view']['seal']['revoked_at'] and r['view']['live_public'] is False)
st, vf = api(f'/api/verify/level?code={code}', tok=None); check('verify after revoke: valid false · revoked true · not replaced', vf['valid'] is False and vf['revoked'] is True and not vf.get('replaced'))
st, ec = api(A + '?echo=1', tok=RM); check('echo gone while revoked', ec['echo'] is None)
st, r2 = api(A, {'action': 'seal', 'level': KEY}, tok=RM); code2 = r2.get('code', ''); check('re-seal after revoke → new code · previous 2', st == 200 and code2.startswith('ATH-LV-') and code2 != code and r2['view']['seal']['previous'] == 2)
st, vf = api(f'/api/verify/level?code={code}', tok=None); check('revoked old code → replaced true (stays known)', vf.get('replaced') is True and vf['revoked'] is True)
st, r = api(A, {'action': 'public', 'level': KEY, 'live_public': True, 'public_keys': ['line', 'counts', 'crossed']}, tok=RM); check('public on again for UI', st == 200 and r['view']['live_public'] is True)
st, ec = api(A + '?echo=1', tok=RM); check('echo back after re-seal', ec['echo'] and ec['echo']['line_ar'] == LINE)
# ---- 7) الواجهة
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar'); pg = ctx.new_page()
    login(pg, 'reem@example.com')
    pg.goto(B + '/me/level', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="lv-prog"]', timeout=60000); pg.wait_for_timeout(600)
    check('browser: root phase open · sealed 1 · station banner · cards ≥ 5 · section line', pg.locator('[data-testid="lv-root"]').get_attribute('data-phase') == 'open' and pg.locator('[data-testid="lv-root"]').get_attribute('data-sealed') == '1' and pg.locator('[data-testid="lv-open"]').count() == 1 and pg.locator('[data-testid="lv-card"]').count() >= 5 and pg.locator('[data-testid="lv-section"]').count() == 1)
    txt = pg.locator('[data-testid="lv-root"]').inner_text(); check('page text: بكلماتي عبر المستوى · عبرتُ · her exam text · code ATH-LV · no زميل · no %', 'بكلماتي عبر المستوى' in txt and 'عبرتُ' in txt and 'في صفّي نبدأ' in txt and code2 in txt and 'زميل' not in txt and '%' not in txt)
    check('exam hear button present (voice stays with her)', pg.locator('[data-testid="lv-exam-hear"]').count() == 1)
    pg.screenshot(path=f'{OUT}/01-level-sealed.png', full_page=True)
    pub = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar').new_page(); pub.goto(B + f'/lv/{code2}', wait_until='domcontentloaded'); pub.wait_for_selector('[data-testid="pl-root"][data-state="ok"]', timeout=20000)
    ptxt = pub.locator('[data-testid="pl-root"]').inner_text(); check('/lv/<code> public face: line · counts · crossed card · no name · no exam text · no email', LINE in ptxt and pub.locator('[data-testid="pl-counts"]').count() == 1 and pub.locator('[data-testid="pl-card"][data-key="crossed"]').count() == 1 and 'ريم' not in ptxt and 'في صفّي نبدأ' not in ptxt and 'example.com' not in ptxt)
    pub.screenshot(path=f'{OUT}/02-public-face.png', full_page=True)
    pub.goto(B + '/lv/ATH-LV-SEED-2222', wait_until='domcontentloaded'); pub.wait_for_selector('[data-testid="pl-gone"]', timeout=20000); check('/lv private seed → «خاصّة بصاحبها»', 'خاصّة' in pub.locator('[data-testid="pl-gone"]').inner_text())
    pub.goto(B + f'/lv/{code}', wait_until='domcontentloaded'); pub.wait_for_selector('[data-testid="pl-revoked"]', timeout=20000); check('/lv old (replaced) code → «أُبطل … ختمًا أحدث»', 'أحدث' in pub.locator('[data-testid="pl-revoked"]').inner_text())
    pub.goto(B + f'/verify/level?code={code2}', wait_until='domcontentloaded'); pub.wait_for_selector('[data-testid="vl-valid"]', timeout=20000); check('/verify/level valid + public link + المستوى 1', pub.locator('[data-testid="vl-public-link"]').count() == 1 and 'المستوى 1' in pub.locator('[data-testid="vl-valid"]').inner_text())
    pub.screenshot(path=f'{OUT}/03-verify.png', full_page=True)
    pg.goto(B + '/me/line', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="ln-echo"]', timeout=60000)
    etxt = pg.locator('[data-testid="ln-echo"]').inner_text(); check('«سطري»: echo banner «قلتَ وأنت تعبر المستوى 1» + line + «تبدأ المستوى 2» + link', 'قلتَ وأنت تعبر المستوى 1' in etxt and LINE in etxt and 'المستوى 2' in etxt and pg.locator('[data-testid="ln-level"]').count() == 1)
    pg.screenshot(path=f'{OUT}/04-line-echo.png', full_page=True)
    pg.goto(B + '/me', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="me-level"]', timeout=60000); check('/me has «بكلماتي عبر المستوى» link', True)
    # الحذف من الواجهة
    pg.goto(B + '/me/level', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="lv-delete"]', timeout=60000)
    pg.once('dialog', lambda dlg: dlg.accept()); pg.locator('[data-testid="lv-delete"]').evaluate('e => e.click()'); pg.wait_for_selector('[data-testid="lv-root"][data-sealed="0"]', timeout=20000); pg.wait_for_timeout(500)
    check('delete via UI → row gone immediately · old codes unknown', rest('portal_level_pages?enrollment_id=eq.en-p70x-u5') == [] and api(f'/api/verify/level?code={code2}', tok=None)[1]['valid'] is False)
    pg.screenshot(path=f'{OUT}/05-after-delete.png', full_page=True)
    br.close()
# ---- 8) الخزنة
st, vt = api('/api/me/data?what=registry', tok=RM) if False else (200, {})
fails = [n for n, c in ok if not c]; print(f'\n{len(ok) - len(fails)}/{len(ok)} PASS'); print('FAILS:', fails) if fails else None; sys.exit(1 if fails else 0)
