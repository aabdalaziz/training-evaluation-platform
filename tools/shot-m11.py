# E2E «مِعيار — من أَثَر» م11 «مِران البداية — تدريب ما بعد التشخيص»: الـAPI ثم المتصفح
#  1) تمهيد (كما م10): اعتماد البنك · بذر A1 · اعتماد 4 وحدات · وسم · 3 متعلّمين يجرون تشخيص SYS-SHORT → report.الوحدات (خريطة) · مستوى الالتحاق A1 (يُثبَّت عبر REST للحتمية)
#  2) قرار التسكين من السجلّ (decide → برنامج p1 → شعبة A-101 مدرّبها admin) → استجابة practice{drafted 3} · مسوَّدات kind=placement · المتعلّم لا يرى (404 no_plan)
#     · إشعار مدرّب الشعبة practice_pending (مرّة باليوم · العدد = المعلّق · url ?practice=c1) · GET ledger يحمل practice{} · GET practice ?reports= / ?classroom= · approve واحدة → يُفتح فورًا
#     · approve_all بالشعبة يتخطّى المعتمد · التسكين التلقائي (autoPlaceDue) يصنع مسوَّدة أيضًا · أدلّة/حقائق placement
#  3) المتعلّم: /api/miaar/practice → النوع placement · الجاهزية «واصل التمرين» (بلغة أول درس) · بطاقة النتيجة report.مِران.النوع
#  4) المتصفح: السجلّ ?practice=c1 (شريط «بانتظار توقيعك» · زرّ مِران البداية لكل مسكَّن · اعتماد فردي → شريحة · اعتماد المحدّدين) · صفحة المتعلّم (kicker مِران البداية) · بطاقة النتيجة (صندوق البداية)
import sys, json, urllib.request, urllib.error, os, time
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-m11'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def rest_patch(path, body):
    req = urllib.request.Request(M + '/rest/v1/' + path, data=json.dumps(body).encode(), method='PATCH', headers={'Content-Type': 'application/json', 'Prefer': 'return=representation'}); return urllib.request.urlopen(req).read()
def rest_post(path, body):
    req = urllib.request.Request(M + '/rest/v1/' + path, data=json.dumps(body).encode(), method='POST', headers={'Content-Type': 'application/json', 'Prefer': 'return=representation'}); return urllib.request.urlopen(req).read()
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
staff = Client(f'10.{R}.86.1', tok='tok'); reset(); time.sleep(31)  # ذاكرة الوحدات/البنك 30/90 ث
A = '/api/admin/miaar/bank'; S = '/api/admin/miaar/syllabus'; LG = '/api/admin/miaar/ledger'; PA = '/api/admin/miaar/practice'; PU = '/api/miaar/practice'
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
def run_test(c, blueprint=None, email='x@example.com', name='متعلّمة', pick=0, correct_ratio=0.0):
    body = {'action': 'start', 'instructions_ack': {'version': 1, 'lang': 'ar', 'accepted': True}, 'candidate': {'name': name, 'email': email}}
    if blueprint: body['blueprint'] = blueprint
    st, s = c.call('/api/miaar', body)
    if st != 200: return st, s
    Q = s.get('session', {}).get('form', {}).get('questions') or []
    for k, q in enumerate(Q):
        opts = q.get('options') or [{'id': 'a'}]; chosen = opts[pick % len(opts)]['id']
        if correct_ratio and KEY.get(q['id']) and (k % 10) < round(correct_ratio * 10): chosen = KEY[q['id']]
        elif correct_ratio and KEY.get(q['id']): chosen = next((o['id'] for o in opts if o['id'] != KEY[q['id']]), chosen)
        c.call('/api/miaar', {'action': 'answer', 'questionId': q['id'], 'selectedOptionId': chosen, 'finalize': k == len(Q) - 1})
    st, f = c.call('/api/miaar', {'action': 'finish'}); return st, f
L = {}; NAMES = ['سارة البداية', 'محمد التشخيص', 'ليان الدرس']
for n in range(3):
    em = f'start{n}-{R}@example.com'
    st, f0 = run_test(Client(f'10.{R}.86.{20 + n}'), blueprint='SYS-SHORT', email=em, name=NAMES[n], correct_ratio=0.4); assert st == 200, f0
    L[n] = {'email': em, 'code': f0['access_code'], 'report': f0['report']}
check('3 learners finished the diagnostic (SYS-SHORT) · report.الوحدات tally present · no exit', all(isinstance(L[n]['report'].get('الوحدات'), dict) and L[n]['report'].get('الوحدات') and not L[n]['report'].get('exit') for n in range(3)))
# تثبيت مستوى الالتحاق A1 عبر REST (الحتمية: وحدات التمهيد كلّها A1)
for n in range(3):
    row = rest(f'placement_reports?access_code=eq.{L[n]["code"]}')[0]; rr = dict(row['report']); sm = dict(rr.get('ملخص_التسكين') or {}); sm.update({'المستوى_المثبت': 'A1', 'مستوى_الالتحاق_المقترح': 'A1', 'دون_A1': False}); rr['ملخص_التسكين'] = sm; rr['المستوى_العام'] = 'A1'
    rest_patch(f'placement_reports?id=eq.{row["id"]}', {'report': rr}); L[n]['id'] = row['id']
# متعلّم رابع «دون A1» (غير مؤهّل لمِران البداية) + متعلّم خامس للتسكين التلقائي
E4 = f'pre-{R}@example.com'; E5 = f'auto-{R}@example.com'; base = json.loads(json.dumps(rest(f'placement_reports?id=eq.{L[0]["id"]}')[0]['report']))
base['ميزان_الثقة'] = {'الرمز': 'clear', 'الدرجة': 'واضح'}; base.pop('الموثوقية', None); base['سبب_الانتهاء'] = 'أكملت جميع المستويات حتى النهاية'  # خارج المنطقة الرمادية حتى يسكَّن التلقائي
pre = json.loads(json.dumps(base)); pre['ملخص_التسكين']['دون_A1'] = True; pre['بيانات_المتقدم'] = {**(pre.get('بيانات_المتقدم') or {}), 'الاسم': 'دون الأول'}
auto = json.loads(json.dumps(base)); auto['بيانات_المتقدم'] = {**(auto.get('بيانات_المتقدم') or {}), 'الاسم': 'تلقائي البداية'}
OLD = '2026-10-01T08:00:00Z'
rest_post('placement_reports', [{'id': f'rep-pre-{R}', 'candidate_email': E4, 'access_code': f'ML-PP{R:02d}-2222'[:12], 'report': pre}, {'id': f'rep-auto-{R}', 'candidate_email': E5, 'created_at': OLD, 'access_code': f'ML-AA{R:02d}-2222'[:12], 'report': auto}])
rest_patch('programs?id=eq.p1', {'cefr_level': 'A1'})

# ---- 2) القرار من السجلّ → مسوَّدات + إشعار المدرّب
st, lg0 = staff.call(LG); auto_res = lg0.get('auto') or {}
check('ledger open → lazy auto-place placed the overdue report (auto) · response carries practice{}', st == 200 and auto_res.get('placed', 0) >= 1 and isinstance(lg0.get('practice'), dict))
auto_id = f'rep-auto-{R}'; auto_plans = rest(f'miaar_practice_plans?report_id=eq.{auto_id}')
check('auto placement → draft «مِران البداية» too (kind placement · status draft)', len(auto_plans) == 1 and auto_plans[0]['kind'] == 'placement' and auto_plans[0]['status'] == 'draft')
st, d1 = staff.call(LG, {'action': 'decide', 'report_ids': [L[0]['id'], L[1]['id'], L[2]['id'], f'rep-pre-{R}'], 'level': 'each', 'program_id': 'p1'})
pr = d1.get('practice') or {}
check('decide 4 (3×A1 + 1 دون A1) into p1 → placed · practice{drafted 3 · skipped 1 · notified 1}', st == 200 and d1.get('n') == 4 and d1.get('placed', 0) >= 3 and pr.get('drafted') == 3 and pr.get('skipped') == 1 and pr.get('notified') == 1)
plans = {p['report_id']: p for p in rest('miaar_practice_plans?kind=eq.placement')}
check('drafts: kind placement · level A1 · skill null · 1..4 A1 units · 14 days · no text days (A1 receptive) · created_by admin', all(plans[L[n]['id']]['status'] == 'draft' and plans[L[n]['id']]['level'] == 'A1' and plans[L[n]['id']]['skill'] is None and 1 <= len(plans[L[n]['id']]['units']) <= 4 and all(u.startswith('A1-U') for u in plans[L[n]['id']]['units']) and len(plans[L[n]['id']]['days']) == 14 and not any(d.get('text') for d in plans[L[n]['id']]['days']) and plans[L[n]['id']]['created_by'] == 'u1' for n in range(3)) and f'rep-pre-{R}' not in plans)
st, nf = Client(f'10.{R}.86.9').call(f'{PU}?code={L[0]["code"]}'); check('learner GET before approval → 404 no_plan (draft invisible)', st == 404 and nf.get('error') == 'no_plan')
dec = {d['report_id']: d for d in rest('placement_decisions?decision_status=eq.approved')}; ROOM = dec[L[0]['id']]['classroom_id']
check('decisions placed into a classroom (A-101 · trainer admin)', ROOM == 'c1' and all(dec[L[n]['id']]['classroom_id'] == ROOM for n in range(3)))
notices = rest('portal_learner_notices?kind=eq.practice_pending')
check('trainer notice: one per classroom/day · email admin@upm.edu.sa · title «N خطّة مِران البداية بانتظار توقيعك — شعبة A-101» · url ?practice=c1 · count = all pending (3 manual + 1 auto = 4)', len(notices) == 1 and notices[0]['email'] == 'admin@upm.edu.sa' and notices[0]['title_ar'].startswith('4 خطّة مِران البداية بانتظار توقيعك — شعبة A-101') and notices[0]['url'] == f'/admin/miaar/ledger?practice={ROOM}' and notices[0]['dedupe_key'].startswith(f'practice_pending:{ROOM}:'))
st, nj = staff.call('/api/notices'); kinds = [x['kind'] for x in nj.get('notices') or []]
check('/api/notices (trainer = admin) lists practice_pending with icon ✍️ and kind_ar', st == 200 and 'practice_pending' in kinds and any(x['kind'] == 'practice_pending' and x.get('icon') == '✍️' and x.get('kind_ar') for x in nj['notices']))
st, lg1 = staff.call(LG); pmap = lg1.get('practice') or {}
check('ledger GET → practice map has draft summaries for the 3 (kind placement · status draft) and the auto one', all(pmap.get(L[n]['id'], {}).get('status') == 'draft' and pmap[L[n]['id']]['kind'] == 'placement' for n in range(3)) and pmap.get(auto_id, {}).get('status') == 'draft')
st, gr = staff.call(f'{PA}?reports={L[0]["id"]},{L[1]["id"]}'); rows = gr.get('rows') or []
check('practice GET ?reports= → 2 rows · kind placement · outcome placement · level A1 · plan draft · unit_titles', st == 200 and len(rows) == 2 and all(r['kind'] == 'placement' and r['outcome'] == 'placement' and r['level'] == 'A1' and r['plan'] and r['plan']['status'] == 'draft' and r['unit_titles'] for r in rows))
st, gc = staff.call(f'{PA}?classroom={ROOM}'); check('practice GET ?classroom= → 4 rows (3 manual + auto) — eligible only (دون A1 excluded)', st == 200 and len(gc.get('rows') or []) == 4)
st, bad = staff.call(f'{PA}?classroom=%2Fzz%20x'); check('practice GET ?classroom=malformed → 400', st == 400)
st, none = staff.call(f'{PA}?classroom=zz'); check('practice GET ?classroom=unknown → 200 · rows []', st == 200 and none.get('rows') == [])
st, ap = staff.call(PA, {'action': 'approve', 'report_id': L[0]['id'], 'edits': [{'day': 1, 'note_ar': 'أهلًا بك في أول أسبوعين'}]})
check('approve r0 from the ledger (report_id) → approved · kind placement · start today · day-1 note', st == 200 and ap['plan']['status'] == 'approved' and ap['plan']['kind'] == 'placement' and ap['plan']['days'][0].get('note_ar') == 'أهلًا بك في أول أسبوعين')
ln = rest(f'portal_learner_notices?kind=eq.practice_plan'); check('learner notice practice_plan on approval (no grades in text)', len(ln) == 1 and ln[0]['email'] == L[0]['email'] and '%' not in ln[0]['body_ar'])
st, aa = staff.call(PA, {'action': 'approve_all', 'classroom_id': ROOM}); check('approve_all by classroom → done 3 (r1, r2, auto) · skipped 1 (r0 already approved)', st == 200 and aa.get('done') == 3 and aa.get('skipped') == 1)
st, aa2 = staff.call(PA, {'action': 'approve_all', 'report_ids': [L[1]['id']]}); check('approve_all again by report_ids → done 0 · skipped 1', st == 200 and aa2.get('done') == 0 and aa2.get('skipped') == 1)
st, aa3 = staff.call(PA, {'action': 'approve_all'}); check('approve_all without scope → 400', st == 400)
# ---- 3) المتعلّم
st, v = Client(f'10.{R}.86.10').call(f'{PU}?code={L[0]["code"]}'); card = v.get('بطاقة_اليوم') or {}; Qn = len(((card.get('form') or {}).get('questions')) or [])
check('learner view: النوع placement · اليوم 1 · المهارة null · readiness «واصل التمرين» · sentence without «الإعادة» · card day 1 with 3..5 items · note shown', st == 200 and v.get('النوع') == 'placement' and v.get('اليوم') == 1 and v.get('المهارة') is None and v['الجاهزية']['label_ar'] == 'واصل التمرين' and 'الإعادة' not in v['الجاهزية']['sentence_ar'] and card.get('d') == 1 and 3 <= Qn <= 5 and card.get('note_ar') == 'أهلًا بك في أول أسبوعين')
mirror = v.get('المرآة') or []; check('mirror rows: before = diagnostic unit percent (from report.الوحدات) · now null before practice', len(mirror) >= 1 and all(isinstance(m.get('before'), int) for m in mirror) and all(m.get('now') is None for m in mirror))
st, rc = Client(f'10.{R}.86.11').call(f'/api/miaar?result={L[0]["code"]}'); mi = (rc.get('report') or {}).get('مِران') or {}
check('public result card: report.مِران {النوع placement · الحالة approved · اليوم 1 · الرابط}', st == 200 and mi.get('النوع') == 'placement' and mi.get('الحالة') == 'approved' and mi.get('اليوم') == 1 and mi.get('الرابط') == f'/miaar/practice/{L[0]["code"]}')
st, pm = staff.call(f'{LG}'); pmap = pm.get('practice') or {}
check('ledger practice map after approvals → approved ×4 · today 1', all(pmap[L[n]['id']]['status'] == 'approved' and pmap[L[n]['id']]['today'] == 1 for n in range(3)) and pmap[auto_id]['status'] == 'approved')
# قرار ثانٍ في اليوم نفسه → الإشعار يُحدَّث لا يتكرّر
E6 = f'late-{R}@example.com'; late = json.loads(json.dumps(base)); late['بيانات_المتقدم'] = {**(late.get('بيانات_المتقدم') or {}), 'الاسم': 'متأخّر'}
rest_post('placement_reports', [{'id': f'rep-late-{R}', 'candidate_email': E6, 'access_code': f'ML-LL{R:02d}-2222'[:12], 'report': late}])
st, d2 = staff.call(LG, {'action': 'decide', 'report_ids': [f'rep-late-{R}'], 'level': 'each', 'program_id': 'p1'}); n2 = rest('portal_learner_notices?kind=eq.practice_pending')
check('second decision same day → drafted 1 · still ONE trainer notice, refreshed count = 1 pending (others approved)', st == 200 and (d2.get('practice') or {}).get('drafted') == 1 and len(n2) == 1 and n2[0]['title_ar'].startswith('1 خطّة مِران البداية'))
# ---- 4) المتصفح
errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ca = br.new_context(viewport={'width': 1380, 'height': 1000}, locale='ar'); pa = ca.new_page(); pa.on('pageerror', lambda e: errs.append(str(e)))
    pa.goto(B + '/login'); pa.fill('input[type=email]', 'admin@upm.edu.sa'); pa.click('[data-testid="login-mode-password"]'); pa.fill('input[type=password]', 'x'); pa.click('button[type=submit]'); pa.wait_for_url('**/dashboard', timeout=20000)
    pa.goto(B + f'/admin/miaar/ledger?practice={ROOM}', wait_until='domcontentloaded'); pa.wait_for_selector('[data-testid="lg-row"]', timeout=30000); pa.wait_for_timeout(800)
    check('ledger ?practice=c1 → «بانتظار توقيعك» bar with bulk button · decision filter approved', pa.locator('[data-testid="lg-practice-room"]').count() == 1 and pa.locator('[data-testid="lg-practice-room-go"]').count() == 1 and pa.locator('[data-testid="lg-decision"]').input_value() == 'approved')
    late_row = pa.locator(f'[data-testid="lg-row"][data-email="{E6}"]'); r0_row = pa.locator(f'[data-testid="lg-row"][data-email="{L[0]["email"]}"]')
    check('decided rows: approved learner shows «مِران» chip (day 1/14) · pending learner shows «اعتمد مِران البداية (مسوَّدة جاهزة)» button', r0_row.locator('[data-testid="lg-practice"]').count() == 1 and 'يوم 1/14' in r0_row.inner_text() and late_row.locator('[data-testid="lg-practice-go"]').count() == 1 and 'مسوَّدة جاهزة' in late_row.inner_text())
    pa.screenshot(path=f'{OUT}/01-ledger-practice-room.png', full_page=True)
    late_row.locator('[data-testid="lg-practice-go"]').click(); pa.wait_for_selector('[data-testid="lg-ok"]', timeout=15000); pa.wait_for_timeout(600)
    check('click «مِران البداية» on a row → approved (ok banner · chip appears · DB approved)', 'اعتُمدت 1' in pa.inner_text('[data-testid="lg-ok"]') and pa.locator(f'[data-testid="lg-row"][data-email="{E6}"] [data-testid="lg-practice"]').count() == 1 and rest(f'miaar_practice_plans?report_id=eq.rep-late-{R}')[0]['status'] == 'approved')
    pa.screenshot(path=f'{OUT}/02-ledger-approved-chip.png', full_page=True)
    # دفعة: قرار لمتعلّمَين جديدَين ثم تحديدهما → «اعتمد مِران البداية للمحدّدين»
    E7 = f'bulk1-{R}@example.com'; E8 = f'bulk2-{R}@example.com'
    rest_post('placement_reports', [{'id': f'rep-b1-{R}', 'candidate_email': E7, 'access_code': f'ML-B1{R:02d}-2222'[:12], 'report': base}, {'id': f'rep-b2-{R}', 'candidate_email': E8, 'access_code': f'ML-B2{R:02d}-2222'[:12], 'report': base}])
    st, d3 = staff.call(LG, {'action': 'decide', 'report_ids': [f'rep-b1-{R}', f'rep-b2-{R}'], 'level': 'each', 'program_id': 'p1'}); assert st == 200, d3
    pa.reload(wait_until='domcontentloaded'); pa.wait_for_selector(f'[data-testid="lg-row"][data-email="{E7}"]', timeout=30000); pa.wait_for_timeout(500)
    pa.locator(f'[data-testid="lg-row"][data-email="{E7}"] [data-testid="lg-check"]').check(); pa.locator(f'[data-testid="lg-row"][data-email="{E8}"] [data-testid="lg-check"]').check(); pa.locator(f'[data-testid="lg-row"][data-email="{L[0]["email"]}"] [data-testid="lg-check"]').check(); pa.wait_for_timeout(300)
    check('select 3 (2 pending + 1 already approved) → bulk button counts only the 2 pending', pa.locator('[data-testid="lg-practice-all"]').count() == 1 and '(2)' in pa.inner_text('[data-testid="lg-practice-all"]'))
    pa.once('dialog', lambda d: d.accept()); pa.click('[data-testid="lg-practice-all"]'); pa.wait_for_selector('[data-testid="lg-ok"]', timeout=15000); pa.wait_for_timeout(600)
    check('bulk approve → «اعتُمدت 2» · both rows show chips', 'اعتُمدت 2' in pa.inner_text('[data-testid="lg-ok"]') and pa.locator(f'[data-testid="lg-row"][data-email="{E7}"] [data-testid="lg-practice"]').count() == 1 and pa.locator(f'[data-testid="lg-row"][data-email="{E8}"] [data-testid="lg-practice"]').count() == 1)
    pa.screenshot(path=f'{OUT}/03-ledger-bulk.png', full_page=True)
    # المتعلّم
    cl = br.new_context(viewport={'width': 1200, 'height': 1000}, locale='ar'); pl = cl.new_page(); pl.on('pageerror', lambda e: errs.append(str(e)))
    pl.goto(B + f'/miaar/practice/{L[0]["code"]}'); pl.wait_for_selector('[data-testid="mp-card"]', timeout=30000); pl.wait_for_timeout(400)
    kick = pl.inner_text('[data-testid="mp-kicker"]'); rd_ = pl.inner_text('[data-testid="mp-ready"]')
    check('learner page: kicker «مِران البداية · أول أسبوعين قبل أول درس» · data-kind placement · 14 chips · readiness «واصل التمرين» · trainer note · mirror «يوم التشخيص» · footer «تقرير تشخيصك»', 'مِران البداية' in kick and pl.get_attribute('[data-testid="mp-kicker"]', 'data-kind') == 'placement' and pl.locator('[data-testid="mp-day"]').count() == 14 and 'واصل التمرين' in rd_ and 'أهلًا بك' in pl.inner_text('[data-testid="mp-card"]') and 'يوم التشخيص' in pl.inner_text('body') and 'تقرير تشخيصك' in pl.inner_text('body'))
    pl.screenshot(path=f'{OUT}/04-learner-start-day1.png', full_page=True)
    pl.locator('[data-testid="mp-q"] >> nth=0 >> [data-testid="mp-opt"] >> nth=0').click(); pl.wait_for_selector('[data-testid="mp-fb"]', timeout=15000)
    check('answer an item → instant feedback (same engine as م10)', pl.locator('[data-testid="mp-fb"]').count() == 1)
    pl.goto(B + f'/miaar/result/{L[0]["code"]}'); pl.wait_for_selector('[data-testid="mi-practice"]', timeout=30000); pl.wait_for_timeout(300)
    bx = pl.inner_text('[data-testid="mi-practice"]')
    check('diagnostic result card (no exit) → «مِران البداية» box · data-kind placement · open link · «قبل أول درس» note', pl.get_attribute('[data-testid="mi-practice"]', 'data-kind') == 'placement' and 'مِران البداية' in bx and 'أول درس' in bx and (pl.get_attribute('[data-testid="mi-practice-open"]', 'href') or '') == f'/miaar/practice/{L[0]["code"]}')
    pl.screenshot(path=f'{OUT}/05-result-start-box.png', full_page=True)
    # إشعارات المدرّب في «تنبيهاتي»
    pa.goto(B + '/me', wait_until='domcontentloaded'); pa.wait_for_timeout(1500)
    check('trainer /me shows the «خطط مِران البداية» notice linking to the ledger', pa.locator(f'a[href*="/admin/miaar/ledger?practice={ROOM}"]').count() >= 1 or 'مِران البداية بانتظار توقيعك' in pa.inner_text('body'))
    pa.screenshot(path=f'{OUT}/06-trainer-notice.png', full_page=True)
    errs = [e for e in errs if 'Minified React error #425' not in e]; check('no page errors', not errs); print(errs[:3])
    br.close()
print(f"\n== {sum(1 for _, c in ok if c)}/{len(ok)} PASS"); sys.exit(0 if all(c for _, c in ok) else 1)
