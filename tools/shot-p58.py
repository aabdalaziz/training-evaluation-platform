# E2E P58 «خريطة أثرك — ما قاد إلى ماذا»
#  1) API نورة: المحطات والخيوط المقترَحة من وقائعها (برنامج→مهارة→شهادة · ✋→جلسة · عهد→مراجعة · مجلس→شهادة عضو · حالة→مهمة) · المرآة
#  2) القرارات: إبقاء بكلمة (تحقّق ≤120) · استبعاد (يختفي) · يدوي · حذف فوري · الحدود 400/404
#  3) اللقطة: توقيع (خاصّة) → تحقّق بلا جسم → عامة → جسم عام بلا عنوان الحالة → إعادة توقيع تُبطل → إبطال → «أُبطلت»
#  4) الكرون: 🧭 إشعار لنورة مرّة · لا ثاني في اليوم نفسه · ظاهر في /api/notices
#  5) المتصفح: /me (بطاقة) · /me/athar-map (المرآة · SVG · بطاقة الخيط · إبقاء · يدوي · توقيع) · /verify/map · جوّال · «نادِ» · لا أخطاء
import sys, json, urllib.request, urllib.error, os, time, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p58'
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
nu = Client(f'10.{R}.58.2', tok='tok-u2'); S2 = '00000000-0000-4000-8000-000000000002'
# ---- 1) الخريطة
st, d = nu.call('/api/me/map'); m = d.get('map', {}); th = m.get('threads', []); keys = {s['key'] for s in m.get('stations', [])}
print('stations:', sorted(keys)); print('threads:', [(t['rule'], t['status']) for t in th]); print('mirror:', m.get('mirror', {}).get('lines_ar'))
check('GET map: 200 · stations incl. program/skill/credential/session/hand/horizon/badge/council/daily/mission', st == 200 and all(any(k.startswith(p) for k in keys) for p in ['program:p58', f'skill:{S2}', 'credential:', 'session:ses-p58', 'hand:', 'horizon:hz-p58', 'horizon_review:', 'badge:cb-p58', 'council:', 'daily:', 'mission:']))
rules = {t['rule'] for t in th if t['status'] == 'proposed'}
check('proposed rules: program_skill · skill_credential · session_skill · hand_session · pledge_review · council_badge · daily_mission', {'program_skill', 'skill_credential', 'session_skill', 'hand_session', 'pledge_review', 'council_badge', 'daily_mission'} <= rules)
check('mirror: waiting line · no strongest yet · no names', any('تنتظر كلمتك' in l for l in m['mirror']['lines_ar']) and m['mirror']['strongest_ar'] is None and 'نورة' not in json.dumps(d, ensure_ascii=False))
check('layout: every station positioned · counts consistent', len(m['layout']['pos']) == len(keys) and m['counts']['proposed'] == len([t for t in th if t['status'] == 'proposed']) and m['counts']['kept'] == 0)
# ---- 2) القرارات
ps = next(t for t in th if t['rule'] == 'program_skill'); hs = next(t for t in th if t['rule'] == 'hand_session'); dm = next(t for t in th if t['rule'] == 'daily_mission')
st1, _ = nu.call('/api/me/map', {'action': 'keep', 'from': ps['from'], 'to': ps['to'], 'note': 'x'}); st2, _ = nu.call('/api/me/map', {'action': 'keep', 'from': ps['from'], 'to': ps['to'], 'note': 'ا' * 121}); st3, _ = nu.call('/api/me/map', {'action': 'keep', 'from': 'program:zzz', 'to': ps['to'], 'note': 'كلمتان هنا'})
check('keep guards: short 400 · >120 400 · unknown station 404', st1 == 400 and st2 == 400 and st3 == 404)
st, d = nu.call('/api/me/map', {'action': 'keep', 'from': ps['from'], 'to': ps['to'], 'note': 'في الدبلوم تعلّمت كيف أصحّح النطق بلا إحراج'}); k1 = [t for t in d['map']['threads'] if t['status'] == 'kept']
check('keep program→skill: kept with note · rule preserved', st == 200 and len(k1) == 1 and k1[0]['rule'] == 'program_skill' and 'أصحّح' in k1[0]['note_ar'])
st, d = nu.call('/api/me/map', {'action': 'decline', 'from': hs['from'], 'to': hs['to']})
check('decline ✋→session: gone · declined=1 · never re-proposed', st == 200 and not any(t['from'] == hs['from'] for t in d['map']['threads']) and d['map']['declined'] == 1)
st, d = nu.call('/api/me/map', {'action': 'keep', 'from': dm['to'], 'to': 'badge:cb-p58', 'note': 'المهمة شجّعتني على المجلس'}); man = [t for t in d['map']['threads'] if t['rule'] == 'manual']
check('manual thread between any two stations: rule=manual · kept', st == 200 and len(man) == 1 and man[0]['status'] == 'kept' and d['map']['counts']['manual'] == 1)
st, d = nu.call('/api/me/map', {'action': 'keep', 'from': dm['from'], 'to': dm['to'], 'note': 'الحالة نزلت بي إلى الميدان'})
check('mirror after 3 kept: strongest line present', st == 200 and d['map']['mirror']['strongest_ar'] and 'أقوى خيط' in d['map']['mirror']['strongest_ar'])
st, d = nu.call('/api/me/map', {'action': 'remove', 'from': dm['to'], 'to': 'badge:cb-p58'})
check('remove manual: immediate · counts back to 2 kept', st == 200 and d['map']['counts']['kept'] == 2 and d['map']['counts']['manual'] == 0)
st, d = nu.call('/api/me/map', {'action': 'keep', 'from': ps['from'], 'to': ps['to'], 'note': 'كلمتي الجديدة بعد التعديل'})
check('re-keep same thread updates note (upsert, still 2 kept)', st == 200 and d['map']['counts']['kept'] == 2 and any(t['note_ar'] == 'كلمتي الجديدة بعد التعديل' for t in d['map']['threads']))
# ---- 3) اللقطة
st, d = nu.call('/api/me/map', {'action': 'sign'}); snap = d.get('snap') or {}; code = snap.get('code', '')
check('sign: 200 · code ATH-MP-XXXX-XXXX · private · one live', st == 200 and code.startswith('ATH-MP-') and len(code) == 16 and snap.get('is_public') is False and len([s for s in d['snapshots'] if not s['revoked_at']]) == 1)
pub = Client(f'10.{R}.58.9')
st, v = pub.call(f'/api/verify/map?code={code.lower()}')
check('verify private: valid · intact · counts · no body · no names', st == 200 and v['valid'] and v['intact'] and not v['revoked'] and v['counts']['kept'] == 2 and 'body' not in v and 'نورة' not in json.dumps(v, ensure_ascii=False))
st, _ = nu.call('/api/me/map', {'action': 'public', 'id': snap['id'], 'is_public': True}); st, v = pub.call(f'/api/verify/map?code={code}')
dstation = next((s for s in v.get('body', {}).get('stations', []) if s['key'].startswith('daily:')), None)
check('verify public: body + layout · daily case shown by topic only', st == 200 and v.get('is_public') and v.get('body') and v.get('layout') and dstation and dstation['title_ar'].startswith('حالة يوم —'))
st, v2 = pub.call('/api/verify/map?code=ATH-MP-ZZZZ-ZZZZ'); check('verify unknown: valid=false', st == 200 and v2['valid'] is False)
st, d = nu.call('/api/me/map', {'action': 'sign', 'is_public': True}); code2 = d['snap']['code']; st, v = pub.call(f'/api/verify/map?code={code}')
check('re-sign: new code · old revoked · still one live', code2 != code and v['revoked'] is True and 'body' not in v and len([s for s in d['snapshots'] if not s['revoked_at']]) == 1)
st, d = nu.call('/api/me/map', {'action': 'revoke', 'id': d['snap']['id']}); st, v = pub.call(f'/api/verify/map?code={code2}')
check('revoke: none live · verify says revoked', st == 200 and not [s for s in d['snapshots'] if not s['revoked_at']] and v['revoked'] is True)
st, d = nu.call('/api/me/map', {'action': 'sign'}); code3 = d['snap']['code']; check('sign again after revoke → 200', st == 200 and code3.startswith('ATH-MP-'))
st, _ = Client(f'10.{R}.58.3').call('/api/me/map'); check('no token → 401', st == 401)
# ---- 4) الكرون 🧭
cr = Client(f'10.{R}.58.4'); st, c1 = cr.call('/api/followups/send', tok='cron'); mn = c1.get('map_nudges') or {}; print('map_nudges:', mn)
notices = [n for n in rest('portal_learner_notices?kind=eq.map_thread') if n['email'] == 'noura@upm.edu.sa']
check('cron: map_nudges scanned ≥1 · sent ≥1 · exactly one 🧭 notice for noura with url /me/athar-map', st == 200 and mn.get('sent', 0) >= 1 and len(notices) == 1 and notices[0]['url'] == '/me/athar-map' and 'نتظر' in notices[0]['title_ar'])
st, c2 = cr.call('/api/followups/send', tok='cron'); notices2 = [n for n in rest('portal_learner_notices?kind=eq.map_thread') if n['email'] == 'noura@upm.edu.sa']
check('cron twice same day: no second notice', (c2.get('map_nudges') or {}).get('sent') == 0 and len(notices2) == 1)
st, nl = nu.call('/api/notices'); items = nl.get('notices') or nl.get('items') or []
check('/api/notices shows 🧭 kind_ar «خريطة أثرك»', st == 200 and any(n.get('kind') == 'map_thread' and n.get('kind_ar') == 'خريطة أثرك' and n.get('icon') == '🧭' for n in items))
# ---- 5) المتصفح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); pg.on('pageerror', lambda e: errs.append(pg.url + ' ' + str(e)))
    login(pg, 'noura@upm.edu.sa')
    pg.goto(B + '/me', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="me-athar-map"]', timeout=30000)
    check('/me: card link «خريطة أثرك»', 'خريطة أثرك' in pg.locator('[data-testid="me-athar-map"]').inner_text()); pg.screenshot(path=f'{OUT}/00-me-card.png')
    pg.goto(B + '/me/athar-map', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="am-svg"]', timeout=30000); pg.wait_for_timeout(600)
    n_st = pg.locator('[data-testid="am-station"]').count(); n_k = pg.locator('[data-testid="am-thread-kept"]').count(); n_p = pg.locator('[data-testid="am-thread-proposed"]').count()
    check(f'map page: mirror · {n_st} stations · {n_k} kept · {n_p} proposed drawn', pg.locator('[data-testid="am-mirror"]').is_visible() and n_st >= 10 and n_k == 2 and n_p >= 3)
    pg.screenshot(path=f'{OUT}/01-athar-map.png', full_page=True)
    pg.locator('[data-testid="am-proposed-item"] button').first.click(); pg.wait_for_selector('[data-testid="am-thread-card"]', timeout=10000)
    check('thread card opens · keep disabled until note', pg.locator('[data-testid="am-keep"]').is_disabled())
    pg.fill('[data-testid="am-note"]', 'بعد الجلسة صار الصوت أوضح'); pg.click('[data-testid="am-keep"]'); pg.wait_for_selector('[data-testid="am-thread-card"]', state='detached', timeout=20000); pg.wait_for_timeout(300)
    check('keep via UI → 3 kept threads · card closed', pg.locator('[data-testid="am-thread-kept"]').count() == 3 and pg.locator('[data-testid="am-thread-card"]').count() == 0)
    pg.screenshot(path=f'{OUT}/02-after-keep.png', full_page=True)
    pg.locator('[data-testid="am-station"]').first.click(); pg.wait_for_selector('[data-testid="am-side"]', timeout=10000); check('station click → side panel', pg.locator('[data-testid="am-side"]').is_visible()); pg.screenshot(path=f'{OUT}/03-station-side.png')
    pg.select_option('[data-testid="am-manual-from"]', index=1); pg.select_option('[data-testid="am-manual-to"]', index=3); pg.fill('[data-testid="am-manual-note"]', 'خيط رأيته بنفسي'); pg.click('[data-testid="am-manual-save"]'); pg.wait_for_function('document.querySelectorAll(\'[data-testid="am-thread-kept"]\').length === 4', timeout=20000)
    check('manual thread via UI → 4 kept', pg.locator('[data-testid="am-thread-kept"]').count() == 4)
    live = pg.locator('[data-testid="am-snap-live"]'); check('snapshot card shows live code', live.count() == 1 and 'ATH-MP-' in live.inner_text())
    pg.once('dialog', lambda dg: dg.accept()); pg.click('[data-testid="am-snap-revoke"]'); pg.wait_for_selector('[data-testid="am-sign"]', timeout=10000)
    pg.click('[data-testid="am-sign"]'); pg.wait_for_selector('[data-testid="am-snap-live"]', timeout=10000); code_ui = pg.locator('[data-testid="am-snap-live"] code').inner_text().strip()
    check('revoke + sign via UI → new live code', code_ui.startswith('ATH-MP-') and code_ui != code3); pg.screenshot(path=f'{OUT}/04-snapshot.png', full_page=True)
    pg.click('[data-testid="am-snap-public"]'); pg.wait_for_function('!!document.querySelector(\'[data-testid="am-snap-live"]\') && document.querySelector(\'[data-testid="am-snap-live"]\').innerText.includes("اجعلها خاصّة")', timeout=20000)
    vp = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); vp.on('pageerror', lambda e: errs.append(vp.url + ' ' + str(e)))
    vp.goto(B + f'/verify/map?code={code_ui}', wait_until='domcontentloaded'); vp.wait_for_selector('[data-testid="vm-valid"]', timeout=30000); vp.wait_for_selector('[data-testid="vm-map"]', timeout=15000)
    txt = vp.locator('[data-testid="vm-valid"]').inner_text()
    check('verify page (public): valid · map drawn · no learner name · daily by topic', 'البصمة سليمة' in txt and 'نورة' not in txt and 'حالة يوم —' in txt); vp.screenshot(path=f'{OUT}/05-verify-public.png', full_page=True)
    vp.goto(B + f'/verify/map?code={code2}', wait_until='domcontentloaded'); vp.wait_for_selector('[data-testid="vm-revoked"]', timeout=30000); check('verify page: revoked → «أُبطلت»', 'أُبطلت' in vp.locator('[data-testid="vm-revoked"]').inner_text()); vp.screenshot(path=f'{OUT}/06-verify-revoked.png')
    # «نادِ»
    mp = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True, storage_state=pg.context.storage_state()).new_page(); mp.goto(B + '/me/athar-map', wait_until='domcontentloaded'); mp.wait_for_selector('[data-testid="am-svg"]', timeout=30000); mp.wait_for_timeout(500)
    check('mobile: svg visible · no horizontal overflow', mp.locator('[data-testid="am-svg"]').is_visible() and mp.evaluate('document.documentElement.scrollWidth <= 392')); mp.screenshot(path=f'{OUT}/07-mobile.png', full_page=True)
    # a11y: stations keyboard-focusable with aria-label
    check('a11y: stations have role=button + aria-label', pg.locator('[data-testid="am-station"][role="button"][aria-label]').count() >= 10)
    check('no page errors', not errs); print(errs[:3]); br.close()
print('\n==== P58 E2E:', sum(1 for _, c in ok if c), '/', len(ok), 'PASS'); print([n for n, c in ok if not c])
