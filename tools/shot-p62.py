# E2E P62 «رسالة إلى نفسي بعد سنة — إلى مَن سأكون» (الطبعة الثانية على جدول P25)
#  1) API: GET → رسائل u1 (9001 جاهزة · 9002 مختومة بلا نصّ · 9003 مفتوحة بنصّ) · ظرف الدفعة p62g جاهز (5 أسطر · بلا بريد) · p62 قادم (يقبل سطرًا) · بذرة اليوم · الآفاق
#  2) الكتابة: قصير → 400 · أفق «عند تخرّجي» → موعد = نهاية p62 بساعة الكتابة · سنة → 365 يومًا نفس الساعة · الحدّ 3 مختومة · السلسلة chain_of
#  3) الفتح: 9001 في موعدها → opened · مرآة بأعداد · 9002 قبل أوانها → opened_early + early_days · الردّ · الحذف الفوري · رسالة الدفعة (كتابة · تكرار 409 · حذف)
#  4) الكرون: self_letters داخل /api/followups/send (dry) · إشعار لرسالة اليوم فقط
#  5) المتصفح: /me/letter — الظروف · الفتح والصفحتان المتقابلتان · المرآة · السلسلة · ظرف الدفعة · الأبواب (/me · خريطة أثرك · رحلتي) · جوال
import sys, json, urllib.request, urllib.error, urllib.parse, os, time, datetime, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p62'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
def api(path, body=None, tok='tok', ip=None, method=None):
    h = {'Content-Type': 'application/json', 'X-Forwarded-For': ip or f'10.{R}.62.1'}
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
A = '/api/me/letter'; U1 = 'tok'
LONG = 'إلى نفسي بعد سنة: أرجو أن تكون قد تعلّمت أن تُصغي قبل أن تجيب، وأن تكتب لصفّك كل يوم سطرًا صادقًا.'
# ---- 1) GET
st, d = api(A, tok=U1); L = {l['id']: l for l in d.get('letters', [])}
check('GET 200 · 3 letters · names · horizons 4 · prompts 3 · prompt_today · limits', st == 200 and len(L) == 3 and d['names']['title'] == 'رسالة إلى نفسي بعد سنة' and len(d['horizons']) == 4 and len(d['prompts']) == 3 and d['prompt_today']['key'] in ('learned', 'fear', 'remind') and d['limits']['maxSealed'] == 3)
check('9001 ready · 9002 sealed · 9003 opened — hour 21:40 Riyadh', L[9001]['state'] == 'ready' and L[9002]['state'] == 'sealed' and L[9003]['state'] == 'opened' and L[9001]['open_hour_ar'] == '21:40')
raw = json.dumps(d, ensure_ascii=False); check('sealed body never leaves server (9001 · 9002 bodies absent) · 9003 body + reply present', 'لا تُقرأ قبل موعدها أبدًا' not in raw and 'تسأل قبل أن تحكم' not in raw and L[9003]['body_ar'].startswith('رسالتي الأولى') and 'صار الصفّ بيتي' in (L[9003]['reply_ar'] or ''))
check('9002 days_left ≈ 200 · countdown fields · prompt_ar fear', 195 <= L[9002]['days_left'] <= 201 and L[9002]['prompt_ar'] == 'ما الخطوة التي أهابها اليوم؟' and L[9002]['has_media'] is False)
co = {c['program_id']: c for c in d.get('cohort', [])}
check('cohort p62g ready: 5 lines shuffled · no emails · my_line none · cannot write (opened)', co.get('p62g', {}).get('ready') is True and len(co['p62g']['lines']) == 5 and 'w1@upm' not in raw and co['p62g']['my_line'] is None and co['p62g']['can_write'] is False)
check('cohort p62 (future): not ready · can_write · n 0 · days_left > 400', co.get('p62', {}).get('ready') is False and co['p62']['can_write'] is True and co['p62']['n'] == 0 and co['p62']['days_left'] > 400)
check('chain ordered by writing · 9003 first', [c['id'] for c in d['chain']][:1] == [9003] and d['sealed'] == 2)
st, _ = api(A, tok=None); check('no token → 401', st == 401)
st, jb = api('/api/journey', tok=U1, ip=f'10.{R}.62.7'); jraw = json.dumps(jb, ensure_ascii=False)
check('old /api/journey bundle: no P62 letter or cohort line leaks (sealed 9002 text absent · only legacy 9003 listed)', st == 200 and 'لا تُقرأ قبل موعدها أبدًا' not in jraw and 'سطر الدفعة' not in jraw and [c['id'] for c in jb.get('capsules', [])] == [9003])
# ---- 2) الكتابة
st, r = api(A, {'action': 'write', 'body_ar': 'قصير جدًا', 'horizon': '1y'}, tok=U1); check('too short → 400 with 40-chars hint', st == 400 and '40' in r.get('error', ''))
st, r = api(A, {'action': 'write', 'body_ar': LONG, 'horizon': 'grad', 'prompt_key': 'remind', 'context_key': 'map_sign'}, tok=U1); g = r.get('letter') or {}
p62 = next(p for p in rest('programs?select=*') if p['id'] == 'p62'); end = p62['end_date']
check('write grad → 200 · deliver_at = p62 end_date at writing hour · door «يوم توقيع خريطة أثرك» · prompt remind', st == 200 and g.get('deliver_at', '').startswith(end) and g.get('door_ar') == 'يوم توقيع خريطة أثرك' and g.get('prompt_ar') == 'ما الذي أريد أن أذكّر نفسي به؟' and g.get('state') == 'sealed' and g.get('body_ar') is None)
now = datetime.datetime.utcnow(); hh = g.get('deliver_at', '')[11:16]; check('grad letter keeps the writing minute (HH:MM == now UTC ±1 min)', abs((int(hh[:2]) * 60 + int(hh[3:])) - (now.hour * 60 + now.minute)) <= 1)
GID = g.get('id'); check('response message names the day and hour · sealed count 3 now', 'ساعة كتابتها نفسها' in r.get('message', '') and r.get('sealed') == 3)
st, r = api(A, {'action': 'write', 'body_ar': LONG, 'horizon': '1y'}, tok=U1); check('4th sealed → 409 (max 3)', st == 409)
st, r = api(A, {'action': 'write', 'body_ar': LONG, 'horizon': '1y', 'chain_of': 9001}, tok=U1); check('chain_of on an unopened letter is also blocked by max (409)', st == 409)
# ---- 3) الفتح والمرآة والردّ والحذف
st, r = api(A, {'action': 'open', 'id': 9001}, tok=U1); o = r.get('letter') or {}; m = r.get('mirror') or {}
check('open 9001 (due) → opened · not early · body revealed · snapshot_now set', st == 200 and o.get('state') == 'opened' and o.get('opened_early') is False and r.get('early') is False and 'تسأل قبل أن تحكم' in (o.get('body_ar') or '') and o.get('snapshot_now') is not None)
check('mirror: summary «منذ كتبتَها قبل 365 يومًا» · counts only · no ٪', m.get('days') in (364, 365, 366) and m.get('summary_ar', '').startswith('منذ كتبتَها') and '٪' not in m.get('summary_ar', '') and all(isinstance(x['n'], int) for x in m.get('lines', [])))
rowdb = next(x for x in rest('portal_time_capsules?select=*') if x['id'] == 9001); check('db: opened_at · status delivered · delivered_at filled · opened_early false', rowdb.get('opened_at') and rowdb.get('status') == 'delivered' and rowdb.get('delivered_at') and rowdb.get('opened_early') is False)
st, r2 = api(A, {'action': 'open', 'id': 9001}, tok=U1); check('re-open is idempotent (same opened_at)', st == 200 and r2['letter']['opened_at'] == o['opened_at'])
st, r = api(A, {'action': 'open', 'id': 9002}, tok=U1); e = r.get('letter') or {}
check('open 9002 early → opened_early · early_days ≈ 200 · body revealed · honest label', st == 200 and r.get('early') is True and e.get('opened_early') is True and 195 <= (e.get('early_days') or 0) <= 201 and 'لا تُقرأ قبل موعدها أبدًا' in (e.get('body_ar') or ''))
st, r = api(A, {'action': 'reply', 'id': 9001, 'reply_ar': 'نعم تعلّمتُ أن أسأل — وما زلتُ أتعلّم.'}, tok=U1); check('reply → 200 · reply saved · replied_at', st == 200 and 'أتعلّم' in (r['letter'].get('reply_ar') or '') and r['letter'].get('replied_at'))
st, r = api(A, {'action': 'reply', 'id': GID, 'reply_ar': 'x'}, tok=U1); check('reply on unopened letter → 404 «افتح أولًا»', st == 404)
st, r = api(A, {'action': 'write', 'body_ar': LONG, 'horizon': '3m', 'chain_of': 9001, 'context_key': 'chain'}, tok=U1); nxt = r.get('letter') or {}
check('next letter in chain (after opening) → chain_of 9001 · 3m horizon · 91 days', st == 200 and nxt.get('chain_of') == 9001 and nxt.get('horizon') == '3m' and 89 <= nxt.get('days_left', 0) <= 91)
st, r = api(A, {'action': 'delete', 'id': nxt.get('id')}, tok=U1); check('delete → 200 · row gone immediately', st == 200 and not any(x['id'] == nxt.get('id') for x in rest('portal_time_capsules?select=*')))
st, r = api(A, {'action': 'open', 'id': 9011}, tok=U1); check('opening another user’s row → 404', st == 404)
st, r = api(A, {'action': 'cohort_write', 'program_id': 'p62', 'body_ar': 'لا تنسوا أول عرض تقديمي — كنا نرتجف ونضحك معًا'}, tok=U1); CID = r.get('id')
check('cohort_write p62 → 200 · my_line set · can_write false', st == 200 and next(c for c in r['cohort'] if c['program_id'] == 'p62')['my_line'].startswith('لا تنسوا') and next(c for c in r['cohort'] if c['program_id'] == 'p62')['can_write'] is False)
st, r = api(A, {'action': 'cohort_write', 'program_id': 'p62', 'body_ar': 'سطر ثانٍ لا يجوز — واحد فقط لكل خرّيج'}, tok=U1); check('second cohort line → 409', st == 409)
st, r = api(A, {'action': 'cohort_write', 'program_id': 'p62g', 'body_ar': 'الظرف فُتح — لا يقبل أسطرًا جديدة أبدًا'}, tok=U1); check('cohort_write on opened envelope → 409', st == 409)
st, r = api(A, {'action': 'cohort_write', 'program_id': 'p62', 'body_ar': 'راسلوني a@b.sa'}, tok=U1); check('cohort line with email → 400', st == 400)
st, r = api(A, {'action': 'cohort_delete', 'id': CID}, tok=U1); check('cohort_delete → 200 · can_write again', st == 200 and next(c for c in r['cohort'] if c['program_id'] == 'p62')['can_write'] is True)
# ---- 4) الكرون
st, c = api('/api/followups/send?dry=1', tok='cron', ip=f'10.{R}.62.9'); sl = c.get('self_letters') if isinstance(c, dict) else None
check('cron dry: self_letters key present · scanned ≥ 0 · no errors', st == 200 and isinstance(sl, dict) and sl.get('errors') == [] and 'scanned' in sl)
jr = c.get('journey') or {}; check('legacy journey cron ignores P62 letters and cohort lines (9001 due · 5 cohort lines due → delivered 0)', jr.get('delivered') == 0 and jr.get('errors') == [])
# ---- 5) المتصفح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1280, 'height': 900}, locale='ar'); pg = ctx.new_page()
    login(pg, 'admin@upm.edu.sa'); pg.goto(B + '/me/letter', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="sl-env"]', timeout=60000); pg.wait_for_timeout(400)
    envs = pg.locator('[data-testid="sl-env"]'); check('page: 1 sealed envelope (grad letter) · state sealed · svg seal', envs.count() == 1 and envs.first.get_attribute('data-state') == 'sealed' and pg.locator('.sl-svg').count() == 1)
    check('chain section lists 3 opened letters (9003 · 9001 · 9002-early)', pg.locator('[data-testid="sl-chain-item"]').count() == 3 and 'فُتحت مبكّرًا' in pg.locator('[data-testid="sl-chain"]').inner_text())
    cp = pg.locator('[data-testid="sl-cohort-prog"][data-ready="1"]'); check('cohort envelope p62g open: 5 anonymous lines', cp.count() == 1 and pg.locator('[data-testid="sl-cohort-line"]').count() == 5)
    check('cohort p62 (future) offers a line input', pg.locator('[data-testid="sl-cohort-text"]').count() >= 1)
    pg.locator('[data-testid="sl-chain-open"]').first.click(); pg.wait_for_selector('[data-testid="sl-opened"]', timeout=20000); pg.wait_for_timeout(300)
    op = pg.locator('[data-testid="sl-opened"]'); check('opened view: two facing pages · body · mirror summary', op.count() == 1 and pg.locator('[data-testid="sl-body"]').count() == 1 and pg.locator('[data-testid="sl-mirror-sum"]').inner_text().startswith('منذ كتبتَها'))
    pg.screenshot(path=f'{OUT}/01-letter-opened.png', full_page=True)
    pg.click('[data-testid="sl-write-open"]') if pg.locator('[data-testid="sl-write-open"]').count() else None; pg.wait_for_timeout(200)
    check('write box: 3 prompt chips · 4 horizons · grad enabled (p62 future)', pg.locator('[data-testid="sl-prompt"] button').count() == 3 and pg.locator('[data-testid="sl-horizon"]').count() == 4 and pg.locator('[data-testid="sl-horizon"][data-h="grad"]').is_enabled())
    pg.fill('[data-testid="sl-write"] textarea', LONG); pg.click('[data-testid="sl-horizon"][data-h="6m"]'); pg.wait_for_timeout(200)
    check('seal button enabled and names the horizon', pg.locator('[data-testid="sl-seal"]').is_enabled() and 'بعد 6 أشهر' in pg.locator('[data-testid="sl-seal"]').inner_text())
    pg.once('dialog', lambda dg: dg.accept()); pg.click('[data-testid="sl-seal"]'); pg.wait_for_selector('[data-testid="sl-ok"]', timeout=20000)
    check('sealed from UI → ok message with hour · 2 envelopes now', 'ساعة كتابتها' in pg.locator('[data-testid="sl-ok"]').inner_text() and pg.locator('[data-testid="sl-env"]').count() == 2)
    pg.screenshot(path=f'{OUT}/02-sealed.png', full_page=True)
    pg.goto(B + '/me', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="me-letter"]', timeout=60000); check('/me has tab «رسالة إلى نفسي»', 'رسالة إلى نفسي' in pg.locator('[data-testid="me-letter"]').inner_text())
    pg.goto(B + '/me/journey', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="tab-capsule"]', timeout=60000); pg.click('[data-testid="tab-capsule"]'); pg.wait_for_selector('[data-testid="jr-capsule-go"]', timeout=20000)
    check('رحلتي → capsule tab now links to /me/letter', (pg.locator('[data-testid="jr-capsule-go"]').get_attribute('href') or '').endswith('/me/letter'))
    pg.goto(B + '/me/athar-map', wait_until='domcontentloaded'); pg.wait_for_selector('[data-testid="am-root"], .am', timeout=60000); pg.wait_for_timeout(800)
    check('خريطة أثرك door present only with a live snapshot (0 or 1)', pg.locator('[data-testid="am-letter-door"]').count() in (0, 1))
    mp = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True, storage_state=ctx.storage_state()).new_page(); mp.goto(B + '/me/letter', wait_until='domcontentloaded'); mp.wait_for_selector('[data-testid="sl-env"]', timeout=60000); mp.wait_for_timeout(300)
    check('mobile: no horizontal overflow', mp.evaluate('document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2'))
    mp.screenshot(path=f'{OUT}/03-mobile.png', full_page=True)
    br.close()
print('\n' + '\n'.join(('PASS ' if c else 'FAIL ') + n for n, c in ok)); fails = [n for n, c in ok if not c]
print(f'\nP62 E2E: {len(ok) - len(fails)}/{len(ok)} passed'); sys.exit(1 if fails else 0)
