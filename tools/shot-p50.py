# E2E P50 «توقيعي» — سجلّ التوقيعات المعلّقة
#  1) API: غير الطاقم (u5) → 403 · الطاقم (u1) يقرأ السجلّ (light/كامل) · المدير التنفيذي للبرامج (u3) يقرأ أيضًا
#  2) تهيئة: خدمة جهة A1 (3 طلاب: 2 ضعاف + 1 بلا تصحيح) → طلب الجهة لمِران · دعوة شعبة c1 (2 ضعاف) · قرار تسكين رمادي بمهلة يومين (REST) · أداء معلّق
#  3) API: المجاميع: client_requests(urgent) · practice_exit(c1 · touch invite_id) · rating · placement_review(deadline ≤2 → urgent) · bank_review · الترتيب بالأقدم · total · لا أسماء
#  4) touch: غير الطاقم 403 · مفتاح مجهول 404 · touch على practice_exit/inv → approve_all عبر المسار القائم → السجلّ يعود بلا المجموعة · audit sign_touch · «وقّعتَ اليوم» ≥ 1
#  5) المتصفح: /admin/sign (الهيدر · المجاميع · اللمسة على مجموعة الجهة لا تظهر · التأكيد ثم التوقيع) · عدّاد ✍️ في AdminShell و PortalShell(/me) · /admin/sign يفتحها «نادِ» (DESTINATIONS) · جوال
#  6) الكرون: /api/followups/send?dry=1 يعيد sign_digest{staff · sent · total} · بلا dry → إشعار sign_digest واحد لكل طاقم · /api/notices يعرض ✍️
import sys, json, urllib.request, urllib.error, os, time
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p50'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def rest_post(table, body):
    req = urllib.request.Request(M + '/rest/v1/' + table, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'Prefer': 'return=representation'}); return json.load(urllib.request.urlopen(req))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
class Client:
    def __init__(self, ip, tok=None): self.cookie = None; self.ip = ip; self.tok = tok
    def _grab(self, headers):
        for k, v in headers.items():
            if k.lower() == 'set-cookie' and v.startswith('miaar_placement_session='): self.cookie = v.split(';')[0].split('=', 1)[1] or None
    def call(self, path, body=None, tok=None, method=None, raw=False):
        h = {'Content-Type': 'application/json', 'X-Forwarded-For': self.ip}; tok = tok or self.tok
        if tok: h['Authorization'] = f'Bearer {tok}'
        if self.cookie: h['Cookie'] = f'miaar_placement_session={self.cookie}'
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(B + path, data=data, method=method or ('POST' if data is not None else 'GET'), headers=h)
        try:
            r = urllib.request.urlopen(req); rb = r.read(); self._grab(r.headers)
            if raw: return r.status, rb.decode('utf-8', 'replace'), dict(r.headers)
            return r.status, (json.loads(rb) if rb else {})
        except urllib.error.HTTPError as e:
            rb = e.read() or b''; self._grab(e.headers)
            if raw: return e.code, rb.decode('utf-8', 'replace'), dict(e.headers)
            try: return e.code, json.loads(rb or b'{}')
            except Exception: return e.code, {}
AR = ' '.join(['أنا أدرس اللغة العربية في الجامعة كل يوم وأحب القراءة والكتابة مع أصدقائي'] * 2)
staff = Client(f'10.{R}.95.1', tok='tok'); reset(); time.sleep(31)
A = '/api/admin/miaar/bank'; S = '/api/admin/miaar/syllabus'; X = '/api/admin/miaar/exit'; RT = '/api/admin/miaar/rating'; SV = '/api/admin/miaar/service'; CL = '/api/miaar/client'; SG = '/api/admin/sign'
# ---- 1) الصلاحيات قبل أيّ شيء
st, j = staff.call(SG, tok='tok-u5'); check('non-staff learner (u5) → 403 (no register, no counts)', st == 403)
st, j = staff.call(SG + '?light=1'); check('staff light GET → {success · total · oldest_days · today_signed} without groups', st == 200 and j.get('success') and 'total' in j and 'groups' not in j)
st, j0 = staff.call(SG); check('staff full GET → groups[] · scope all · computed_at · title «توقيعي»', st == 200 and isinstance(j0.get('groups'), list) and j0.get('scope') == 'all' and j0.get('computed_at') and j0.get('title', {}).get('ar') == 'توقيعي')
base_total = j0.get('total') or 0; base_bank = next((g['count'] for g in j0['groups'] if g['key'] == 'bank_review'), 0)
print('baseline total', base_total, 'bank_review', base_bank)
st, j3 = staff.call(SG, tok='tok-u3'); check('program manager (u3 · PROGRAM_MANAGER) reads the register too (staff role)', st == 200 and j3.get('scope') == 'all')
# ---- 2) تهيئة
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m2a', 'status': 'approved'}); assert st == 200, b
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m4a', 'status': 'approved'}); assert st == 200, b
st, r = staff.call(S, {'action': 'seed_level', 'level': 'A1'}); assert st == 200 and r.get('inserted') == 8, r
for c in ['A1-U02', 'A1-U03', 'A1-U05', 'A1-U07']:
    st, r = staff.call(S, {'action': 'unit_status', 'code': c, 'status': 'approved'}); assert st == 200, r
st, g = staff.call(f'{S}?level=A1'); items = g['items']
st, jb = staff.call(SG + '?fresh=1'); base_bank = next((g['count'] for g in jb['groups'] if g['key'] == 'bank_review'), 0); print('bank_review after batch approval', base_bank)
st, r = staff.call(S, {'action': 'tag_items', 'item_ids': [i['id'] for i in items], 'unit_codes': ['A1-U02'], 'mode': 'add'}); assert st == 200, r
_items = {i['id']: i['item_code'] for i in rest('question_bank_items?select=id,item_code&limit=2000')}
KEY = {_items[k['item_id']]: k['correct_option_id'] for k in rest('question_bank_answer_keys?limit=2000') if k['item_id'] in _items}
def sit(c, invite, email, name, correct_ratio, rooms=True):
    st, s = c.call('/api/miaar', {'action': 'start', 'instructions_ack': {'version': 1, 'lang': 'ar', 'accepted': True}, 'candidate': {'name': name, 'email': email}, 'examMode': 'comprehensive', 'invite': invite})
    if st != 200: return st, s
    Q = s.get('session', {}).get('form', {}).get('questions') or []
    for k, q in enumerate(Q):
        opts = q.get('options') or [{'id': 'a'}]; chosen = opts[0]['id']
        if KEY.get(q['id']): chosen = KEY[q['id']] if (k % 10) < round(correct_ratio * 10) else next((o['id'] for o in opts if o['id'] != KEY[q['id']]), chosen)
        c.call('/api/miaar', {'action': 'answer', 'questionId': q['id'], 'selectedOptionId': chosen, 'finalize': k == len(Q) - 1})
    st, f = c.call('/api/miaar', {'action': 'finish'})
    if st == 200 and rooms:
        c.call('/api/miaar', {'action': 'room_enter'}); c.call('/api/miaar', {'action': 'room_submit', 'skill': 'writing', 'text': AR, 'ai_consent': False}); c.call('/api/miaar', {'action': 'room_submit', 'skill': 'speaking', 'text': AR, 'accommodation': 'typed_instead_of_speaking'})
    return st, f
def rate_ids(ids, good=2):
    st, q = staff.call(f'{RT}?status=pending'); n = 0
    for r in q.get('rows', []):
        if ids != 'all' and r.get('submission_id') not in ids and r.get('session_id') not in ids: continue
        sc = {'range': good, 'accuracy': good, 'task': good, ('coherence' if r['skill'] == 'writing' else 'fluency'): good}
        st2, rl = staff.call(RT, {'action': 'rate', 'id': r['id'], 'scores': sc, 'note': 'ضعيف', 'release': True}); n += 1 if st2 == 200 else 0
    return n
# خدمة جهة
st, cs = staff.call(SV, {'action': 'create', 'level': 'A1', 'client_name': 'معهد الأفق للغات', 'client_contact': 'ofoq@example.com', 'max_seats': 10, 'identity_mode': 'email', 'auto_pin': False}); sinv = cs.get('invite') or {}; TOKEN = (cs.get('client_url') or '').rsplit('/', 1)[-1]
ORDER = (cs.get('order') or {}).get('id'); assert st == 200 and sinv.get('id') and TOKEN and ORDER, cs
for n in range(2):
    st, f = sit(Client(f'10.{R}.95.{20 + n}'), {'code': sinv['code']}, f'p50s-{n}-{R}@example.com', f'طالب الجهة {n}', 0.0); assert st == 200, f
n1 = rate_ids('all', 2); st, bd = staff.call(f'{X}?invite={sinv["id"]}'); finals = [r for r in bd.get('rows', []) if (r.get('exit') or {}).get('الحالة') == 'final']
check(f'service: 2 weak learners rated ({n1}) → 2 final verdicts', len(finals) == 2)
st, f = sit(Client(f'10.{R}.95.29'), {'code': sinv['code']}, f'p50s-9-{R}@example.com', 'طالب بلا تصحيح', 0.0); assert st == 200, f  # يبقى أداؤه معلّقًا
cb = Client(f'10.{R}.95.61'); st, e1 = cb.call(CL, {'t': TOKEN, 'action': 'practice_request', 'message': 'نرجو البدء هذا الأسبوع'}); check('client requests مِران for its 2 learners', st == 200 and e1.get('ok') and e1.get('eligible') == 2)
# دعوة شعبة
st, cr = staff.call(X, {'action': 'create', 'classroom_id': 'c1', 'max_seats': 30}); cinv = cr.get('invite') or {}; assert st == 200 and cinv.get('id'), cr
for n in range(2):
    st, f = sit(Client(f'10.{R}.95.{40 + n}'), {'code': cinv['code']}, f'p50c-{n}-{R}@example.com', f'طالب الشعبة {n}', 0.0); assert st == 200, f
st, q = staff.call(f'{RT}?status=pending'); pend_before = len(q.get('rows') or [])
# نصحّح طلاب الشعبة فقط (نترك طالب الجهة بلا تصحيح)
rated = 0
for r in q.get('rows', []):
    if 'الشعبة' in json.dumps(r, ensure_ascii=False) or (r.get('candidate') or {}).get('name', '').startswith('طالب الشعبة') or 'p50c-' in json.dumps(r):
        sc = {'range': 2, 'accuracy': 2, 'task': 2, ('coherence' if r['skill'] == 'writing' else 'fluency'): 2}; st2, _ = staff.call(RT, {'action': 'rate', 'id': r['id'], 'scores': sc, 'note': 'ضعيف', 'release': True}); rated += 1 if st2 == 200 else 0
if rated == 0:  # إن لم تُميَّز الأداءات بالاسم: صحّح الكلّ ما عدا اثنين
    rows = q.get('rows') or []
    for r in rows[:-2]:
        sc = {'range': 2, 'accuracy': 2, 'task': 2, ('coherence' if r['skill'] == 'writing' else 'fluency'): 2}; staff.call(RT, {'action': 'rate', 'id': r['id'], 'scores': sc, 'note': 'ضعيف', 'release': True})
st, bd = staff.call(f'{X}?invite={cinv["id"]}'); cfinals = [r for r in bd.get('rows', []) if (r.get('exit') or {}).get('الحالة') == 'final']
check('classroom A-101 (c1): 2 weak learners → 2 final «failed» verdicts (eligible for مِران)', len(cfinals) == 2 and all(r['exit']['النتيجة'] in ('failed', 'conditional') for r in cfinals))
st, q = staff.call(f'{RT}?status=pending'); pend_now = len(q.get('rows') or []); check(f'rating queue keeps the unrated performances ({pend_now} ≥ 1)', pend_now >= 1)
# قرار رمادي بمهلة يومين
dl = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() + 2 * 86400 - 3600))
rest_post('placement_decisions', {'report_id': f'gray-{R}', 'classroom_id': None, 'decision_status': 'review', 'deadline_at': dl, 'decided_at': None, 'assigned_level': 'A2', 'created_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 3 * 86400))})
# ---- 3) السجلّ
st, reg = staff.call(SG + '?fresh=1'); by = {g['key']: g for g in reg.get('groups', [])}
check('register after setup: client_requests 1 · urgent · item label «معهد الأفق — 2 طالبًا · برسالة» · href exit board #xb-practice · no touch', by.get('client_requests', {}).get('count') == 1 and by['client_requests'].get('urgent') and '2 طالبًا' in by['client_requests']['items'][0]['label_ar'] and 'برسالة' in by['client_requests']['items'][0]['label_ar'] and by['client_requests']['items'][0]['href'].endswith('#xb-practice') and not by['client_requests']['items'][0].get('touch'))
pe = by.get('practice_exit', {}); pe_items = pe.get('items') or []
check('practice_exit: 2 (classroom invite only — the client invite is listed under client_requests) · item touch = approve_all invite_id', pe.get('count') == 2 and len(pe_items) == 1 and pe_items[0]['id'] == cinv['id'] and pe_items[0].get('touch') == {'action': 'practice_approve_all', 'body': {'invite_id': cinv['id']}})
st, qq = staff.call(f'{RT}?status=pending'); check('rating: pending performances count = queue · href rating board', by.get('rating', {}).get('count') == len(qq.get('rows') or []) and by['rating']['href'] == '/admin/miaar/rating')
pr = by.get('placement_review', {}); check('placement_review: 1 · deadline_days ≤ 2 → urgent · href ledger ?decision=review', pr.get('count') == 1 and (pr.get('deadline_days') or 9) <= 2 and pr.get('urgent') and pr.get('href') == '/admin/miaar/ledger?decision=review')
check('bank_review unchanged from baseline · no exit_promote/integrity groups (nothing passed, no witness signals)', by.get('bank_review', {}).get('count', 0) == base_bank and 'exit_promote' not in by and 'integrity' not in by)
exp_total = sum(g['count'] for g in reg['groups']); check(f'total = Σ groups ({exp_total}) · oldest_days ≥ 0 · groups ordered oldest-first', reg.get('total') == exp_total and (reg.get('oldest_days') or 0) >= 0 and [g['oldest_at'] or '~' for g in reg['groups']] == sorted([g['oldest_at'] or '~' for g in reg['groups']]))
check('no learner names anywhere in the register', not any(s in json.dumps(reg, ensure_ascii=False) for s in ['طالب الجهة', 'طالب الشعبة', 'طالب بلا تصحيح', 'p50s-', 'p50c-']))
check('every group carries hint + href · area miaar|portal · portal door decisions (P42-ب) appear as door:* groups for the admin', all(g.get('hint_ar') and g.get('href') and g.get('area') in ('miaar', 'portal') for g in reg['groups']) and any(g['key'].startswith('door:') and g['area'] == 'portal' for g in reg['groups']))
# ---- 4) اللمسة
st, t0 = staff.call(SG, {'action': 'touch', 'key': 'practice_exit', 'id': cinv['id']}, tok='tok-u5'); check('touch by non-staff → 403', st == 403)
st, t1 = staff.call(SG, {'action': 'touch', 'key': 'practice_exit', 'id': 'nope'}); check('touch unknown id → 404 not_found', st == 404 and t1.get('code') == 'not_found')
st, t2 = staff.call(SG, {'action': 'touch', 'key': 'client_requests', 'id': ORDER}); check('touch on a non-touchable group → 400 not_touchable', st == 400 and t2.get('code') == 'not_touchable')
st, t3 = staff.call(SG, {'action': 'bogus'}); check('unknown action → 400', st == 400)
st, t4 = staff.call(SG, {'action': 'touch', 'key': 'practice_exit', 'id': cinv['id']})
check('touch practice_exit/<classroom invite> → delegated approve_all done 2 · returns refreshed register without practice_exit', st == 200 and t4.get('success') and (t4.get('result') or {}).get('done') == 2 and not any(g['key'] == 'practice_exit' for g in t4.get('groups', [])) and t4.get('total') == exp_total - 2)
plans = rest('miaar_practice_plans?status=eq.approved'); check('2 approved plans exist (created by the existing practice route, not by sign)', len(plans) == 2)
au = rest('audit_logs?action=eq.sign_touch'); check('audit sign_touch ×1 · metadata{key · id · done 2}', len(au) == 1 and (au[0].get('metadata') or {}).get('key') == 'practice_exit' and au[0]['metadata'].get('done') == 2)
check('audit miaar_practice_approve_all also written by the delegated route', len(rest('audit_logs?action=eq.miaar_practice_approve_all')) == 1)
st, reg2 = staff.call(SG + '?fresh=1'); check('today_signed ≥ 1 after the touch (counts the admin’s own signing actions today)', st == 200 and (reg2.get('today_signed') or 0) >= 1)
st, t5 = staff.call(SG, {'action': 'touch', 'key': 'practice_exit', 'id': cinv['id']}); check('touch again → 404 (nothing pending for that invite anymore)', st == 404)
# ---- 5) المتصفح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=30000)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); pg.on('pageerror', lambda e: errs.append(pg.url + ' ' + str(e)))
    login(pg, 'admin@upm.edu.sa')
    pg.goto(B + '/admin/sign', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="sg-list"], [data-testid="sg-empty"]', timeout=30000); pg.wait_for_timeout(600)
    root = pg.locator('[data-testid="sg-root"]'); tot = int(root.get_attribute('data-total') or -1)
    check(f'/admin/sign renders · data-total {tot} = API total', tot == reg2.get('total'))
    check('header: sg-total · sg-today · sg-oldest visible · title «توقيعي» + official name', pg.locator('[data-testid="sg-total"]').count() == 1 and pg.locator('[data-testid="sg-today"]').count() == 1 and pg.locator('[data-testid="sg-oldest"]').count() == 1 and 'توقيعي' in pg.inner_text('h1') and 'سجلّ التوقيعات المعلّقة' in pg.inner_text('[data-testid="sg-root"]'))
    groups = pg.locator('[data-testid="sg-group"]'); keys = [groups.nth(i).get_attribute('data-key') for i in range(groups.count())]
    check(f'groups rendered in API order ({len(keys)})', keys == [g['key'] for g in reg2['groups']])
    check('client_requests group has no touch button (read first, then sign) · has «افتح» link', pg.locator('[data-testid="sg-group"][data-key="client_requests"] [data-testid="sg-touch"]').count() == 0 and pg.locator('[data-testid="sg-group"][data-key="client_requests"] [data-testid="sg-go"]').count() == 1)
    check('AdminShell strip shows ✍️ sign-counter with data-total = total', pg.locator('[data-testid="sign-counter"]').count() == 1 and pg.locator('[data-testid="sign-counter"]').get_attribute('data-total') == str(reg2.get('total')))
    check('no page errors', not errs); pg.screenshot(path=f'{OUT}/01-sign-board.png', full_page=True)
    # لمسة من المتصفح: نصنع مجموعة قابلة للمس — دعوة شعبة ثانية بطالب ضعيف واحد
    st, cr2 = staff.call(X, {'action': 'create', 'classroom_id': 'c1', 'max_seats': 30}); cinv2 = cr2.get('invite') or {}
    st, f = sit(Client(f'10.{R}.95.77'), {'code': cinv2['code']}, f'p50d-{R}@example.com', 'طالب الشعبة ب', 0.0); assert st == 200, f
    st, q = staff.call(f'{RT}?status=pending')
    for r in q.get('rows', []):
        if 'p50d-' in json.dumps(r) or 'الشعبة ب' in json.dumps(r, ensure_ascii=False):
            sc = {'range': 2, 'accuracy': 2, 'task': 2, ('coherence' if r['skill'] == 'writing' else 'fluency'): 2}; staff.call(RT, {'action': 'rate', 'id': r['id'], 'scores': sc, 'note': 'ضعيف', 'release': True})
    st, regb = staff.call(SG + '?fresh=1'); has_pe = any(g['key'] == 'practice_exit' for g in regb.get('groups', []))
    if not has_pe:  # fallback: rate everything
        rate_ids('all', 2); st, regb = staff.call(SG + '?fresh=1'); has_pe = any(g['key'] == 'practice_exit' for g in regb.get('groups', []))
    check('second classroom invite → practice_exit group back (1 pending)', has_pe)
    pg.click('[data-testid="sg-refresh"]'); pg.wait_for_selector('[data-testid="sg-group"][data-key="practice_exit"] [data-testid="sg-touch"]', timeout=30000); pg.wait_for_timeout(300)
    tb = pg.locator('[data-testid="sg-group"][data-key="practice_exit"] [data-testid="sg-touch"]')
    check('practice_exit item shows «توقيع بلمسة» button', tb.count() >= 1)
    pg.once('dialog', lambda d: d.dismiss()); tb.first.click(); pg.wait_for_timeout(800)
    check('dismissing the confirm → nothing signed (group still there)', pg.locator('[data-testid="sg-group"][data-key="practice_exit"]').count() == 1 and len(rest('miaar_practice_plans?status=eq.approved')) == 2)
    pg.once('dialog', lambda d: d.accept()); tb.first.click()
    try: pg.wait_for_selector('[data-testid="sg-ok"]', timeout=30000)
    except Exception: print('DEBUG sg-err:', pg.locator('[data-testid="sg-err"]').inner_text() if pg.locator('[data-testid="sg-err"]').count() else '(none)'); pg.screenshot(path=f'{OUT}/dbg-touch.png', full_page=True)
    pg.wait_for_timeout(800)
    check('accepting the confirm → «sg-ok» · practice_exit group gone · 3 approved plans · counter decremented', pg.locator('[data-testid="sg-group"][data-key="practice_exit"]').count() == 0 and len(rest('miaar_practice_plans?status=eq.approved')) == 3 and int(pg.locator('[data-testid="sign-counter"]').get_attribute('data-total') or -1) == int(pg.locator('[data-testid="sg-root"]').get_attribute('data-total') or -2))
    pg.screenshot(path=f'{OUT}/02-sign-after-touch.png', full_page=True)
    # PortalShell counter (صفحات البوابة ذات الهيدر — /programs)
    pg.goto(B + '/programs', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="sign-counter"]', timeout=30000)
    sc_ = pg.locator('[data-testid="sign-counter"]'); check('PortalShell (/programs): ✍️ counter beside the bell · links to /admin/sign · aria-label mentions توقيعي · same total as the board', sc_.count() == 1 and sc_.get_attribute('href') == '/admin/sign' and 'توقيعي' in (sc_.get_attribute('aria-label') or '') and sc_.get_attribute('data-total') == str(staff.call(SG + '?light=1')[1].get('total')))
    pg.screenshot(path=f'{OUT}/03-programs-counter.png', clip={'x': 0, 'y': 0, 'width': 1380, 'height': 140})
    # جوال
    mp = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True, storage_state=pg.context.storage_state()).new_page()
    mp.goto(B + '/admin/sign', wait_until='domcontentloaded'); mp.wait_for_selector('[data-testid="sg-list"], [data-testid="sg-empty"]', timeout=30000); mp.wait_for_timeout(500)
    check('mobile: no horizontal overflow', mp.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1')); mp.screenshot(path=f'{OUT}/04-mobile.png', full_page=True)
    # متعلّم: لا عدّاد ولا صفحة
    lp = br.new_context(viewport={'width': 1200, 'height': 800}, locale='ar').new_page(); login(lp, 'reem@example.com')
    lp.goto(B + '/programs', wait_until='domcontentloaded'); lp.wait_for_selector('.nt-bell', timeout=30000); lp.wait_for_timeout(2500)
    check('learner (reem): bell shown but no ✍️ counter in the shell (403 → silent)', lp.locator('[data-testid="sign-counter"]').count() == 0)
    lp.goto(B + '/admin/sign', wait_until='domcontentloaded'); lp.wait_for_timeout(2500)
    check('learner opening /admin/sign: guarded by AdminShell (no register rendered)', lp.locator('[data-testid="sg-list"]').count() == 0 and lp.locator('[data-testid="sg-item"]').count() == 0)
    br.close()
# ---- 6) الكرون
st, d1 = staff.call('/api/followups/send?dry=1', tok='cron'); sd = d1.get('sign_digest') or {}
check('cron dry → sign_digest{staff ≥ 3 · sent = staff · total > 0} · nothing written', st == 200 and (sd.get('staff') or 0) >= 3 and sd.get('sent') == sd.get('staff') and (sd.get('total') or 0) > 0 and len(rest('portal_learner_notices?kind=eq.sign_digest')) == 0)
st, d2 = staff.call('/api/followups/send', tok='cron'); sd2 = d2.get('sign_digest') or {}
nts = rest('portal_learner_notices?kind=eq.sign_digest')
check('cron live → one sign_digest notice per staff member · title «ينتظر توقيعك اليوم N» · url /admin/sign · no names', st == 200 and sd2.get('sent') == len(nts) and len(nts) >= 3 and all(n['url'] == '/admin/sign' and n['title_ar'].startswith('ينتظر توقيعك اليوم') for n in nts) and 'admin@upm.edu.sa' in [n['email'] for n in nts] and 'reem@example.com' not in [n['email'] for n in nts])
st, d3 = staff.call('/api/followups/send', tok='cron'); check('cron again same day → sent 0 (once per day)', st == 200 and (d3.get('sign_digest') or {}).get('sent') == 0 and len(rest('portal_learner_notices?kind=eq.sign_digest')) == len(nts))
st, nj = staff.call('/api/notices'); check('/api/notices (admin) lists sign_digest with icon ✍️', st == 200 and any(x['kind'] == 'sign_digest' and x.get('icon') == '✍️' for x in nj.get('notices') or []))
print(f"{sum(1 for _, c in ok if c)}/{len(ok)} passed")
