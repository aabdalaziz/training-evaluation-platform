# E2E «مِعيار — من أَثَر» م10 «مِران — تدريب ما بين الحكم والإعادة»: الـAPI ثم المتصفح
#  1) تمهيد (كما م6-ج): اعتماد البنك · بذر A1 · اعتماد 4 وحدات · وسم · دعوة عبور c1 · 3 متعلّمين ضعاف → وحدات حمراء → أحكام نهائية (مشروط قراءة · مشروط كتابة · لم يجتز) عبر REST
#  2) API الإدارة: 401/403 · GET ?invite (3 مؤهّلين · مقترح ≤4 وحدات · 14 يومًا) · draft (لا يتكرّر) · GET ?plan · المتعلّم لا يرى المسوَّدة (404 no_plan)
#     · approve مع تعديلات (ملاحظة + تبديل وحدة) · لا اعتماد مرّتين · إشعار practice_plan · approve_all مع skip · nudge (مرة يوميًا) · edit_day (تحقّق) · cancel
#  3) API المتعلّم: بطاقة اليوم 1 (5 بنود بلا مفاتيح · ملاحظة المدرّب) · إجابة → تغذية راجعة · لا مرّتين · إتمام اليوم · المرآة · الكتابة (قصير 400 · مرآة النصّ) · ai_feedback (موافقة إلزامية · محلي بلا مفتاح)
#     · الكشف: الإعادة الرسمية تستثني ما تدرّب عليه · الكرون اليومي practice{} · لوحة العبور تحمل practice{} · بطاقة النتيجة تحمل report.مِران
#  4) المتصفح: /miaar/practice/<code> (شريط 14 · بطاقة · إجابة · مرآة نصّ · مرآة التحسّن) · لا خطّة · بطاقة النتيجة «مِران» · لوحة العبور: جدول مِران + عمود + نافذة الخطّة
import sys, json, urllib.request, urllib.error, os, time, uuid
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-m10'
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
staff = Client(f'10.{R}.84.1', tok='tok'); reset(); time.sleep(31)  # ذاكرة الوحدات/البنك 30/90 ث
A = '/api/admin/miaar/bank'; S = '/api/admin/miaar/syllabus'; X = '/api/admin/miaar/exit'; PA = '/api/admin/miaar/practice'; PU = '/api/miaar/practice'
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
print('   pool A1 approved: gv', len(gv), 'rd', len(rd), 'li', len(li))
check('setup: bank approved · A1 seeded · 4 units approved · tagged', True)
st, cr = staff.call(X, {'action': 'create', 'classroom_id': 'c1', 'max_seats': 30}); inv = cr['invite']; check('exit invite for A-101 (c1 · A1)', st == 200 and inv.get('id'))
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
L = {}
NAMES = ['سارة العبور', 'محمد التمرين', 'ليان الجاهزية']
for n in range(3):
    em = f'mir{n}-{R}@example.com'
    st, f0 = run_test(Client(f'10.{R}.84.{20 + n}'), blueprint='SYS-SHORT', email=em); assert st == 200, f0
    st, f1 = run_test(Client(f'10.{R}.84.{40 + n}'), invite={'code': inv['code']}, email=em, name=NAMES[n], correct_ratio=0.0); assert st == 200, f1
    L[n] = {'email': em, 'code': f1['access_code'], 'report': f1['report']}
check('3 weak learners finished the exit (reports with وحدات)', all(L[n]['report'].get('الوحدات') for n in range(3)))
# أحكام نهائية صريحة عبر REST (لا نعتمد على التصحيح البشري هنا)
FORCE = {0: ('conditional', 'reading'), 1: ('conditional', 'writing'), 2: ('failed', None)}
for n, (outcome, skill) in FORCE.items():
    row = rest(f'placement_reports?access_code=eq.{L[n]["code"]}')[0]; rr = dict(row['report']); ex = dict(rr['exit'])
    ex.update({'الحالة': 'final', 'النتيجة': outcome, 'الكلي': 58 if outcome == 'conditional' else 31}); ex.pop('الإعادة', None)
    if skill: ex['مهارة_الإعادة'] = skill; ex['دون_الحد'] = [skill]; ex['المهارات'] = dict(ex['المهارات']); ex['المهارات'][skill] = {**(ex['المهارات'].get(skill) or {}), 'النسبة': 40, 'الحالة': 'below'}
    rr['exit'] = ex; rest_patch(f'placement_reports?id=eq.{row["id"]}', {'report': rr}); L[n]['id'] = row['id']
check('verdicts forced: conditional(reading) · conditional(writing) · failed — all final with وحدات', all(rest(f'placement_reports?id=eq.{L[n]["id"]}')[0]['report']['exit']['الحالة'] == 'final' for n in range(3)))

# ---- 2) API الإدارة
st, _ = Client(f'10.{R}.84.2').call(f'{PA}?invite={inv["id"]}'); check('practice GET without token → 401', st == 401)
st, _ = staff.call(f'{PA}?invite={inv["id"]}', tok='tok-u5'); check('practice GET non-staff → 403', st == 403)
st, g = staff.call(f'{PA}?invite={inv["id"]}'); rows = g.get('rows') or []; by = {r['code']: r for r in rows}
check('GET ?invite → 3 eligible rows · plan null · proposed units 1..4 (all A1-U) · 14 days · title · status_ar', st == 200 and len(rows) == 3 and all(r['plan'] is None and 1 <= len(r['proposed']['units']) <= 4 and all(u.startswith('A1-U') for u in r['proposed']['units']) and len(r['proposed']['days']) == 14 for r in rows) and g.get('days') == 14 and g['title']['ar'].startswith('مِران') and g.get('status_ar', {}).get('approved') == 'معتمدة')
r0 = by[L[0]['code']]; r1 = by[L[1]['code']]; r2 = by[L[2]['code']]
check('rows carry outcome/skill: r0 conditional/reading · r1 conditional/writing · r2 failed/null · unit_titles', r0['outcome'] == 'conditional' and r0['skill'] == 'reading' and r1['skill'] == 'writing' and r2['outcome'] == 'failed' and r2['skill'] is None and all(r0['unit_titles'].get(u) for u in r0['proposed']['units']))
check('productive skill (writing) → proposed days carry text on day 1 & 12 & mirrors; receptive → none', any(d.get('text') for d in r1['proposed']['days'] if d['d'] == 1) and any(d.get('text') for d in r1['proposed']['days'] if d['d'] == 12) and not any(d.get('text') for d in r0['proposed']['days']))
st, d0 = staff.call(PA, {'action': 'draft', 'report_id': L[0]['id']}); P0 = (d0.get('plan') or {}).get('id')
check('draft r0 → plan draft · units == proposed · 14 days · existed False', st == 200 and P0 and d0['plan']['status'] == 'draft' and d0['plan']['units'] == r0['proposed']['units'] and len(d0['plan']['days']) == 14 and d0.get('existed') is False)
st, d0b = staff.call(PA, {'action': 'draft', 'report_id': L[0]['id']}); check('draft again → same plan · existed True', st == 200 and d0b['plan']['id'] == P0 and d0b.get('existed') is True)
st, dp = staff.call(f'{PA}?plan={P0}'); pd = dp.get('plan') or {}
check('GET ?plan → 14 days with unit_title · level_units 4 · learner name/code · today 0 (draft) · summary draft', st == 200 and len(pd.get('days') or []) == 14 and all(d.get('unit_title') for d in pd['days']) and len(dp.get('level_units') or []) == 4 and dp['learner']['code'] == L[0]['code'] and dp['learner']['name'] == NAMES[0] and dp.get('today') == 0 and (dp.get('summary') or {}).get('status') == 'draft')
st, pub = Client(f'10.{R}.84.3').call(f'{PU}?code={L[0]["code"]}'); check('learner GET while draft → 404 no_plan (human approval gate)', st == 404 and pub.get('error') == 'no_plan')
st, pubx = Client(f'10.{R}.84.3').call(f'{PU}?code=ML-0000-0000'); check('learner GET malformed/unknown code → 400/404', st in (400, 404))
U_ALT = next(u['code'] for u in dp['level_units'] if u['code'] not in pd['units']) if any(u['code'] not in pd['units'] for u in dp['level_units']) else dp['level_units'][0]['code']
st, bad = staff.call(PA, {'action': 'approve', 'plan_id': P0, 'edits': [{'day': 3, 'unit': 'B1-U01'}]}); check('approve with unit of another level → 400', st == 400)
st, bad = staff.call(PA, {'action': 'approve', 'plan_id': P0, 'edits': [{'day': 2, 'note_audio': 'data:image/png;base64,AAAA'}]}); check('approve with non-audio note → 400', st == 400)
st, ap = staff.call(PA, {'action': 'approve', 'plan_id': P0, 'edits': [{'day': 1, 'note_ar': 'ابدأ بهدوء يا سارة — خمس دقائق تكفي'}, {'day': 3, 'unit': U_ALT}, {'day': 7, 'note_ar': 'يوم المرآة: لا تقلقي من الأخطاء'}]}, tok='tok-u5'); check('approve by non-staff → 403', st == 403)
st, ap = staff.call(PA, {'action': 'approve', 'plan_id': P0, 'edits': [{'day': 1, 'note_ar': 'ابدأ بهدوء يا سارة — خمس دقائق تكفي'}, {'day': 3, 'unit': U_ALT}, {'day': 7, 'note_ar': 'يوم المرآة: لا تقلقي من الأخطاء'}]}); pl = ap.get('plan') or {}
check('approve → approved · start_date today · day1 note · day3 unit swapped · approved_by u1', st == 200 and pl.get('status') == 'approved' and pl.get('start_date') and pl['days'][0]['note_ar'].startswith('ابدأ') and pl['days'][2]['unit'] == U_ALT and pl.get('approved_by') == 'u1')
st, ap2 = staff.call(PA, {'action': 'approve', 'plan_id': P0}); check('approve twice → 400', st == 400)
nts = rest(f'portal_learner_notices?email=eq.{L[0]["email"]}&kind=eq.practice_plan'); check('notice practice_plan for learner (dedupe practice_plan:<plan>) · url /miaar/practice/<code> · no %', len(nts) == 1 and nts[0]['dedupe_key'] == f'practice_plan:{P0}' and nts[0]['url'] == f'/miaar/practice/{L[0]["code"]}' and '%' not in nts[0]['title_ar'] + nts[0]['body_ar'])
logs = rest('audit_logs?action=eq.miaar_practice_approve'); check('audit log miaar_practice_approve (edits 3)', len(logs) == 1 and (logs[0].get('metadata') or {}).get('edits') == 3)
# approve_all مع تخطّي r1
st, aa = staff.call(PA, {'action': 'approve_all', 'invite_id': inv['id'], 'skip': [L[1]['id']]})
check('approve_all skip r1 → done 1 (r2) · skipped 2 (r0 approved + r1 skipped) · errors []', st == 200 and aa.get('done') == 1 and aa.get('skipped') == 2 and aa.get('errors') == [])
st, g2 = staff.call(f'{PA}?invite={inv["id"]}'); by2 = {r['code']: r for r in g2['rows']}; P2 = (by2[L[2]['code']]['plan'] or {}).get('id')
check('rows after: r0 approved (today 1) · r1 still proposed · r2 approved', by2[L[0]['code']]['plan']['status'] == 'approved' and by2[L[0]['code']]['plan']['today'] == 1 and by2[L[1]['code']]['plan'] is None and P2 and by2[L[2]['code']]['plan']['status'] == 'approved')
# r1 (كتابة): اعتماد مباشر من التقرير
st, ap1 = staff.call(PA, {'action': 'approve', 'report_id': L[1]['id']}); P1 = (ap1.get('plan') or {}).get('id'); check('approve by report_id (draft+approve in one) → approved · text days', st == 200 and P1 and ap1['plan']['status'] == 'approved' and any(d.get('text') for d in ap1['plan']['days']))
st, nd = staff.call(PA, {'action': 'nudge', 'plan_id': P0}); check('nudge → 200 · notice practice_nudge with trainer name', st == 200 and len(rest(f'portal_learner_notices?email=eq.{L[0]["email"]}&kind=eq.practice_nudge')) == 1)
st, nd2 = staff.call(PA, {'action': 'nudge', 'plan_id': P0}); check('nudge again same day → 409', st == 409)
st, ed = staff.call(PA, {'action': 'edit_day', 'plan_id': P0, 'day': 20}); check('edit_day day 20 → 400', st == 400)
st, ed = staff.call(PA, {'action': 'edit_day', 'plan_id': P0, 'day': 5, 'note_ar': 'ركّزي على الأسئلة الطويلة', 'note_audio': 'data:audio/webm;codecs=opus;base64,' + 'QUJD' * 40}); check('edit_day 5 note + audio data URL → 200', st == 200)
st, dp2 = staff.call(f'{PA}?plan={P0}'); d5 = next(d for d in dp2['plan']['days'] if d['d'] == 5); check('plan day 5 carries note_ar + note_audio', d5.get('note_ar', '').startswith('ركّزي') and str(d5.get('note_audio', '')).startswith('data:audio/webm'))

# ---- 3) API المتعلّم
pub = Client(f'10.{R}.84.5'); st, v = pub.call(f'{PU}?code={L[0]["code"]}'); card = v.get('بطاقة_اليوم') or {}; form = card.get('form') or {}; Q = form.get('questions') or []
check('learner GET → ok · name · اليوم 1 · 14 days (mirror at 7/14 · today flag) · readiness early · الشعار', st == 200 and v.get('ok') and v['name'] == NAMES[0].split()[0] and v['اليوم'] == 1 and len(v['الأيام']) == 14 and v['الأيام'][6]['kind'] == 'mirror' and v['الأيام'][0]['today'] is True and v['الجاهزية']['state'] == 'early' and v.get('الشعار'))
check('day card 1: drill · unit title · ≤5 questions (thin unit pool → fewer) · no correct ids · trainer note · first_of_unit', card.get('d') == 1 and card.get('kind') == 'drill' and card.get('unit_title') and 3 <= len(Q) <= 5 and all('correctOptionId' not in q for q in Q) and card.get('note_ar', '').startswith('ابدأ') and card.get('first_of_unit') is True)
PRACTICED = [q['id'] for q in Q]; q0 = Q[0]; wrong = next(o['id'] for o in q0['options'] if o['id'] != KEY.get(q0['id']))
st, a1 = pub.call(PU, {'action': 'answer', 'code': L[0]['code'], 'day': 1, 'item': q0['id'], 'option': wrong}); fb = a1.get('feedback') or {}
check('answer wrong → feedback correct False · correct_option text · why_ar mentions unit · day_done False · progress 1/5', st == 200 and fb.get('correct') is False and fb.get('correct_option') and 'وحدة' in fb.get('why_ar', '') and a1.get('day_done') is False)
st, a1b = pub.call(PU, {'action': 'answer', 'code': L[0]['code'], 'day': 1, 'item': q0['id'], 'option': KEY.get(q0['id'], 'a')}); check('answer same item again → 409 already_answered', st == 409 and a1b.get('error') == 'already_answered')
st, a1c = pub.call(PU, {'action': 'answer', 'code': L[0]['code'], 'day': 1, 'item': 'A1-reading-zzz', 'option': 'a'}); check('answer item not in today card → 400', st == 400)
st, a1d = pub.call(PU, {'action': 'answer', 'code': L[0]['code'], 'day': 2, 'item': Q[1]['id'], 'option': 'a'}); check('answer for a day not open → 400', st == 400)
last = None
for q in Q[1:]:
    st, last = pub.call(PU, {'action': 'answer', 'code': L[0]['code'], 'day': 1, 'item': q['id'], 'option': KEY.get(q['id'], 'a')})
N = len(Q); check(f'answering the remaining {N - 1} (correct) → day_done True', st == 200 and last.get('day_done') is True)
st, v2 = pub.call(f'{PU}?code={L[0]["code"]}'); mr = v2.get('المرآة') or []
check('after day 1: no card (all opened days done) · أُنجز 1 · day1 done N-1/N · mirror rows with before/now/delta', v2.get('بطاقة_اليوم') is None and v2['أُنجز'] == 1 and v2['الأيام'][0]['done'] and v2['الأيام'][0]['correct'] == N - 1 and len(mr) >= 1 and any(m['now'] is not None and m['before'] is not None and m['delta'] is not None for m in mr))
att = rest(f'miaar_practice_attempts?plan_id=eq.{P0}'); check('DB: N attempts (kind item · correct flags · email) · plan last_attempt_at', len(att) == N and sum(1 for a in att if a['correct']) == N - 1 and all(a['email'] == L[0]['email'] for a in att) and rest(f'miaar_practice_plans?id=eq.{P0}')[0]['last_attempt_at'])
# الكتابة (r1)
pub1 = Client(f'10.{R}.84.6'); st, w = pub1.call(f'{PU}?code={L[1]["code"]}'); c1 = w.get('بطاقة_اليوم') or {}; tx = c1.get('text') or {}
check('writing learner: day 1 card has text prompt (min_words 20 · اكتب) · earlier None', st == 200 and tx.get('prompt_ar', '').startswith('اكتب') and tx.get('min_words') == 20 and tx.get('earlier') is None)
st, t0 = pub1.call(PU, {'action': 'text', 'code': L[1]['code'], 'day': 1, 'text': 'قصير'}); check('text too short → 400 text_too_short', st == 400 and t0.get('error') == 'text_too_short')
ESSAY = 'ذهبت إلى السوق صباحًا ثم اشتريت الخبز والحليب، لأن أمي طلبت ذلك. بعد أن رجعت إلى البيت قرأت كتابًا جديدًا عن المدينة. لكن الجو كان حارًا جدًا، لذلك فتحت النافذة وشربت الماء البارد مع أخي.'
st, t1 = pub1.call(PU, {'action': 'text', 'code': L[1]['code'], 'day': 1, 'text': ESSAY}); mm = t1.get('mirror') or {}
check('text → mirror {words ≥ 25 · sentences ≥ 3 · connectors ≥ 2 · 4 notes} · day_done depends on items', st == 200 and mm.get('words', 0) >= 25 and mm.get('sentences', 0) >= 3 and mm.get('connectors', 0) >= 2 and len(mm.get('notes_ar') or []) == 4)
st, t2 = pub1.call(PU, {'action': 'text', 'code': L[1]['code'], 'day': 1, 'text': ESSAY}); check('text twice same day → 409', st == 409)
st, ai0 = pub1.call(PU, {'action': 'ai_feedback', 'code': L[1]['code'], 'day': 1, 'text': ESSAY}); check('ai_feedback without consent → 400', st == 400)
st, ai1 = pub1.call(PU, {'action': 'ai_feedback', 'code': L[1]['code'], 'day': 1, 'text': ESSAY, 'consent': True}); check('ai_feedback with consent (no key) → 200 local notes', st == 200 and ai1.get('source') in ('local', 'ai') and len(ai1.get('notes_ar') or []) >= 2)
# الكشف: الإعادة الرسمية تستثني ما تدرّب عليه
st, rk = staff.call(X, {'action': 'skill_retake', 'report_id': L[0]['id']}); rt_code = rk['url'].split('/miaar/d/')[1].split('?')[0]; rt_tok = rk['url'].split('t=')[1]
crt = Client(f'10.{R}.84.7'); st, s = crt.call('/api/miaar', {'action': 'start', 'instructions_ack': {'version': 1, 'lang': 'ar', 'accepted': True}, 'candidate': {'name': NAMES[0], 'email': L[0]['email']}, 'invite': {'code': rt_code, 't': rt_tok}, 'examMode': 'comprehensive'})
RQ = [q['id'] for q in (s.get('session', {}).get('form', {}).get('questions') or [])]; overlap = [c for c in RQ if c in PRACTICED]; reading_pool = len(rd)
print('   retake form', len(RQ), 'practiced', PRACTICED, 'overlap', len(overlap), 'reading pool', reading_pool)
check('official retake form excludes practiced items (or pool too small → kept with flag)', st == 200 and len(RQ) > 0 and (len(overlap) == 0 or reading_pool < len(RQ) + len([c for c in PRACTICED if '-reading-' in c])))
# الكرون
st, cj = Client(f'10.{R}.84.8').call('/api/followups/send?dry=1', tok='cron'); pr = cj.get('practice') or {}
check('daily cron dry → practice {checked 3 · day_sent ≥ 1 (r1/r2 day 1 undone) · closed 0 · errors []}', st == 200 and pr.get('checked') == 3 and pr.get('day_sent', 0) >= 1 and pr.get('closed') == 0 and pr.get('errors') == [])
st, cj2 = Client(f'10.{R}.84.8').call('/api/followups/send', tok='cron'); n_day = len(rest('portal_learner_notices?kind=eq.practice_day'))
st, cj3 = Client(f'10.{R}.84.8').call('/api/followups/send', tok='cron'); check('cron real twice → practice_day notices written once (dedupe per plan/day)', n_day >= 1 and len(rest('portal_learner_notices?kind=eq.practice_day')) == n_day)
# لوحة العبور · بطاقة النتيجة · إلغاء
st, bd = staff.call(f'{X}?invite={inv["id"]}'); pm = bd.get('practice') or {}
check('exit board GET carries practice{report_id → summary} for 3 plans (r0 done 1 · approved)', st == 200 and len(pm) == 3 and pm[L[0]['id']]['status'] == 'approved' and pm[L[0]['id']]['done'] == 1)
st, res = Client(f'10.{R}.84.9').call(f'/api/miaar?result={L[0]["code"]}'); mi = (res.get('report') or {}).get('مِران') or {}
check('public result card: report.مِران {الحالة approved · اليوم 1 · أُنجز 1 · الرابط}', st == 200 and mi.get('الحالة') == 'approved' and mi.get('اليوم') == 1 and mi.get('أُنجز') == 1 and mi.get('الرابط') == f'/miaar/practice/{L[0]["code"]}')
st, cn = staff.call(PA, {'action': 'cancel', 'plan_id': P2}); check('cancel r2 plan → 200 · status cancelled · learner GET 404', st == 200 and rest(f'miaar_practice_plans?id=eq.{P2}')[0]['status'] == 'cancelled' and Client(f'10.{R}.84.10').call(f'{PU}?code={L[2]["code"]}')[0] == 404)

# ---- 4) المتصفح
errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    cl = br.new_context(viewport={'width': 1200, 'height': 1000}, locale='ar'); pl = cl.new_page(); pl.on('pageerror', lambda e: errs.append(str(e)))
    pl.goto(B + f'/miaar/practice/{L[1]["code"]}'); pl.wait_for_selector('[data-testid="mp-card"]', timeout=30000); pl.wait_for_timeout(400)
    tt = pl.inner_text('[data-testid="mp-title"]')
    check('learner page: title «اليوم 1 من 14» + name · 14 day chips · readiness pill · card day 1 · 5 questions · text block', 'اليوم 1' in tt and NAMES[1].split()[0] in tt and pl.locator('[data-testid="mp-day"]').count() == 14 and pl.locator('[data-testid="mp-ready"]').count() == 1 and 3 <= pl.locator('[data-testid="mp-q"]').count() <= 5 and pl.locator('[data-testid="mp-text"]').count() == 1)
    pl.screenshot(path=f'{OUT}/01-learner-day1.png', full_page=True)
    pl.locator('[data-testid="mp-q"] >> nth=0 >> [data-testid="mp-opt"] >> nth=0').click(); pl.wait_for_selector('[data-testid="mp-fb"]', timeout=15000); pl.wait_for_timeout(300)
    st0 = pl.get_attribute('[data-testid="mp-q"] >> nth=0', 'data-state')
    check('click an option → instant feedback box · question state ok/bad · options disabled', st0 in ('ok', 'bad') and pl.locator('[data-testid="mp-fb"]').count() == 1 and pl.locator('[data-testid="mp-q"] >> nth=0 >> [data-testid="mp-opt"]').first.is_disabled())
    check('text already sent via API → mirror shown instead of textarea? (fresh page shows textarea; mirror comes after send)', pl.locator('[data-testid="mp-text"] textarea').count() == 1)
    pl.fill('[data-testid="mp-text"] textarea', ESSAY); pl.click('[data-testid="mp-text-send"]'); pl.wait_for_timeout(1500)
    live = pl.inner_text('.mp-live'); check('send text again (already sent today) → status message, no crash', 'أرسلت' in live or 'حُفظ' in live)
    pl.screenshot(path=f'{OUT}/02-learner-feedback.png', full_page=True)
    mrows = pl.locator('[data-testid="mp-mirror-row"]').count(); check('mirror section: one row per plan unit · back link to result card · WayBar', mrows >= 1 and pl.locator('[data-testid="mp-back-result"]').count() == 1)
    pl.goto(B + f'/miaar/practice/{L[0]["code"]}'); pl.wait_for_selector('[data-testid="mp-nocard"]', timeout=30000); pl.wait_for_timeout(300)
    check('r0 (day 1 done): «أتممت كل ما فُتح لك» · day chip 1 done · mirror delta shown', pl.get_attribute('[data-testid="mp-day"] >> nth=0', 'data-done') == '1' and pl.locator('[data-testid="mp-mirror-row"]').count() >= 1 and pl.inner_text('[data-testid="mp-done"]') == '1')
    pl.screenshot(path=f'{OUT}/03-learner-done.png', full_page=True)
    pl.goto(B + f'/miaar/practice/{L[2]["code"]}'); pl.wait_for_selector('[data-testid="mp-nf"]', timeout=30000); check('cancelled plan → «لا خطّة مِران معتمدة» message + link to result', 'لا خطّة' in pl.inner_text('[data-testid="mp-nf"]'))
    pl.goto(B + f'/miaar/result/{L[0]["code"]}'); pl.wait_for_selector('[data-testid="mi-practice"]', timeout=30000); pl.wait_for_timeout(300)
    pt = pl.inner_text('[data-testid="mi-practice"]'); href = pl.get_attribute('[data-testid="mi-practice-open"]', 'href') or ''
    check('result card: «مِران» box (day 1 · 1/14) with open link → /miaar/practice/<code>', 'مِران' in pt and href == f'/miaar/practice/{L[0]["code"]}')
    pl.screenshot(path=f'{OUT}/04-result-practice-box.png', full_page=True)
    # الإدارة
    ca = br.new_context(viewport={'width': 1380, 'height': 1000}, locale='ar'); pa = ca.new_page(); pa.on('pageerror', lambda e: errs.append(str(e)))
    pa.goto(B + '/login'); pa.fill('input[type=email]', 'admin@upm.edu.sa'); pa.click('[data-testid="login-mode-password"]'); pa.fill('input[type=password]', 'x'); pa.click('button[type=submit]'); pa.wait_for_url('**/dashboard', timeout=20000)
    pa.goto(B + f'/admin/miaar/exit?invite={inv["id"]}', wait_until='domcontentloaded'); pa.wait_for_selector('[data-testid="pr-root"]', timeout=30000); pa.wait_for_timeout(800)
    prs = pa.locator('[data-testid="pr-row"]').count(); cells = pa.locator('[data-testid="xb-practice-cell"]')
    statuses = [cells.nth(i).get_attribute('data-status') for i in range(cells.count())]
    check('board: مِران panel with 3 rows (statuses approved/approved/cancelled) · practice column per learner (approved ×2, cancelled → —)', prs == 3 and cells.count() == 3 and statuses.count('approved') == 2 and statuses.count('cancelled') == 1)
    pa.screenshot(path=f'{OUT}/05-board-practice.png', full_page=True)
    pa.locator('[data-testid="pr-row"][data-status="approved"] [data-testid="pr-open"]').first.click(); pa.wait_for_selector('[data-testid="pr-modal"]', timeout=15000); pa.wait_for_timeout(400)
    check('open plan → modal with 14 days · unit selects · note inputs · save button (approved → «احفظ»)', pa.locator('[data-testid="pr-day"]').count() == 14 and pa.locator('[data-testid="pr-unit"]').count() == 12 and pa.locator('[data-testid="pr-save"]').count() == 1)
    pa.fill('[data-testid="pr-day"][data-d="6"] [data-testid="pr-note-in"]', 'ملاحظة من اللوحة'); pa.click('[data-testid="pr-save"]'); pa.wait_for_timeout(1500)
    check('edit day 6 note from modal → saved (pr-ok) · DB day 6 note', pa.locator('[data-testid="pr-ok"]').count() == 1 and any(d['d'] == 6 and d.get('note_ar') == 'ملاحظة من اللوحة' for pl_ in rest('miaar_practice_plans?status=eq.approved') for d in pl_['days']))
    pa.screenshot(path=f'{OUT}/06-board-plan-modal.png', full_page=True)
    pa.locator('[data-testid="pr-modal"] button[aria-label="إغلاق"]').click(); pa.wait_for_timeout(300); check('modal close button clickable (above global nav)', pa.locator('[data-testid="pr-modal"]').count() == 0)
    pa.locator('[data-testid="pr-row"][data-status="approved"] [data-testid="pr-nudge"]').first.click(); pa.wait_for_timeout(1200); check('«ذكّر» from board → status message (already sent today → message, not crash)', pa.locator('[data-testid="pr-ok"]').count() == 1)
    errs = [e for e in errs if 'Minified React error #425' not in e]; check('no page errors', not errs); print(errs[:3])
    br.close()
print(f"\n== {sum(1 for _, c in ok if c)}/{len(ok)} PASS"); sys.exit(0 if all(c for _, c in ok) else 1)
