# E2E «مِعيار — من أَثَر» م12 «مِران للجهات» — الجهة تطلب مِران لطلابها، والطاقم يوقّع
#  1) إعداد: بنك معتمد · وحدات A1 موسومة · خدمة خارجية A1 (أمر خدمة) · 6 طلاب يُنهون ضعافًا · التصحيح والإصدار → 6 «لم يجتز»
#  2) بوابة الجهة (API): practice{eligible 6 · can_request · cohort 0 · request null} · عمود مِران فارغ · POST practice_request (رسالة فيها وسم ورابط → تُنقّى) → حدث واحد في events + إشعار 🏢 لمنشئ الأمر · الطلب الثاني في اليوم نفسه يُحدَّث لا يُكرَّر · رسالة > 200 → 400
#  3) الطاقم (API): GET practice?invite → client_request{pending 6 · message} · أوامر الخدمة → practice_request.pending
#  4) المتصفح (الطاقم): /admin/miaar شارة «طلب مِران معلّق» · /admin/miaar/exit?invite → لافتة طلب الجهة + رسالتهم · «اعتمد الكلّ مع رسالة الجهة في اليوم 1» → 6 خطط
#  5) بعد الاعتماد (API): اليوم 1 يحمل رسالة الجهة · بوابة الجهة: approved 6 · request.approved_after 6 · rows[].practice{today 1 · done 0} بلا نسب · CSV +2 عمودان · لا طلب جديد (nothing_to_request) · الأمر لم يعد معلّقًا · الأدلة تحمل «بطلب من جهة» (practiceFacts عبر عُبور)
#  6) المتصفح (الجهة): /miaar/client/<token> بطاقة مِران (جاهزية الدفعة) + «اعتُمدت 6 خطّة بعد طلبكم» + عمود مِران · تقرير A4 يذكر مِران · جوال بلا تمرير أفقي
#  7) طلب قبل أيّ خطّة من المتصفح: خدمة ثانية (3 طلاب) → الجهة تكتب رسالة وتضغط «اطلب مِران لطلابي» → cb-miran-note · ثم «حدّث طلب مِران»
import sys, json, urllib.request, urllib.error, os, time
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-m12'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
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
staff = Client(f'10.{R}.92.1', tok='tok'); reset(); time.sleep(31)
A = '/api/admin/miaar/bank'; S = '/api/admin/miaar/syllabus'; X = '/api/admin/miaar/exit'; RT = '/api/admin/miaar/rating'; SV = '/api/admin/miaar/service'; CL = '/api/miaar/client'; PR = '/api/admin/miaar/practice'
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m2a', 'status': 'approved'}); assert st == 200, b
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m4a', 'status': 'approved'}); assert st == 200, b
st, r = staff.call(S, {'action': 'seed_level', 'level': 'A1'}); assert st == 200 and r.get('inserted') == 8, r
for c in ['A1-U02', 'A1-U03', 'A1-U05', 'A1-U07']:
    st, r = staff.call(S, {'action': 'unit_status', 'code': c, 'status': 'approved'}); assert st == 200, r
st, g = staff.call(f'{S}?level=A1'); items = g['items']
gv = [i for i in items if i['skill'] == 'grammar_vocab' and i['status'] == 'approved']; rd = [i for i in items if i['skill'] == 'reading' and i['status'] == 'approved']; li = [i for i in items if i['skill'] == 'listening' and i['status'] == 'approved']
st, r = staff.call(S, {'action': 'tag_items', 'item_ids': [i['id'] for i in items], 'unit_codes': ['A1-U02'], 'mode': 'add'}); assert st == 200, r
for ids, code in [([i['id'] for i in gv[:6]], 'A1-U03'), ([i['id'] for i in rd[:4]], 'A1-U05'), ([i['id'] for i in li[:4]], 'A1-U07')]:
    st, r = staff.call(S, {'action': 'tag_items', 'item_ids': ids, 'unit_codes': [code], 'mode': 'add'}); assert st == 200, r
check('setup: bank approved · A1 seeded · 4 units approved · tagged', True)
_items = {i['id']: i['item_code'] for i in rest('question_bank_items?select=id,item_code&limit=2000')}
KEY = {_items[k['item_id']]: k['correct_option_id'] for k in rest('question_bank_answer_keys?limit=2000') if k['item_id'] in _items}
def sit(c, invite, email, name, correct_ratio):
    st, s = c.call('/api/miaar', {'action': 'start', 'instructions_ack': {'version': 1, 'lang': 'ar', 'accepted': True}, 'candidate': {'name': name, 'email': email}, 'examMode': 'comprehensive', 'invite': invite})
    if st != 200: return st, s
    Q = s.get('session', {}).get('form', {}).get('questions') or []
    for k, q in enumerate(Q):
        opts = q.get('options') or [{'id': 'a'}]; chosen = opts[0]['id']
        if KEY.get(q['id']): chosen = KEY[q['id']] if (k % 10) < round(correct_ratio * 10) else next((o['id'] for o in opts if o['id'] != KEY[q['id']]), chosen)
        c.call('/api/miaar', {'action': 'answer', 'questionId': q['id'], 'selectedOptionId': chosen, 'finalize': k == len(Q) - 1})
    st, f = c.call('/api/miaar', {'action': 'finish'})
    if st == 200:
        c.call('/api/miaar', {'action': 'room_enter'}); c.call('/api/miaar', {'action': 'room_submit', 'skill': 'writing', 'text': AR, 'ai_consent': False}); c.call('/api/miaar', {'action': 'room_submit', 'skill': 'speaking', 'text': AR, 'accommodation': 'typed_instead_of_speaking'})
    return st, f
def rate_all(good=2):
    st, q = staff.call(f'{RT}?status=pending'); n = 0
    for r in q.get('rows', []):
        sc = {'range': good, 'accuracy': good, 'task': good, ('coherence' if r['skill'] == 'writing' else 'fluency'): good}
        st2, rl = staff.call(RT, {'action': 'rate', 'id': r['id'], 'scores': sc, 'note': 'ضعيف', 'release': True}); n += 1 if st2 == 200 else 0
    return n
# ---- 1) خدمة خارجية
st, cs = staff.call(SV, {'action': 'create', 'level': 'A1', 'client_name': 'معهد الأفق للغات', 'client_contact': 'ofoq@example.com', 'max_seats': 10, 'identity_mode': 'email', 'auto_pin': False}); sinv = cs.get('invite') or {}; TOKEN = (cs.get('client_url') or '').split('/miaar/client/')[-1]; ORDER = (cs.get('order') or {}).get('id')
check('service invite A1 for «معهد الأفق للغات» + client token + order', st == 200 and sinv.get('id') and TOKEN and ORDER)
L = []
for n in range(6):
    em = f'm12-{n}-{R}@example.com'; st, f = sit(Client(f'10.{R}.92.{20 + n}'), {'code': sinv['code']}, em, f'طالب الجهة {n}', 0.0); assert st == 200, f; L.append((em, f['access_code']))
n_rated = rate_all(2); st, bd = staff.call(f'{X}?invite={sinv["id"]}'); finals = [r for r in bd.get('rows', []) if (r.get('exit') or {}).get('الحالة') == 'final']
check(f'6 weak learners · rate+release ({n_rated}) → 6 final «failed» verdicts', len(finals) == 6 and all(r['exit']['النتيجة'] == 'failed' for r in finals))

# ---- 2) بوابة الجهة قبل الطلب
cb = Client(f'10.{R}.92.61'); st, d0 = cb.call(f'{CL}?t={TOKEN}'); p0 = d0.get('practice') or {}
check('client GET → practice{eligible 6 · can_request True · cohort.plans 0 · request null · approved 0}', st == 200 and p0.get('eligible') == 6 and p0.get('can_request') is True and (p0.get('cohort') or {}).get('plans') == 0 and p0.get('request') is None and (p0.get('approved') or 0) == 0)
check('client rows carry practice null before any plan', all(r.get('practice') is None for r in d0.get('rows') or []) and len(d0.get('rows') or []) == 6)
st, e1 = cb.call(CL, {'t': TOKEN, 'action': 'practice_request', 'message': '  نفخر <b>بكم</b> — ربع ساعة يوميًا تكفي https://ofoq.example.com/x  '})
check('POST practice_request → ok · eligible 6 · updated False', st == 200 and e1.get('ok') and e1.get('eligible') == 6 and e1.get('updated') is False)
ords = rest(f'miaar_service_orders?id=eq.{ORDER}'); evs = [e for e in (ords[0].get('events') or []) if e.get('type') == 'practice_request'] if ords else []
check('order.events has 1 practice_request · message sanitized (no tag, no link) · eligible 6 · by client:<ip>', len(evs) == 1 and evs[0].get('message') == 'نفخر بكم — ربع ساعة يوميًا تكفي' and evs[0].get('eligible') == 6 and str(evs[0].get('by', '')).startswith('client:'))
st, e2 = cb.call(CL, {'t': TOKEN, 'action': 'practice_request', 'message': 'رسالة محدَّثة: نثق بكم'})
ords = rest(f'miaar_service_orders?id=eq.{ORDER}'); evs = [e for e in (ords[0].get('events') or []) if e.get('type') == 'practice_request']
check('second request same day → updated True · still 1 event (replaced) · new message', st == 200 and e2.get('updated') is True and len(evs) == 1 and evs[0].get('message') == 'رسالة محدَّثة: نثق بكم')
st, e3 = cb.call(CL, {'t': TOKEN, 'action': 'practice_request', 'message': 'ن' * 201}); check('message > 200 → 400 message_too_long', st == 400 and e3.get('error') == 'message_too_long')
st, e4 = cb.call(CL, {'t': 'bad-token', 'action': 'practice_request'}); check('bad token → 404', st == 404)
nt = rest('portal_learner_notices?kind=eq.practice_requested')
check('staff notice practice_requested: 1 (deduped per order/day) · to order creator admin@upm.edu.sa · title has client + 6 · url exit board #xb-practice · body has the latest message', len(nt) == 1 and nt[0]['email'] == 'admin@upm.edu.sa' and 'معهد الأفق للغات' in nt[0]['title_ar'] and '6' in nt[0]['title_ar'] and nt[0]['url'] == f'/admin/miaar/exit?invite={sinv["id"]}#xb-practice' and 'نثق بكم' in nt[0]['body_ar'])
st, nj = staff.call('/api/notices'); check('/api/notices (admin) lists practice_requested with icon 🏢', st == 200 and any(x['kind'] == 'practice_requested' and x.get('icon') == '🏢' for x in nj.get('notices') or []))
st, d1 = cb.call(f'{CL}?t={TOKEN}'); rq = (d1.get('practice') or {}).get('request') or {}
check('client GET after request → request{pending True · approved_after 0 · message} · can_request still True (update allowed)', rq.get('pending') is True and rq.get('approved_after') == 0 and rq.get('message') == 'رسالة محدَّثة: نثق بكم' and d1['practice']['can_request'] is True)
al = rest('audit_logs?action=eq.miaar_practice_client_request'); check('audit miaar_practice_client_request ×2 (actor_role client · no internal actor)', len(al) == 2 and all(a.get('actor_role') == 'client' and not a.get('actor_id') for a in al))
check('no plan was created by the client request', len(rest('miaar_practice_plans')) == 0)

# ---- 3) الطاقم API
st, pj = staff.call(f'{PR}?invite={sinv["id"]}'); cr = pj.get('client_request') or {}
check('admin practice GET ?invite → client_request{client_name · pending 6 · approved_after 0 · message}', st == 200 and cr.get('client_name') == 'معهد الأفق للغات' and cr.get('pending') == 6 and cr.get('approved_after') == 0 and cr.get('message') == 'رسالة محدَّثة: نثق بكم')
st, so = staff.call(SV); o = next((x for x in so.get('orders', []) if x['id'] == ORDER), {}); pr_ = o.get('practice_request') or {}
check('service orders GET → order.practice_request{pending True · eligible 6}', st == 200 and pr_.get('pending') is True and pr_.get('eligible') == 6)
st, pj2 = staff.call(f'{PR}?invite={sinv["id"]}', tok='tok-u5'); check('non-staff cannot read practice board', st in (401, 403))

# ---- 4) المتصفح — الطاقم
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=20000)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); pg.on('pageerror', lambda e: errs.append(pg.url + ' ' + str(e)))
    login(pg, 'admin@upm.edu.sa')
    pg.goto(B + '/admin/miaar/invites', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="mm-order-row"]', timeout=30000); pg.wait_for_timeout(500)
    badge = pg.locator('[data-testid="mm-practice-req"]'); check('admin service orders: badge «🏢 طلب مِران معلّق (6)» linking to the exit board #xb-practice', badge.count() == 1 and 'طلب مِران معلّق (6)' in badge.inner_text() and (badge.get_attribute('href') or '').endswith(f'invite={sinv["id"]}#xb-practice'))
    pg.screenshot(path=f'{OUT}/01-admin-orders-badge.png', full_page=True)
    pg.goto(B + f'/admin/miaar/exit?invite={sinv["id"]}#xb-practice', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="pr-client-request"]', timeout=30000); pg.wait_for_timeout(500)
    crq = pg.locator('[data-testid="pr-client-request"]'); t = crq.inner_text()
    check('exit board PracticePanel: client-request banner (pending=1) with client name · «6 بانتظار توقيعك» · their message · 2 buttons', crq.get_attribute('data-pending') == '1' and 'معهد الأفق للغات' in t and '6 بانتظار توقيعك' in t and 'نثق بكم' in pg.inner_text('[data-testid="pr-client-msg"]') and pg.locator('[data-testid="pr-approve-all-msg"]').count() == 1 and pg.locator('[data-testid="pr-approve-all-plain"]').count() == 1)
    check('banner states the principle «الجهة تطلب، وأنت توقّع»', 'الجهة تطلب، وأنت توقّع' in t)
    pg.screenshot(path=f'{OUT}/02-exit-board-banner.png', full_page=True)
    pg.once('dialog', lambda d: d.accept()); pg.click('[data-testid="pr-approve-all-msg"]'); pg.wait_for_selector('[data-testid="pr-ok"]', timeout=30000); pg.wait_for_timeout(800)
    check('«اعتمد الكلّ مع رسالة الجهة في اليوم 1» → «اعتُمدت 6 خطّة» · banner now shows «اعتُمدت 6 خطّة بعد طلبها» (not pending)', 'اعتُمدت 6 خطّة' in pg.inner_text('[data-testid="pr-ok"]') and pg.locator('[data-testid="pr-client-request"]').get_attribute('data-pending') == '0' and 'اعتُمدت 6 خطّة بعد طلبها' in pg.inner_text('[data-testid="pr-client-request"]'))
    pg.screenshot(path=f'{OUT}/03-exit-board-approved.png', full_page=True)
    # ---- 5) بعد الاعتماد — API
    plans = rest('miaar_practice_plans?status=eq.approved')
    check('6 approved plans · each day 1 carries the client message as note_ar · day 2 has none', len(plans) == 6 and all((p['days'][0].get('note_ar') == 'رسالة محدَّثة: نثق بكم') and not p['days'][1].get('note_ar') for p in plans))
    au = rest('audit_logs?action=eq.miaar_practice_approve_all'); check('audit approve_all carries day1_note True · done 6', len(au) == 1 and (au[0].get('metadata') or {}).get('day1_note') is True and au[0]['metadata'].get('done') == 6)
    st, d2 = cb.call(f'{CL}?t={TOKEN}'); p2 = d2.get('practice') or {}; rq2 = p2.get('request') or {}; rows2 = d2.get('rows') or []
    check('client GET → practice{approved 6 · active 6 · eligible 0 · can_request False · cohort{plans 6 · early 6 · ready 0}} · request{approved_after 6 · pending False}', p2.get('approved') == 6 and p2.get('active') == 6 and p2.get('eligible') == 0 and p2.get('can_request') is False and p2['cohort'].get('plans') == 6 and p2['cohort'].get('early') == 6 and rq2.get('approved_after') == 6 and rq2.get('pending') is False)
    cell = (rows2[0].get('practice') or {}); check('client rows[].practice = {status approved · today 1 · done 0 · total 14 · ready null} — no avg_delta/percent/units keys', cell.get('status') == 'approved' and cell.get('today') == 1 and cell.get('done') == 0 and cell.get('total') == 14 and cell.get('ready') is None and not any(k in cell for k in ('avg_delta', 'units', 'percent', 'mirror')))
    check('client practice.text_ar mentions 6 approved plans + «جاهزية الدفعة 0%»', '6 من 6 طالبًا لهم خطّة تمرين معتمدة' in (p2.get('text_ar') or '') and 'جاهزية الدفعة 0%' in p2['text_ar'])
    st, csv, hd = cb.call(f'{CL}?t={TOKEN}&csv=1', raw=True); lines = csv.split('\r\n'); head = lines[0]
    check('client CSV → header ends with «مِران: الأيام المنجزة,مِران: الجاهزية» · data rows carry 0/14', st == 200 and head.rstrip().endswith('مِران: الأيام المنجزة,مِران: الجاهزية') and any('0/14' in ln for ln in lines[1:]))
    st, e5 = cb.call(CL, {'t': TOKEN, 'action': 'practice_request'}); check('after all approved → practice_request 400 nothing_to_request', st == 400 and e5.get('error') == 'nothing_to_request')
    st, so2 = staff.call(SV); o2 = next((x for x in so2.get('orders', []) if x['id'] == ORDER), {}); check('service order practice_request.pending False · approved_after 6', (o2.get('practice_request') or {}).get('pending') is False and o2['practice_request'].get('approved_after') == 6)
    st, pj3 = staff.call(f'{PR}?invite={sinv["id"]}'); check('admin practice rows[].plan.client_requested True (approved after the client request)', st == 200 and len(pj3.get('rows') or []) == 6 and all((r.get('plan') or {}).get('client_requested') is True for r in pj3['rows']))
    # المتعلّم يرى رسالة الجهة في بطاقة اليوم 1
    st, lv = Client(f'10.{R}.92.70').call(f'/api/miaar/practice?code={L[0][1]}'); card = (lv.get('view') or lv).get('بطاقة_اليوم') or {}
    check('learner practice day-1 card carries the client note (ملاحظة) and no score', 'نثق بكم' in json.dumps(card, ensure_ascii=False))
    # ---- 6) المتصفح — الجهة
    pc = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar').new_page(); pc.on('pageerror', lambda e: errs.append(pc.url + ' ' + str(e)))
    pc.goto(B + f'/miaar/client/{TOKEN}', wait_until='domcontentloaded'); pc.wait_for_selector('[data-testid="cb-miran"]', timeout=30000); pc.wait_for_timeout(500)
    mt = pc.inner_text('[data-testid="cb-miran"]')
    check('client portal: مِران card (can_request=0) · approved 6 · ready 0 · «جاهزية الدفعة» · status «اعتُمدت 6 خطّة بعد طلبكم» · their message · no request form', pc.locator('[data-testid="cb-miran"]').get_attribute('data-can-request') == '0' and pc.inner_text('[data-testid="cb-miran-approved"]') == '6' and 'جاهزية الدفعة' in mt and 'اعتُمدت 6 خطّة بعد طلبكم' in pc.inner_text('[data-testid="cb-miran-status"]') and 'نثق بكم' in mt and pc.locator('[data-testid="cb-miran-req"]').count() == 0)
    check('client table: «مِران» column on 6 rows showing «يوم 1/14 · أنجز 0» · no % inside practice cells', pc.locator('[data-testid="cb-row-practice"]').count() == 6 and 'يوم 1/14' in pc.inner_text('[data-testid="cb-row-practice"] >> nth=0') and '%' not in pc.inner_text('[data-testid="cb-row-practice"] >> nth=0'))
    check('client portal keeps the «لا يغيّر النتائج الرسمية» disclaimer and no learner names in the مِران card', 'لا يغيّر النتائج الرسمية' in mt and 'طالب الجهة' not in mt)
    pc.screenshot(path=f'{OUT}/04-client-miran-approved.png', full_page=True)
    with pc.expect_popup() as pop: pc.click('[data-testid="cb-report"]')
    rp = pop.value; rp.wait_for_load_state('domcontentloaded'); rtxt = rp.inner_text('body')
    check('client A4 report includes «مِران — تدريب ما بعد الحكم» + «اعتُمدت 6 خطّة»', 'مِران — تدريب ما بعد الحكم' in rtxt and 'اعتُمدت 6 خطّة' in rtxt); rp.close()
    pm = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar').new_page(); pm.on('pageerror', lambda e: errs.append(pm.url + ' ' + str(e)))
    pm.goto(B + f'/miaar/client/{TOKEN}', wait_until='domcontentloaded'); pm.wait_for_selector('[data-testid="cb-miran"]', timeout=30000); pm.wait_for_timeout(300)
    check('mobile client portal: no horizontal overflow', pm.evaluate('document.documentElement.scrollWidth <= window.innerWidth + 2')); pm.screenshot(path=f'{OUT}/05-mobile-client.png', full_page=True)
    # ---- 7) خدمة ثانية: الطلب من المتصفح
    st, cs2 = staff.call(SV, {'action': 'create', 'level': 'A1', 'client_name': 'أكاديمية النخيل', 'max_seats': 5, 'identity_mode': 'email', 'auto_pin': False}); sinv2 = cs2.get('invite') or {}; TOKEN2 = (cs2.get('client_url') or '').split('/miaar/client/')[-1]
    for n in range(3):
        st, f = sit(Client(f'10.{R}.92.{40 + n}'), {'code': sinv2['code']}, f'm12b-{n}-{R}@example.com', f'طالب النخيل {n}', 0.0); assert st == 200, f
    rate_all(2)
    pc.goto(B + f'/miaar/client/{TOKEN2}', wait_until='domcontentloaded'); pc.wait_for_selector('[data-testid="cb-miran-req"]', timeout=30000); pc.wait_for_timeout(300)
    check('second client: request form visible · «3 من طلابكم يحتاجون مِران» · button «اطلب مِران لطلابي» · textarea maxlength 200', '3' in pc.inner_text('[data-testid="cb-miran-req"]') and 'اطلب مِران لطلابي' in pc.inner_text('[data-testid="cb-miran-btn"]') and pc.get_attribute('[data-testid="cb-miran-msg"]', 'maxlength') == '200')
    pc.screenshot(path=f'{OUT}/06-client-request-form.png', full_page=True)
    pc.fill('[data-testid="cb-miran-msg"]', 'نحن معكم — خمس بنود يوميًا'); pc.click('[data-testid="cb-miran-btn"]'); pc.wait_for_selector('[data-testid="cb-miran-note"]', timeout=20000); pc.wait_for_timeout(600)
    check('browser request → note «أُرسل طلبك عن 3 طالبًا» · status «بانتظار توقيع الطاقم» · button now «حدّث طلب مِران»', 'أُرسل طلبك عن 3 طالبًا' in pc.inner_text('[data-testid="cb-miran-note"]') and 'بانتظار توقيع الطاقم' in pc.inner_text('[data-testid="cb-miran-status"]') and 'حدّث طلب مِران' in pc.inner_text('[data-testid="cb-miran-btn"]'))
    pc.screenshot(path=f'{OUT}/07-client-requested.png', full_page=True)
    pc.fill('[data-testid="cb-miran-msg"]', 'تحديث: بالتوفيق'); pc.click('[data-testid="cb-miran-btn"]'); pc.wait_for_timeout(1200)
    check('browser second request same day → «حُدّث طلب اليوم»', 'حُدّث طلب اليوم' in pc.inner_text('[data-testid="cb-miran-note"]'))
    nt2 = rest('portal_learner_notices?kind=eq.practice_requested'); check('staff notices practice_requested now 2 (one per order) · second mentions أكاديمية النخيل + 3', len(nt2) == 2 and any('أكاديمية النخيل' in x['title_ar'] and '3' in x['title_ar'] for x in nt2))
    # اللوحة تعرض الطلب الثاني مع زرّ «بلا الرسالة» → اعتماد بلا ملاحظة
    pg.goto(B + f'/admin/miaar/exit?invite={sinv2["id"]}#xb-practice', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="pr-client-request"]', timeout=30000); pg.wait_for_timeout(400)
    check('exit board (second order): banner shows «بالتوفيق» message', 'بالتوفيق' in pg.inner_text('[data-testid="pr-client-msg"]'))
    pg.once('dialog', lambda d: d.accept()); pg.click('[data-testid="pr-approve-all-plain"]'); pg.wait_for_selector('[data-testid="pr-ok"]', timeout=30000); pg.wait_for_timeout(600)
    pl2 = [p for p in rest('miaar_practice_plans?status=eq.approved') if p.get('invite_id') == sinv2['id']]
    check('«اعتمد الكلّ بلا الرسالة» → 3 plans · day 1 has no client note', len(pl2) == 3 and all(not p['days'][0].get('note_ar') for p in pl2))
    pg.screenshot(path=f'{OUT}/08-exit-board-second.png', full_page=True)
    bad = [e for e in errs if 'ChunkLoadError' not in e and 'Loading chunk' not in e]; print('PAGE_ERRS', bad[:3]); check('no page errors', not bad)
    br.close()
print(f"{sum(1 for _, c in ok if c)}/{len(ok)} passed"); sys.exit(0 if all(c for _, c in ok) else 1)
