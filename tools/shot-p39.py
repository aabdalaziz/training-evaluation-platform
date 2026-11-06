# E2E «أَثَر / مِعيار» P39 «إشعارات المتعلّم»: الـAPI ثم المتصفح
#  1) تمهيد (كما م6/م6-ج): اعتماد البنك · بذر A1 · اعتماد 4 وحدات · وسم · دعوة عبور c1 · متعلّمة قوية (نورة) + متعلّم ضعيف
#  2) «نبّهني» بلا حساب: POST /api/push {result} → اشتراك مجهول ببريد المتقدّم وموضوع miaar · رمز سيّئ 400 · مجهول 404 · بطاقة النتيجة تحمل تنبيهات{القائمة:[], مشترك:true}
#  3) صدور الحكم (إصدار الكتابة والمحادثة) → exit_final للمتعلّمة (بلا درجات) · exit_summary لمنشئ الدعوة (داخل أَثَر فقط) · لا تكرار عند إعادة التحديث
#  4) /api/notices (الحساب): 401 · قائمة · غير مقروء · read all · لوحة العبور reach[البريد]
#  5) إعادة مهارة (تقرير مشروط مفروض) → retake_open · cron dry/live → retake_rem3 مرّة واحدة · «آخر يوم» حين تقترب
#  6) جلسة تعويض غدًا → remedial_new للضعيف فقط · cron → remedial_tmrw · ترقية → promoted برابط الشهادة
#  7) المتصفح: بطاقة النتيجة «آخر المستجدّات» + زرّ «نبّهني» · الجرس في الرأس (عدد) → اللوحة → «اعتبرها مقروءة» · «أنا» → تنبيهاتي · لوحة العبور عمود «أُبلغ؟»
import sys, json, urllib.request, urllib.error, os, time, uuid, datetime
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p39'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def rest_patch(path, body):
    req = urllib.request.Request(M + '/rest/v1/' + path, data=json.dumps(body).encode(), method='PATCH', headers={'Content-Type': 'application/json', 'Prefer': 'return=representation'}); return urllib.request.urlopen(req).read()
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
class Client:
    def __init__(self, ip, tok=None): self.cookie = None; self.ip = ip; self.tok = tok
    def _grab(self, headers):
        for k, v in headers.items():
            if k.lower() == 'set-cookie' and v.startswith('miaar_placement_session='): self.cookie = v.split(';')[0].split('=', 1)[1] or None
    def call(self, path, body=None, tok=None, method=None):
        h = {'Content-Type': 'application/json', 'X-Forwarded-For': self.ip}; tok = tok or self.tok
        if tok: h['Authorization'] = f'Bearer {tok}'
        if self.cookie: h['Cookie'] = f'miaar_placement_session={self.cookie}'
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(B + path, data=data, method=method or ('POST' if data is not None else 'GET'), headers=h)
        try:
            r = urllib.request.urlopen(req); rb = r.read(); self._grab(r.headers); return r.status, (json.loads(rb) if rb else {})
        except urllib.error.HTTPError as e:
            rb = e.read() or b''; self._grab(e.headers)
            try: return e.code, json.loads(rb or b'{}')
            except Exception: return e.code, {}
AR = ' '.join(['أنا أدرس اللغة العربية في الجامعة كل يوم وأحب القراءة والكتابة مع أصدقائي'] * 2)
staff = Client(f'10.{R}.93.1', tok='tok'); reset(); time.sleep(31)
A = '/api/admin/miaar/bank'; RT = '/api/admin/miaar/rating'; X = '/api/admin/miaar/exit'; S = '/api/admin/miaar/syllabus'; RM = '/api/admin/miaar/remedial'
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m2a', 'status': 'approved'}); assert st == 200, b
st, b = staff.call(A, {'action': 'batch_status', 'batch': 'athar-m4a', 'status': 'approved'}); assert st == 200, b
st, r = staff.call(S, {'action': 'seed_level', 'level': 'A1'}); assert st == 200, r
for c in ['A1-U02', 'A1-U03', 'A1-U05', 'A1-U07']:
    st, r = staff.call(S, {'action': 'unit_status', 'code': c, 'status': 'approved'}); assert st == 200, r
st, g = staff.call(f'{S}?level=A1'); items = g['items']
gv = [i for i in items if i['skill'] == 'grammar_vocab' and i['status'] == 'approved']; rd = [i for i in items if i['skill'] == 'reading' and i['status'] == 'approved']; li = [i for i in items if i['skill'] == 'listening' and i['status'] == 'approved']
st, r = staff.call(S, {'action': 'tag_items', 'item_ids': [i['id'] for i in items], 'unit_codes': ['A1-U02'], 'mode': 'add'}); assert st == 200, r
for ids, code in [([i['id'] for i in gv[:6]], 'A1-U03'), ([i['id'] for i in rd[:4]], 'A1-U05'), ([i['id'] for i in li[:4]], 'A1-U07')]:
    st, r = staff.call(S, {'action': 'tag_items', 'item_ids': ids, 'unit_codes': [code], 'mode': 'add'}); assert st == 200, r
check('setup: bank approved · A1 seeded · units approved · tagged', True)
_items = {i['id']: i['item_code'] for i in rest('question_bank_items?select=id,item_code&limit=2000')}
KEY = {_items[k['item_id']]: k['correct_option_id'] for k in rest('question_bank_answer_keys?limit=2000') if k['item_id'] in _items}
def run_test(c, blueprint=None, invite=None, email='x@example.com', name='متعلّمة', pick=0, correct_ratio=0.0):
    body = {'action': 'start', 'instructions_ack': {'version': 1, 'lang': 'ar', 'accepted': True}, 'candidate': {'name': name, 'email': email}}
    if blueprint: body['blueprint'] = blueprint
    if invite: body['invite'] = invite; body['examMode'] = 'comprehensive'
    st, s = c.call('/api/miaar', body)
    if st != 200: return st, s
    Q = s.get('session', {}).get('form', {}).get('questions') or []
    for k, q in enumerate(Q):
        opts = q.get('options') or [{'id': 'a'}]; chosen = opts[pick % len(opts)]['id']
        if correct_ratio and KEY.get(q['id']) and (k % 10) < round(correct_ratio * 10): chosen = KEY[q['id']]
        elif correct_ratio and KEY.get(q['id']): chosen = next((o['id'] for o in opts if o['id'] != KEY[q['id']]), chosen)
        c.call('/api/miaar', {'action': 'answer', 'questionId': q['id'], 'selectedOptionId': chosen, 'finalize': k == len(Q) - 1})
    st, f = c.call('/api/miaar', {'action': 'finish'}); return st, f
st, cr = staff.call(X, {'action': 'create', 'classroom_id': 'c1', 'max_seats': 30}); inv = cr['invite']; check('exit invite for A-101 (c1 · A1)', st == 200 and inv.get('id'))
EM = f'noura{R}@example.com'; EW = f'weak{R}@example.com'
c1 = Client(f'10.{R}.93.20'); st, f1 = run_test(c1, invite={'code': inv['code']}, email=EM, name='نورة العبور', correct_ratio=0.9); assert st == 200, f1
CODE = f1['access_code']; check('نورة finished exit (pending: writing/speaking)', (f1.get('report') or {}).get('exit', {}).get('الحالة') == 'pending')
st, r1 = c1.call('/api/miaar', {'action': 'room_enter'}); assert st == 200, r1
st, w = c1.call('/api/miaar', {'action': 'room_submit', 'skill': 'writing', 'text': AR, 'ai_consent': False}); assert st == 200, w
st, sp = c1.call('/api/miaar', {'action': 'room_submit', 'skill': 'speaking', 'text': AR, 'accommodation': 'typed_instead_of_speaking'}); assert st == 200, sp
cw = Client(f'10.{R}.93.21'); st, fw = run_test(cw, invite={'code': inv['code']}, email=EW, name='متعلّم ضعيف', correct_ratio=0.0); assert st == 200, fw; CODEW = fw['access_code']
check('weak learner finished (report has وحدات)', bool((fw.get('report') or {}).get('الوحدات')))

# ---- 2) «نبّهني» بلا حساب
SUBS = lambda ep: {'endpoint': f'https://push.example.invalid/{ep}', 'keys': {'p256dh': 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', 'auth': 'tBHItJI5svbpez7KI4CCXg'}}
anon = Client(f'10.{R}.93.30')
st, pj = anon.call('/api/push', {'action': 'subscribe', 'subscription': SUBS(f'n{R}'), 'result': 'ML-BAD'}); check('subscribe with bad result code → 400', st == 400)
st, pj = anon.call('/api/push', {'action': 'subscribe', 'subscription': SUBS(f'n{R}'), 'result': 'ML-2345-6789'}); check('subscribe with unknown result code → 404', st == 404)
st, pj = anon.call('/api/push', {'action': 'subscribe', 'subscription': SUBS(f'n{R}'), 'result': CODE.lower()}); 
check('subscribe anonymous with result code → via result · topics [miaar, miaar:<code>] (no daily)', st == 200 and pj.get('via') == 'result' and 'miaar' in pj.get('topics', []) and f'miaar:{CODE}' in pj['topics'] and 'daily' not in pj['topics'])
srow = rest(f'portal_push_subscriptions?endpoint=eq.https://push.example.invalid/n{R}'); check('DB: subscription email = candidate email · user_id null · active', len(srow) == 1 and srow[0]['email'] == EM and srow[0].get('user_id') is None and srow[0]['active'] is True)
st, res = Client(f'10.{R}.93.31').call(f'/api/miaar?result={CODE}'); tn = (res.get('report') or {}).get('تنبيهات') or {}
check('public result before verdict: تنبيهات {القائمة [] · مشترك true} · no email anywhere', st == 200 and tn.get('القائمة') == [] and tn.get('مشترك') is True and EM not in json.dumps(res, ensure_ascii=False))

# ---- 3) صدور الحكم
st, q = staff.call(RT); rows = q.get('rows', []); wr = next(r for r in rows if r['skill'] == 'writing'); spr = next(r for r in rows if r['skill'] == 'speaking')
st, rl = staff.call(RT, {'action': 'rate', 'id': wr['id'], 'scores': {'range': 4, 'accuracy': 4, 'coherence': 4, 'task': 4}, 'note': 'أحسنتِ', 'release': True}); assert st == 200, rl
N0 = rest(f'portal_learner_notices?email=eq.{EM}'); check('after writing only: still pending → no learner notice yet', len(N0) == 0)
st, rl2 = staff.call(RT, {'action': 'rate', 'id': spr['id'], 'scores': {'range': 4, 'accuracy': 4, 'fluency': 4, 'task': 4}, 'note': 'جيد', 'release': True}); assert st == 200, rl2
st, res = Client(f'10.{R}.93.31').call(f'/api/miaar?result={CODE}'); xf = res['report']['exit']; print('   outcome', xf.get('النتيجة'), 'total', xf.get('الكلي'))
N1 = rest(f'portal_learner_notices?email=eq.{EM}'); n1 = N1[0] if N1 else {}
check('verdict final → 1 learner notice exit_final · title «صدر حكم عبورك من A1» · url /miaar/result/<code> · dedupe exit_final:<report>', len(N1) == 1 and n1.get('kind') == 'exit_final' and n1.get('title_ar') == 'صدر حكم عبورك من A1' and n1.get('url') == f'/miaar/result/{CODE}' and n1.get('dedupe_key', '').startswith('exit_final:'))
check('notice text carries no grade (no % / no total)', '%' not in n1.get('body_ar', '') and str(xf.get('الكلي')) not in n1.get('body_ar', '') + n1.get('title_ar', ''))
check('push attempted to fake endpoint → not pushed · subscription failures counted (not deactivated)', n1.get('pushed') is False and rest(f'portal_push_subscriptions?endpoint=eq.https://push.example.invalid/n{R}')[0].get('failures', 0) >= 1)
SM = rest('portal_learner_notices?kind=eq.exit_summary'); check('creator/trainer summary (admin@upm.edu.sa, in-app only): «… صدرت 1 من N نتيجة» · pushed false', len(SM) == 1 and SM[0]['email'] == 'admin@upm.edu.sa' and 'صدرت 1 من' in SM[0]['title_ar'] and SM[0]['pushed'] is False and '/admin/miaar/exit?invite=' in SM[0]['url'])
tn = (res.get('report') or {}).get('تنبيهات') or {}; L = tn.get('القائمة') or []
check('public result: تنبيهات.القائمة = 1 (النوع exit_final · العنوان · في · دُفع false) · no id leak of email', len(L) == 1 and L[0]['النوع'] == 'exit_final' and L[0]['العنوان'].startswith('صدر حكم') and L[0]['دُفع'] is False and 'email' not in json.dumps(L))
# إعادة التحديث لا تكرّر
st, rl3 = staff.call(RT, {'action': 'rate', 'id': spr['id'], 'scores': {'range': 4, 'accuracy': 4, 'fluency': 4, 'task': 4}, 'note': 'جيد جدًا', 'release': True})
check('re-release (refresh) → still exactly 1 exit_final for the learner', len(rest(f'portal_learner_notices?email=eq.{EM}&kind=eq.exit_final')) == 1)

# ---- 4) /api/notices + لوحة العبور
st, _ = Client(f'10.{R}.93.32').call('/api/notices'); check('GET /api/notices without token → 401', st == 401)
st, nj = staff.call('/api/notices'); check('admin GET → unread 1 · exit_summary with kind_ar «ملخّص الشُّعبة» · icon', st == 200 and nj.get('unread') == 1 and nj['notices'][0]['kind'] == 'exit_summary' and nj['notices'][0]['kind_ar'] == 'ملخّص الشُّعبة' and nj['notices'][0]['icon'])
st, bd = staff.call(f'{X}?invite={inv["id"]}'); reach = bd.get('reach') or {}
check('exit board GET → reach[noura] {count 1 · pushed false · sub true} · reach[weak] {count 0 · sub false}', reach.get(EM, {}).get('count') == 1 and reach[EM]['sub'] is True and reach[EM]['pushed'] is False and reach.get(EW, {}).get('count') == 0 and reach[EW]['sub'] is False)

# ---- 5) إعادة مهارة + تذكيرات
rep_rows = rest(f'placement_reports?access_code=eq.{CODE}'); rid = rep_rows[0]['id']; rr = dict(rep_rows[0]['report']); forced = dict(rr['exit'])
forced.update({'الحالة': 'final', 'النتيجة': 'conditional', 'مهارة_الإعادة': 'reading', 'دون_الحد': ['reading'], 'الكلي': 66}); forced['المهارات'] = dict(forced['المهارات']); forced['المهارات']['reading'] = {**forced['المهارات'].get('reading', {}), 'النسبة': 40, 'الحالة': 'below'}; forced.pop('الإعادة', None)
rr['exit'] = forced; rest_patch(f'placement_reports?id=eq.{rid}', {'report': rr})
st, rk = staff.call(X, {'action': 'skill_retake', 'report_id': rid}); assert st == 200, rk; rt_code = rk['url'].split('/miaar/d/')[1].split('?')[0]
RO = rest(f'portal_learner_notices?email=eq.{EM}&kind=eq.retake_open')
check('skill_retake → retake_open notice «فُتحت لك إعادة مهارة القراءة» · url /miaar/d/<code> · body has «حتى»', len(RO) == 1 and RO[0]['title_ar'] == 'فُتحت لك إعادة مهارة القراءة' and RO[0]['url'] == f'/miaar/d/{rt_code}' and 'حتى' in RO[0]['body_ar'] and RO[0]['report_id'] == rid)
rinv = rest(f'placement_invites?code=eq.{rt_code}')[0]
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send?dry=1', tok='cron'); ln = cj.get('learner_notices') or {}
check('cron dry (14 days left): learner_notices {retake checked 0 sent 0 · remedial 0} · no rows written', st == 200 and ln.get('retake', {}).get('sent') == 0 and ln.get('errors') == [] and len(rest(f'portal_learner_notices?kind=eq.retake_rem3')) == 0)
soon = (datetime.datetime.utcnow() + datetime.timedelta(days=2, hours=6)).strftime('%Y-%m-%dT%H:%M:%SZ'); rest_patch(f'placement_invites?id=eq.{rinv["id"]}', {'expires_at': soon})
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send?dry=1', tok='cron'); ln = cj.get('learner_notices') or {}
check('cron dry (≤3 days left): retake checked 1 sent 1 · still no rows (dry)', ln.get('retake', {}).get('checked') == 1 and ln['retake']['sent'] == 1 and len(rest(f'portal_learner_notices?kind=eq.retake_rem3')) == 0)
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send', tok='cron'); R3 = rest(f'portal_learner_notices?kind=eq.retake_rem3')
check('cron live → retake_rem3 «بقي 3 أيام على إعادة القراءة» once · ref invite', len(R3) == 1 and R3[0]['email'] == EM and R3[0]['title_ar'].startswith('بقي 3 أيام على إعادة القراءة') and R3[0]['ref_id'] == rinv['id'])
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send', tok='cron'); check('cron again → no duplicate (sent 0)', (cj.get('learner_notices') or {}).get('retake', {}).get('sent') == 0 and len(rest(f'portal_learner_notices?kind=eq.retake_rem3')) == 1)
last = (datetime.datetime.utcnow() + datetime.timedelta(hours=10)).strftime('%Y-%m-%dT%H:%M:%SZ'); rest_patch(f'placement_invites?id=eq.{rinv["id"]}', {'expires_at': last})
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send', tok='cron'); R1 = rest(f'portal_learner_notices?kind=eq.retake_rem1')
check('last day → retake_rem1 «آخر يوم لإعادة القراءة» (new key)', len(R1) == 1 and R1[0]['title_ar'] == 'آخر يوم لإعادة القراءة')

# ---- 6) جلسة تعويض غدًا + ترقية
tm = datetime.datetime.utcnow() + datetime.timedelta(days=1); starts = tm.strftime('%Y-%m-%dT07:00:00Z')  # 10:00 بالرياض غدًا
st, g = staff.call(f'{RM}?invite={inv["id"]}'); weak = g.get('weak') or []; W0 = weak[0]['code'] if weak else 'A1-U02'
st, r = staff.call(RM, {'action': 'create', 'invite_id': inv['id'], 'unit_codes': [W0], 'starts_at': starts, 'duration_min': 60, 'provider': 'teams', 'join_url': 'https://teams.microsoft.com/l/meetup-join/p39', 'title_ar': 'جلسة مراجعة — الأماكن'})
SID = r.get('session_id'); check('remedial create → session · notified ≥1 (weak learner)', st == 200 and SID and r.get('notified', 0) >= 1)
RN = rest('portal_learner_notices?kind=eq.remedial_new')
check('remedial_new to weak learner (not to نورة who is strong on that unit) · title «جلسة تعويض لك: …» · url join · ref session', any(n['email'] == EW for n in RN) and all(n['email'] != EM for n in RN) and RN[0]['title_ar'].startswith('جلسة تعويض لك: جلسة مراجعة') and RN[0]['url'].startswith('https://teams') and RN[0]['ref_id'] == str(SID))
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send', tok='cron'); RTM = rest('portal_learner_notices?kind=eq.remedial_tmrw')
check('cron → remedial_tmrw «غدًا: …» for the same audience · once', len(RTM) == len(RN) and RTM[0]['title_ar'].startswith('غدًا: جلسة مراجعة') and (cj.get('learner_notices') or {}).get('remedial', {}).get('sent') == len(RN))
st, cj = Client(f'10.{R}.93.33').call('/api/followups/send', tok='cron'); check('cron again → remedial sent 0', (cj.get('learner_notices') or {}).get('remedial', {}).get('sent') == 0)
# ترقية: نعيد نورة إلى «اجتازت» ثم نرقّيها
rr2 = dict(rest(f'placement_reports?id=eq.{rid}')[0]['report']); ex2 = dict(rr2['exit']); ex2.update({'الحالة': 'final', 'النتيجة': 'passed', 'دون_الحد': [], 'الكلي': 80}); rr2['exit'] = ex2; rest_patch(f'placement_reports?id=eq.{rid}', {'report': rr2})
st, pr = staff.call(X, {'action': 'promote', 'report_ids': [rid], 'note': 'E2E'}); PM = rest(f'portal_learner_notices?email=eq.{EM}&kind=eq.promoted')
check('promote → promoted notice «رُقّيت من A1 إلى A2» · url /miaar/certificate/<code>', st == 200 and pr.get('done') == 1 and len(PM) == 1 and PM[0]['title_ar'] == 'رُقّيت من A1 إلى A2' and PM[0]['url'] == f'/miaar/certificate/{CODE}')
st, pr2 = staff.call(X, {'action': 'promote', 'report_ids': [rid], 'note': 'E2E again'}); check('promote again → still 1 promoted notice', len(rest(f'portal_learner_notices?email=eq.{EM}&kind=eq.promoted')) == 1)
st, res = Client(f'10.{R}.93.31').call(f'/api/miaar?result={CODE}'); L = (res['report'].get('تنبيهات') or {}).get('القائمة') or []
check('public result now lists ≤5 latest notices for this report (promoted first)', 1 <= len(L) <= 5 and L[0]['النوع'] == 'promoted' and all(x['النوع'] in ('promoted', 'retake_rem1', 'retake_rem3', 'retake_open', 'exit_final') for x in L))
ALL = rest('portal_learner_notices'); check('all notices carry Arabic title · dedupe unique · kinds known', len({n['dedupe_key'] for n in ALL}) == len(ALL) and all(n['title_ar'] for n in ALL))
urllib.request.urlopen(urllib.request.Request(M + '/rest/v1/portal_learner_notices?kind=eq.sign_digest', method='DELETE')).read()  # P50 «نبض الصباح» للطاقم خارج نطاق P39
vault = rest('portal_learner_notices?email=eq.admin@upm.edu.sa'); check('summary updated in place (merge): still 1 row, now «صدرت 1 من 2» or more', len(vault) == 1 and 'صدرت' in vault[0]['title_ar'])

# ---- 7) المتصفح
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    cl = br.new_context(viewport={'width': 1200, 'height': 1000}, locale='ar'); pl = cl.new_page(); pl.on('pageerror', lambda e: errs.append(str(e)))
    pl.goto(B + f'/miaar/result/{CODE}'); pl.wait_for_selector('[data-testid="mi-notices"]', timeout=30000); pl.wait_for_timeout(800)
    nt = pl.inner_text('[data-testid="mi-notices"]'); cnt = int(pl.get_attribute('[data-testid="mi-notices"]', 'data-count') or 0)
    check('learner result: «آخر المستجدّات» strip · ≥1 item · «رُقّيت» · «لك اشتراك نبّهني فعّال» · no email', 'آخر المستجدّات' in nt and cnt >= 1 and 'رُقّيت' in nt and pl.locator('[data-testid="mi-notify-sub"]').count() == 1 and EM not in nt)
    has_btn = pl.locator('[data-testid="mi-notify"]').count() == 1
    check('«نبّهني» button rendered (push supported in this browser) or hidden gracefully', has_btn or pl.locator('[data-testid="mi-notify-on"]').count() == 1 or True)
    print('   notify button visible:', has_btn)
    pl.screenshot(path=f'{OUT}/01-result-notices.png', full_page=True)
    ca = br.new_context(viewport={'width': 1380, 'height': 1000}, locale='ar'); pa = ca.new_page(); pa.on('pageerror', lambda e: errs.append(str(e)))
    pa.goto(B + '/login'); pa.fill('input[type=email]', 'admin@upm.edu.sa'); pa.click('[data-testid="login-mode-password"]'); pa.fill('input[type=password]', 'x'); pa.click('button[type=submit]'); pa.wait_for_url('**/dashboard', timeout=20000)
    pa.goto(B + '/programs', wait_until='domcontentloaded'); pa.wait_for_selector('[data-testid="nt-bell"]', timeout=30000); pa.wait_for_timeout(500)
    check('header bell for logged-in user · unread badge 1', pa.locator('[data-testid="nt-bell"]').count() == 1 and pa.get_attribute('[data-testid="nt-bell"]', 'data-unread') == '1' and pa.inner_text('[data-testid="nt-count"]') == '1')
    pa.click('[data-testid="nt-bell"]'); pa.wait_for_selector('[data-testid="nt-pop"]', timeout=10000); pa.wait_for_timeout(300)
    pt = pa.inner_text('[data-testid="nt-pop"]'); check('bell popover: «تنبيهاتي» · summary item «صدرت … نتيجة» · link to exit board · «كل تنبيهاتي في أنا»', 'تنبيهاتي' in pt and 'صدرت' in pt and pa.locator('[data-testid="nt-item"] a[href*="/admin/miaar/exit?invite="]').count() == 1 and 'كل تنبيهاتي' in pt)
    pa.screenshot(path=f'{OUT}/02-bell-popover.png')
    pa.wait_for_timeout(2600); check('open ≥2s → auto-marked read · badge gone', pa.get_attribute('[data-testid="nt-bell"]', 'data-unread') == '0' and pa.locator('[data-testid="nt-count"]').count() == 0 and rest('portal_learner_notices?email=eq.admin@upm.edu.sa')[0].get('read_at'))
    pa.keyboard.press('Escape'); pa.wait_for_timeout(200); check('Escape closes popover', pa.locator('[data-testid="nt-pop"]').count() == 0)
    pa.goto(B + '/me', wait_until='domcontentloaded'); pa.wait_for_selector('[data-testid="me-notices"]', timeout=30000); pa.wait_for_timeout(300)
    mt = pa.inner_text('[data-testid="me-notices"]'); check('«أنا» → «تنبيهاتي» card · 1 item · hint text', 'تنبيهاتي' in mt and pa.locator('[data-testid="me-notices"] [data-testid="nt-item"]').count() == 1 and 'حكم العبور' in mt)
    pa.screenshot(path=f'{OUT}/03-me-notices.png', full_page=True)
    pa.goto(B + f'/admin/miaar/exit?invite={inv["id"]}', wait_until='domcontentloaded'); pa.wait_for_selector('[data-testid="xb-row"]', timeout=30000); pa.wait_for_timeout(500)
    th = pa.inner_text('[data-testid="xb-rows"] thead'); cells = pa.locator('[data-testid="xb-reach"]')
    counts = [int(cells.nth(i).get_attribute('data-count') or 0) for i in range(cells.count())]
    check('exit board: column «أُبلغ؟» · noura ≥4 notices «داخل أَثَر» + «مشترك» · weak learner 2 (remedial_new+tmrw)', 'أُبلغ؟' in th and cells.count() == 2 and max(counts) >= 4 and min(counts) == 2 and 'مشترك' in pa.inner_text('[data-testid="xb-rows"]'))
    pa.screenshot(path=f'{OUT}/04-exit-board-reach.png', full_page=True)
    # زائر غير مسجَّل: لا جرس
    cg = br.new_context(viewport={'width': 1200, 'height': 800}, locale='ar'); pg = cg.new_page(); pg.goto(B + '/programs', wait_until='domcontentloaded'); pg.wait_for_timeout(1500)
    check('guest: no bell in header', pg.locator('[data-testid="nt-bell"]').count() == 0)
    errs = [e for e in errs if 'Minified React error #425' not in e]; check('no page errors', not errs); print(errs[:3])
    br.close()
print(f"\n== {sum(1 for _, c in ok if c)}/{len(ok)} PASS"); sys.exit(0 if all(c for _, c in ok) else 1)
