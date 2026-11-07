# E2E P59 «نسيج الشعبة — ما نسجه متعلّموك معًا»
#  1) API المدرّب (t1 = admin): شُعبي → نسيج c1: 7 منسوبين · محطات ≥5 · program_skill منسوج 5/7 (نجمة) · session_skill «لم يأخذه أحد» · 5 اقتباسات بلا أسماء · المرآة بلا حكم · شعبة ليست لي 404 · متعلّم 403
#  2) إذن المتعلّم (نورة): keep → share=true → يظهر اقتباس سادس عند المدرّب (fresh) · share=false → يختفي · share على مقترح 400 · peers: «نسجه معك 5» على خيطها
#  3) كلمة على النسيج: POST → إشعار 🧶 عند l1 و نورة (dedupe weave_word) · مرّتين = نفس اليوم مرّة · /api/notices يظهر العنوان · رسالة الشهر: thread_ar في pulse (k≥5)
#  4) المتصفح: /me/day (رابط نسيج) · /me/day/weave (الشعبة · المرآة · SVG بسماكة · نجمة · الخيوط · الاقتباسات · كلمة) · /me/athar-map (مفتاح الإذن · سطر الزملاء) · جوّال · لا أخطاء
import sys, json, urllib.request, urllib.error, os, time, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p59'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
class Client:
    def __init__(self, ip, tok=None): self.ip = ip; self.tok = tok
    def call(self, path, body=None, tok=None, method=None):
        h = {'Content-Type': 'application/json', 'X-Forwarded-For': self.ip}; tok = tok or self.tok
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
tr = Client(f'10.{R}.59.1', tok='tok'); nu = Client(f'10.{R}.59.2', tok='tok-u2'); S2 = '00000000-0000-4000-8000-000000000002'
NAMES = ['نورة', 'متعلّم 1', 'متعلّم 2', 'l1@', 'l2@', 'noura@']
# ---- 1) المدرّب
st, d = tr.call('/api/me/day/weave'); rooms = d.get('rooms', [])
print('rooms:', [(r['id'], r['roster']) for r in rooms])
check('GET weave (no classroom): 200 · rooms incl. c1 with roster 13 (enrolled 7 ∪ attendance 6 — same as day book)', st == 200 and any(r['id'] == 'c1' and r['roster'] == 13 for r in rooms))
st, d = tr.call('/api/me/day/weave?classroom=c1&fresh=1'); w = d.get('weave', {}); th = w.get('threads', []); stn = w.get('stations', [])
print('weave:', w.get('roster'), w.get('mapped'), [(s['key'][:14], s['n']) for s in stn], [(t['rule'], t['state'], t['kept_n'], t['offered_n']) for t in th]); print('mirror:', w.get('mirror', {}).get('lines_ar')); print('star:', w.get('star'), 'quotes:', len(w.get('quotes', [])), w.get('quotes_locked_ar'))
check('weave c1: 200 · roster 13 · mapped 7 (6 attendance-only emails have no map) · not below k', st == 200 and w.get('roster') == 13 and w.get('mapped') == 7 and w.get('below_k') is False)
check('stations: program:p58 ×7 · skill ×7 · session ×7 · every n ≥ 5', {s['key']: s['n'] for s in stn}.get('program:p58') == 7 and {s['key']: s['n'] for s in stn}.get(f'skill:{S2}') == 7 and all(s['n'] >= 5 for s in stn))
ps = next((t for t in th if t['rule'] == 'program_skill'), None); ss = next((t for t in th if t['rule'] == 'session_skill'), None)
check('threads: program_skill woven 5/7 · session_skill untaken 0/7', ps and ps['state'] == 'woven' and ps['kept_n'] == 5 and ps['offered_n'] == 7 and ss and ss['state'] == 'untaken' and ss['kept_n'] == 0 and ss['offered_n'] == 7)
check('weights/counts/star: weight 5 · count 7 · star = program→skill', w['weights'].get(f'program:p58>skill:{S2}') == 5 and w['counts'].get('program:p58') == 7 and w['star'] == f'program:p58>skill:{S2}')
check('mirror: strongest «5 من 7» · untaken «اقترحناه لـ 7» · no names', any('5 من 7' in l for l in w['mirror']['lines_ar']) and any('اقترحناه لـ 7' in l for l in w['mirror']['lines_ar']) and not any(n in json.dumps(w, ensure_ascii=False) for n in NAMES))
check('quotes: 5 consenters → 5 quotes · no email/name · rule title', w.get('consenters') == 5 and len(w.get('quotes', [])) == 5 and all('@' not in q['note_ar'] and q['title_ar'] for q in w['quotes']) and w.get('quotes_locked_ar') is None)
st, _ = tr.call('/api/me/day/weave?classroom=c5'); check('classroom not mine → 404', st == 404)
st, _ = Client(f'10.{R}.59.4', tok='tok-u5').call('/api/me/day/weave'); check('learner reem (no trainer card, not staff) → 403', st == 403)
st, _ = Client(f'10.{R}.59.3').call('/api/me/day/weave'); check('no token → 401', st == 401)
# ---- 2) إذن المتعلّم + زملاء
st, dm = nu.call('/api/me/map'); mth = dm['map']['threads']; psn = next(t for t in mth if t['rule'] == 'program_skill' and t['status'] == 'proposed')
st, _ = nu.call('/api/me/map', {'action': 'share', 'from': psn['from'], 'to': psn['to'], 'share': True}); check('share on a proposed (no decision row) → 404 guard', st == 404)
st, dk = nu.call('/api/me/map', {'action': 'keep', 'from': psn['from'], 'to': psn['to'], 'note': 'لأن البرنامج جعلني أسمع طلابي'}); kept = next(t for t in dk['map']['threads'] if t['from'] == psn['from'] and t['to'] == psn['to'])
check('keep → kept · shared=false by default · peers: «نسجه معك 5» on this thread', st == 200 and kept['status'] == 'kept' and kept.get('shared') is False and dk.get('peers', {}).get(f"{psn['from']}>{psn['to']}") == 5)
st, dsh = nu.call('/api/me/map', {'action': 'share', 'from': psn['from'], 'to': psn['to'], 'share': True}); kept2 = next(t for t in dsh['map']['threads'] if t['from'] == psn['from'] and t['to'] == psn['to'])
row = rest(f"portal_map_threads?email=eq.noura@upm.edu.sa&from_key=eq.{psn['from']}")[0]
check('share=true → thread.shared · row share_trainer=true · shared_at set', st == 200 and kept2.get('shared') is True and row.get('share_trainer') is True and row.get('shared_at'))
st, d6 = tr.call('/api/me/day/weave?classroom=c1&fresh=1'); w6 = d6['weave']
check('trainer (fresh): 6 consenters · 6 quotes · noura note present without her name · woven 6/7', w6['consenters'] == 6 and len(w6['quotes']) == 6 and any('أسمع طلابي' in q['note_ar'] for q in w6['quotes']) and 'نورة' not in json.dumps(w6, ensure_ascii=False) and next(t for t in w6['threads'] if t['rule'] == 'program_skill')['kept_n'] == 6)
st, _ = nu.call('/api/me/map', {'action': 'share', 'from': psn['from'], 'to': psn['to'], 'share': False}); row = rest(f"portal_map_threads?email=eq.noura@upm.edu.sa&from_key=eq.{psn['from']}")[0]
st2, d5 = tr.call('/api/me/day/weave?classroom=c1&fresh=1')
check('share=false → immediate: row false · shared_at null · trainer back to 5 quotes', st == 200 and row.get('share_trainer') is False and not row.get('shared_at') and d5['weave']['consenters'] == 5)
st, _ = nu.call('/api/me/map', {'action': 'share', 'from': psn['from'], 'to': psn['to'], 'share': True}); st, dd = nu.call('/api/me/map', {'action': 'decline', 'from': psn['from'], 'to': psn['to']}); row = rest(f"portal_map_threads?email=eq.noura@upm.edu.sa&from_key=eq.{psn['from']}")[0]
check('decline withdraws consent (constraint-safe): status declined · share_trainer false', row.get('status') == 'declined' and row.get('share_trainer') is False)
nu.call('/api/me/map', {'action': 'remove', 'from': psn['from'], 'to': psn['to']}); nu.call('/api/me/map', {'action': 'keep', 'from': psn['from'], 'to': psn['to'], 'note': 'لأن البرنامج جعلني أسمع طلابي'})
# ---- 3) كلمة على النسيج + رسالة الشهر
st, _ = tr.call('/api/me/day/weave', {'classroom_id': 'c1', 'text': 'x'}); check('weave word: too short/empty guard', st == 400)
st, dw = tr.call('/api/me/day/weave', {'classroom_id': 'c1', 'text': 'قرأتُ نسيجكم اليوم — خيط «جلسة → مهارة» ينتظركم؛ نتحدث عنه غدًا.'})
nts = rest('portal_learner_notices?kind=eq.trainer_word&email=eq.l1@upm.edu.sa'); nn = rest('portal_learner_notices?kind=eq.trainer_word&email=eq.noura@upm.edu.sa')
wn = [n for n in nts if str(n.get('dedupe_key', '')).startswith('weave_word:')]; wnn = [n for n in nn if str(n.get('dedupe_key', '')).startswith('weave_word:')]
print('weave word:', st, dw.get('sent'), dw.get('recipients'), [(n['title_ar'], n.get('url'), n.get('meta')) for n in wn])
check('weave word: 200 · sent 13 · 🧶 title «على نسيجكم» · url /me/athar-map · meta.weave', st == 200 and dw.get('sent') == 13 and len(wn) == 1 and 'على نسيجكم' in wn[0]['title_ar'] and wn[0].get('url') == '/me/athar-map' and (wn[0].get('meta') or {}).get('weave') == 1 and len(wnn) == 1)
st, dw2 = tr.call('/api/me/day/weave', {'classroom_id': 'c1', 'text': 'كلمة ثانية في اليوم نفسه'}); nts2 = rest('portal_learner_notices?kind=eq.trainer_word&email=eq.l1@upm.edu.sa')
check('second weave word same day → merged, still one notice per learner', st == 200 and len([n for n in nts2 if str(n.get('dedupe_key', '')).startswith('weave_word:')]) == 1)
st, dn = nu.call('/api/notices'); items = [n for n in dn.get('notices', []) if 'على نسيجكم' in n.get('title_ar', '')]
check('/api/notices (noura): 🧶 weave word visible · can_reply (same loop)', st == 200 and len(items) == 1 and items[0].get('can_reply') is not False)
st, dc = tr.call('/api/followups/send', tok='cron'); rows = rest('portal_org_letters'); l21 = next((r for r in rows if str(r.get('organization_id', '')).endswith('21')), None); pulse = ((l21 or {}).get('body') or {}).get('pulse') or {}
print('letter 21 pulse thread_ar:', pulse.get('thread_ar'))
check('monthly letter (org 21): pulse.thread_ar «أقوى خيط نسجه منسوبوكم… نسجه 5 منهم» · k rule', st == 200 and l21 is not None and 'نسجه 5 منهم' in (pulse.get('thread_ar') or '') and 'برنامج قاد إلى مهارة معتمدة' in pulse.get('thread_ar'))
# ---- 4) المتصفح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); pg.on('pageerror', lambda e: errs.append(pg.url + ' ' + str(e)))
    login(pg, 'admin@upm.edu.sa')
    pg.goto(B + '/me/day', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="dy-room"][data-id="c1"]', timeout=60000)
    check('/me/day: c1 card has «نسيج الشعبة» link', pg.locator('[data-testid="dy-room"][data-id="c1"] [data-testid="dy-weave-link"]').count() == 1)
    pg.click('[data-testid="dy-room"][data-id="c1"] [data-testid="dy-weave-link"]'); pg.wait_for_selector('[data-testid="wv-svg"]', timeout=60000); pg.wait_for_timeout(600)
    check('weave page: room selected · mirror lines ≥ 2 · svg · star notice', pg.locator('[data-testid="wv-room"][data-id="c1"][aria-pressed="true"]').count() == 1 and pg.locator('[data-testid="wv-line"]').count() >= 2 and pg.locator('[data-testid="wv-star"]').count() == 1)
    check('weave svg: woven thread drawn + untaken dotted + star glow', pg.locator('[data-testid="wv-svg"] [data-testid="am-thread-kept"]').count() >= 1 and pg.locator('[data-testid="wv-svg"] [data-testid="am-thread-proposed"]').count() >= 1 and pg.locator('[data-testid="wv-svg"] [data-testid="am-star"]').count() == 1)
    check('weave cards: woven + untaken · quotes 5 (noura withdrew) · no names', pg.locator('[data-testid="wv-thread"][data-state="woven"]').count() >= 1 and pg.locator('[data-testid="wv-thread"][data-state="untaken"]').count() >= 1 and pg.locator('[data-testid="wv-quote"]').count() == 5 and not any(n in pg.locator('[data-testid="wv-root"]').inner_text() for n in ['نورة', 'متعلّم 1']))
    pg.screenshot(path=f'{OUT}/01-weave.png', full_page=True)
    pg.click('[data-testid="wv-word-open"]'); pg.wait_for_selector('[data-testid="wv-word-text"]'); check('word composer prefilled with suggestion about the untaken thread', 'جلسة قادت إلى مهارة' in pg.input_value('[data-testid="wv-word-text"]'))
    pg.fill('[data-testid="wv-word-text"]', 'كلمة من الواجهة على النسيج'); pg.click('[data-testid="wv-word-send"]'); pg.wait_for_selector('[data-testid="wv-word-ok"]', timeout=30000)
    check('weave word via UI → ok banner with recipients', '13' in pg.locator('[data-testid="wv-word-ok"]').inner_text())
    pg.screenshot(path=f'{OUT}/02-weave-word.png', full_page=True)
    # learner side
    lp = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); lp.on('pageerror', lambda e: errs.append(lp.url + ' ' + str(e)))
    login(lp, 'noura@upm.edu.sa'); lp.goto(B + '/me/athar-map', wait_until='domcontentloaded'); lp.wait_for_selector('[data-testid="am-svg"]', timeout=60000); lp.wait_for_timeout(800)
    check('learner map: peers line «نسجه معك 5 من زملائك» on kept thread', lp.locator('[data-testid="am-peers"]').count() == 1 and '5 من زملائك' in lp.locator('[data-testid="am-peers"]').inner_text())
    lp.locator('[data-testid="am-kept-item"] .am-linkbtn').first.click(); lp.wait_for_selector('[data-testid="am-share-toggle"]')
    check('thread card: share toggle present · unchecked by default · peers line', lp.locator('[data-testid="am-share-toggle"]').is_checked() is False and lp.locator('[data-testid="am-peers-card"]').count() == 1)
    lp.click('[data-testid="am-share-toggle"]'); lp.wait_for_function('document.querySelector(\'[data-testid="am-share-toggle"]\').checked === true', timeout=20000); lp.wait_for_timeout(300)
    row = rest(f"portal_map_threads?email=eq.noura@upm.edu.sa&from_key=eq.{psn['from']}")[0]
    check('share via UI → checked · badge «مع مدرّبك» · row true', lp.locator('[data-testid="am-shared-badge"]').count() == 1 and row.get('share_trainer') is True)
    lp.screenshot(path=f'{OUT}/03-learner-share.png', full_page=True)
    lp.click('[data-testid="am-share-toggle"]'); lp.wait_for_function('document.querySelector(\'[data-testid="am-share-toggle"]\').checked === false', timeout=20000)
    check('unshare via UI → unchecked', rest(f"portal_map_threads?email=eq.noura@upm.edu.sa&from_key=eq.{psn['from']}")[0].get('share_trainer') is False)
    # notices
    lp.goto(B + '/me', wait_until='domcontentloaded'); lp.wait_for_timeout(1500)
    check('learner /me shows 🧶 weave word notice title', 'على نسيجكم' in lp.inner_text('body'))
    # mobile
    mp = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True, storage_state=pg.context.storage_state()).new_page(); mp.goto(B + '/me/day/weave?classroom=c1', wait_until='domcontentloaded'); mp.wait_for_selector('[data-testid="wv-svg"]', timeout=60000); mp.wait_for_timeout(500)
    wv = mp.evaluate('() => [document.querySelector(\'[data-testid="wv-root"]\').scrollWidth, document.documentElement.clientWidth]')
    check('mobile: weave visible · no horizontal overflow inside P59 root', mp.locator('[data-testid="wv-svg"]').is_visible() and wv[0] <= wv[1] + 2)
    mp.screenshot(path=f'{OUT}/04-mobile.png', full_page=True)
    check('a11y: room buttons aria-pressed · svg role=img with label', pg.locator('[data-testid="wv-room"][aria-pressed]').count() >= 1 and pg.locator('[data-testid="wv-svg"] svg[role="img"][aria-label]').count() == 1)
    check('no page errors', not errs); print(errs)
    br.close()
print('\n==== P59 E2E:', sum(1 for _, c in ok if c), '/', len(ok), 'PASS'); print([n for n, c in ok if not c])
