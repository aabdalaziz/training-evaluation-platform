# E2E لقطات P25 «رحلة الممارس» — رحلتي (فصول من أحداث مسجَّلة فقط · حقب شهرية) → «ما تغيّر فيّ» (تعليق على فصل · رفض فصل وهمي) → مقدمة محلية من كلماتي
# → نسخة للمشاركة (تأكيد صريح · كشف انتقائي · Ed25519 · قراءة عامة بالرمز · التحقق · الإلغاء يقتل الرابط والوثيقة) → رسالة إلى نفسي بعد سنة (الختم · واحدة فقط · الإلغاء · الكرون يسلّم في الموعد فقط · أين كنت/أين صرت)
# → وكيل مفوَّض wallet:read يقرأ my_journey فقط → الخزنة تعرف الجداول الثلاثة → المتصفح: /me/journey (النهر · تعليق · نسخة · رسالة) · /journey/<code> عام · /verify/vc · رابط ملغى
import sys, json, urllib.request, urllib.error, urllib.parse, os, time, base64, hashlib, secrets
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'
os.makedirs(OUT, exist_ok=True)
urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
ok = []
R = int(time.time()) % 250 + 1
IPH = lambda n: {'X-Forwarded-For': f'10.{R}.5.{n}'}
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def patch(path, body): urllib.request.urlopen(urllib.request.Request(M + '/rest/v1/' + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='PATCH')).read()
def api(path, body=None, tok='tok', method=None, headers=None, text=False, form=None):
    h = {'Content-Type': 'application/json'}; h.update(headers or {})
    if tok: h['Authorization'] = f'Bearer {tok}'
    data = json.dumps(body).encode() if body is not None else None
    if form is not None: h['Content-Type'] = 'application/x-www-form-urlencoded'; data = urllib.parse.urlencode(form).encode()
    req = urllib.request.Request(B + path, data=data, method=method or ('POST' if data is not None else 'GET'), headers=h)
    try:
        r = urllib.request.urlopen(req); rb = r.read(); hd = {k.lower(): v for k, v in r.headers.items()}
        return r.status, (rb.decode('utf-8') if text else (json.loads(rb) if rb else {})), hd
    except urllib.error.HTTPError as e:
        rb = e.read() or b''; hd = {k.lower(): v for k, v in e.headers.items()}
        try: return e.code, (rb.decode('utf-8') if text else json.loads(rb or b'{}')), hd
        except Exception: return e.code, {}, hd
V = 'io.modelcontextprotocol/protocolVersion'

# 0) عزل: بذور P62 (رسائل u1 المختومة 9001–9003) تُحذف حتى يبقى سلوك كبسولة P25 كما كان · الفصل credential:…083 (إكمال برنامج، بذرة لاحقة) يُستثنى من العدّ
for _cid in (9001, 9002, 9003):
    try: urllib.request.urlopen(urllib.request.Request(M + f'/rest/v1/portal_time_capsules?id=eq.{_cid}', method='DELETE')).read()
    except Exception: pass
P25_KEYS = lambda ch: [c['key'] for c in ch if c['key'] != 'credential:00000000-0000-4000-8000-000000000083']
# 1) رحلتي
st, _, _ = api('/api/journey', tok=None); check('/api/journey without token → 401', st == 401)
st, j, hj = api('/api/journey'); J = j.get('journey', {}); keys = P25_KEYS(J.get('chapters', []))
check('GET /api/journey 200 · no-store · 5 chapters from recorded events only (council joined → case → return → credential → approved level) · chronological', st == 200 and 'no-store' in hj.get('cache-control', '') and keys[:3] == ['council_joined', 'case_first', 'return_first'] and len(keys) == 5 and keys == sorted(keys, key=lambda k: next(c['at'] for c in J['chapters'] if c['key'] == k)))
check('chapters carry the user’s own words only (commitment + return quotes) · no email · eras by month (3) · arc sentence · rules (12 months · 365 days · signing ready)', J['chapters'][1]['quote_ar'] and J['chapters'][2]['quote_ar'] and '@' not in json.dumps(J['chapters'], ensure_ascii=False) and len(J['eras']) == 3 and 'فصول' in J['arc_ar'] and j['rules']['share_months'] == 12 and j['rules']['capsule_days'] == 365 and j['rules']['signing_ready'] is True)
check('level chapter: skill name + approved level (from null on first approval) · credential chapter titled شهادة مهارة', next(c for c in J['chapters'] if c['kind'] == 'level')['level']['to'] == 4 and next(c for c in J['chapters'] if c['kind'] == 'level')['level']['from'] is None and next(c for c in J['chapters'] if c['kind'] == 'credential')['title_ar'] == 'شهادة مهارة')

# 2) ما تغيّر فيّ
st, n1, _ = api('/api/journey', {'action': 'note', 'chapter_key': 'return_first', 'body_ar': 'تعلّمت أن أبدأ بالصغير قبل أن أطلب الكبير.'}, headers=IPH(1))
check('note on a real chapter → saved (text kind) with message «هذا صوتك أنت»', st == 200 and n1['note']['chapter_key'] == 'return_first' and n1['note']['kind'] == 'text' and 'صوتك' in n1.get('message', ''))
st, n2, _ = api('/api/journey', {'action': 'note', 'chapter_key': 'return_first', 'body_ar': 'تعلّمت أن أبدأ بالصغير قبل أن أطلب الكبير — وأن أعود بما حدث.'}, headers=IPH(1))
st3, jj, _ = api('/api/journey'); check('second note on same chapter updates (still 1 note) · GET returns it', st == 200 and len(jj['notes']) == 1 and jj['notes'][0]['body_ar'].endswith('بما حدث.'))
st, nb, _ = api('/api/journey', {'action': 'note', 'chapter_key': 'ghost_chapter', 'body_ar': 'x'}, headers=IPH(1)); check('note on a non-existent chapter → 400 «الفصل غير موجود»', st == 400 and 'غير موجود' in nb.get('error', ''))
st, ne, _ = api('/api/journey', {'action': 'note', 'chapter_key': 'case_first', 'body_ar': ''}, headers=IPH(1)); check('empty note (no text, no media) → 400', st == 400)
st, it, _ = api('/api/journey', {'action': 'intro'}, headers=IPH(1))
check('intro suggestion (no AI key → local) built from arc + first/last chapter + my own note as quote · not saved automatically', st == 200 and it['intro']['source'] == 'local' and 'انضممتُ إلى مجلس' in it['intro']['text'] and 'بكلماتي يومها' in it['intro']['text'] and 'تعلّمت أن أبدأ' in it['intro']['text'])

# 3) نسخة للمشاركة
st, s0, _ = api('/api/journey', {'action': 'share', 'chapter_keys': ['case_first']}, headers=IPH(2)); check('share without explicit confirm → 400', st == 400)
st, s0, _ = api('/api/journey', {'action': 'share', 'chapter_keys': ['nope'], 'confirm': True}, headers=IPH(2)); check('share with unknown chapter → 400', st == 400)
st, s0, _ = api('/api/journey', {'action': 'share', 'chapter_keys': [], 'confirm': True}, headers=IPH(2)); check('share with no chapters → 400', st == 400)
st, s1, _ = api('/api/journey', {'action': 'share', 'chapter_keys': ['case_first', 'return_first'], 'name_mode': 'short', 'include_quotes': True, 'intro_ar': 'هذه رحلتي كما وقعت، بلا تجميل.', 'confirm': True}, headers=IPH(2))
SH = s1.get('share') or {}; CODE = SH.get('code', '')
check('share 2 of 5 chapters (short name, quotes) → ATH-J code · signed VC · public url + verify url · expires in 12 months', st == 200 and CODE.startswith('ATH-J-') and s1.get('signed_vc') is True and s1['url'].endswith('/journey/' + CODE) and CODE in s1['verify_url'] and SH['display_name'] == 'Ahmed A.' and len(SH['chapters']) == 2 and SH['expires_at'][:4] == '2027')
iss = [x for x in rest('portal_vc_issuances?select=*') if x.get('code') == CODE]
check('vc issuance row: kind=journey · credential_id null · digest set · doc type OpenBadgeCredential · 2 chapters in _athar · no email inside', len(iss) == 1 and iss[0]['kind'] == 'journey' and iss[0].get('credential_id') is None and iss[0].get('digest') and iss[0]['vc']['type'] == ['VerifiableCredential', 'OpenBadgeCredential'] and len(iss[0]['vc']['_athar']['chapters']) == 2 and 'admin@upm' not in json.dumps(iss[0]['vc']))
st, pub, hp = api(f'/api/journey?code={CODE.lower()}', tok=None)
check('public GET by code (anon, lowercase ok): 2 chapters · short name · intro · quotes · verify_url · views=1 · CORS · no email/ids', st == 200 and len(pub['chapters']) == 2 and pub['name'] == 'Ahmed A.' and pub['intro_ar'].startswith('هذه رحلتي') and pub['chapters'][0]['quote_ar'] and pub['views'] == 1 and pub['verify_url'] and hp.get('access-control-allow-origin') == '*' and 'admin@upm' not in json.dumps(pub) and 'ref' not in pub['chapters'][0])
st, pub2, _ = api(f'/api/journey?code={CODE}&count=0', tok=None); check('count=0 does not increment views (still 1 after first view)', st == 200 and pub2['views'] == 1)
st, nf, _ = api('/api/journey?code=ATH-J-ZZZZ-ZZZZ', tok=None); check('unknown code → 404', st == 404)
st, bd, _ = api('/api/journey?code=hello', tok=None); check('malformed code → 400', st == 400)
st, vcd, _ = api(f'/api/vc?code={CODE}', tok=None); st2, vfy, _ = api('/api/vc', {'action': 'verify', 'vc': vcd}, tok=None, headers=IPH(3))
check('/api/vc?code=ATH-J… returns the signed journey VC · server verify → ok, all 6 checks pass · holder = display name', st == 200 and vcd.get('proof') and st2 == 200 and vfy.get('ok') is True and all(c.get('ok') for c in vfy.get('checks', [])) and vfy['summary']['holder'] == 'Ahmed A.')
st, s2, _ = api('/api/journey', {'action': 'share', 'chapter_keys': ['council_joined', 'case_first', 'return_first'], 'name_mode': 'full', 'include_quotes': False, 'confirm': True}, headers=IPH(2)); CODE2 = (s2.get('share') or {}).get('code', '')
st, pubq, _ = api(f'/api/journey?code={CODE2}', tok=None); check('second share without quotes: full name · quote_ar null on every chapter', st == 200 and pubq['name'] == 'Ahmed Abdelaziz' and all(c['quote_ar'] is None for c in pubq['chapters']))
st, mine, _ = api('/api/journey'); check('GET mine lists 2 active shares with urls + views', len(mine['shares']) == 2 and all(s['status'] == 'active' and s['url'] for s in mine['shares']) and next(s for s in mine['shares'] if s['code'] == CODE)['views'] == 1)

# 4) رسالة إلى نفسي بعد سنة
st, c0, _ = api('/api/journey', {'action': 'capsule', 'body_ar': 'قصيرة', 'confirm': True}, headers=IPH(4)); check('capsule shorter than 40 chars (no media) → 400', st == 400)
st, c0, _ = api('/api/journey', {'action': 'capsule', 'body_ar': 'إلى نفسي بعد سنة: أرجو أن أكون قد تعلّمت أن أسأل قبل أن أحكم، وأن أعود دائمًا بما حدث.'}, headers=IPH(4)); check('capsule without confirm → 400', st == 400)
st, c1, _ = api('/api/journey', {'action': 'capsule', 'body_ar': 'إلى نفسي بعد سنة: أرجو أن أكون قد تعلّمت أن أسأل قبل أن أحكم، وأن أعود دائمًا بما حدث.', 'confirm': True}, headers=IPH(4)); CAP = c1.get('capsule') or {}
dd = (time.mktime(time.strptime(CAP.get('deliver_at', '2000-01-01')[:10], '%Y-%m-%d')) - time.time()) / 86400
check('seal capsule → sealed · deliver_at ≈ +365 d · snapshot_then = 5 chapters + approved level · message names the date', st == 200 and CAP['status'] == 'sealed' and 363 <= dd <= 366 and CAP['snapshot_then']['chapters'] >= 5 and CAP['snapshot_then']['levels'] and 'تصلك في' in c1.get('message', ''))
st, c2, _ = api('/api/journey', {'action': 'capsule', 'body_ar': 'رسالة ثانية بينما الأولى مختومة — يجب أن تُرفض لأن لديّ رسالة مختومة بالفعل.', 'confirm': True}, headers=IPH(4)); check('second capsule while one is sealed → 409', st == 409)
st, cx, _ = api('/api/journey', {'action': 'capsule_cancel', 'id': CAP['id']}, headers=IPH(4)); check('cancel sealed capsule → cancelled', st == 200 and next(c for c in rest('portal_time_capsules?select=*') if c['id'] == CAP['id'])['status'] == 'cancelled')
st, c3, _ = api('/api/journey', {'action': 'capsule', 'body_ar': 'إلى نفسي بعد سنة: لا تنسَ لماذا بدأت. اسأل قبل أن تنصح، وعد بما حدث لا بما تمنيت.', 'confirm': True}, headers=IPH(4)); CAP2 = c3.get('capsule') or {}
st, cr0, _ = api('/api/followups/send?dry=1', tok='cron'); check('daily cron (dry) → journey {delivered 0, expired 0} — nothing due yet', st == 200 and cr0.get('journey', {}).get('delivered') == 0 and cr0['journey'].get('expired') == 0)
patch(f'portal_time_capsules?id=eq.{CAP2["id"]}', {'deliver_at': '2026-10-01T00:00:00Z', 'created_at': '2025-10-01T00:00:00Z'})
st, cr1, _ = api('/api/followups/send?dry=1', tok='cron'); check('cron dry with a due capsule → delivered 1 but row stays sealed', st == 200 and cr1['journey']['delivered'] == 1 and next(c for c in rest('portal_time_capsules?select=*') if c['id'] == CAP2['id'])['status'] == 'sealed')
st, cr2, _ = api('/api/followups/send', tok='cron'); row = next(c for c in rest('portal_time_capsules?select=*') if c['id'] == CAP2['id'])
check('cron live → delivered · delivered_at · snapshot_now (5 chapters) · delivery_text says «أين كنت/أين صرت» · message_log row kind time_capsule', st == 200 and cr2['journey']['delivered'] == 1 and row['status'] == 'delivered' and row['delivered_at'] and row['snapshot_now']['chapters'] >= 5 and 'كتبتَها لنفسك' in row['meta']['delivery_text'] and any(m.get('kind') == 'time_capsule' for m in rest('portal_message_log?select=*')))
st, cr3, _ = api('/api/followups/send', tok='cron'); check('cron again → no double delivery', st == 200 and cr3['journey']['delivered'] == 0)
# الكرون نفسه زامن مِعيار في المختبر → حدث «أول قياس» أُضيف فصلًا جديدًا (الرحلة تنمو من الأحداث وحدها)
st, mn, _ = api('/api/journey'); N = len(mn['journey']['chapters']); check('after the cron, a new «أول قياس» chapter appeared from the synced placement event (journey grows only from events) → 6 chapters', N == 6 and any(c['key'] == 'placement_first' for c in mn['journey']['chapters']))
st, mine2, _ = api('/api/journey'); check('GET mine shows the delivered capsule with then/now snapshots; sealing a new one is allowed again', any(c['status'] == 'delivered' and c['snapshot_now'] for c in mine2['capsules']) and not any(c['status'] == 'sealed' for c in mine2['capsules']))
ev = rest('portal_learning_events?select=*'); check('learning events recorded: shared journey ×2 · sealed ×2 · received ×1', sum(1 for e in ev if e.get('object_type') == 'journey' and e.get('verb') == 'shared') == 2 and sum(1 for e in ev if e.get('object_type') == 'time_capsule' and e.get('verb') == 'sealed') == 2 and sum(1 for e in ev if e.get('object_type') == 'time_capsule' and e.get('verb') == 'received') == 1)

# 5) وكيل مفوَّض wallet:read
st, reg, _ = api('/oauth/register', {'client_name': 'مساعد الرحلة', 'redirect_uris': ['http://localhost:9/cb'], 'application_type': 'native'}, tok=None); CID = reg.get('client_id', '')
verifier = base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip('='); challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip('=')
params = {'response_type': 'code', 'client_id': CID, 'redirect_uri': 'http://localhost:9/cb', 'scope': 'wallet:read', 'state': 's1', 'code_challenge': challenge, 'code_challenge_method': 'S256'}
st, apv, _ = api('/api/oauth', {'action': 'approve', 'params': params}); code = dict(urllib.parse.parse_qsl(urllib.parse.urlparse(apv['redirect']).query))['code']
st, tk, _ = api('/oauth/token', tok=None, form={'grant_type': 'authorization_code', 'code': code, 'code_verifier': verifier, 'redirect_uri': 'http://localhost:9/cb', 'client_id': CID}); AT = tk.get('access_token', '')
st, tl, _ = api('/mcp', {'jsonrpc': '2.0', 'id': 1, 'method': 'tools/list', 'params': {'_meta': {V: '2026-07-28'}}}, tok=AT, headers={'Mcp-Method': 'tools/list'}); names = [t['name'] for t in tl.get('result', {}).get('tools', [])]
check('tools/list (wallet:read): my_journey + my_wallet present (read-only) · council_commit absent', 'my_journey' in names and 'my_wallet' in names and 'council_commit' not in names)
st, mj, _ = api('/mcp', {'jsonrpc': '2.0', 'id': 2, 'method': 'tools/call', 'params': {'name': 'my_journey', 'arguments': {}, '_meta': {V: '2026-07-28'}}}, tok=AT); sc = mj.get('result', {}).get('structuredContent', {})
check('my_journey → chapters 5 · days · arc · latest 5 · 2 active shares with codes · capsules list · read-only note pointing to /me/journey', st == 200 and sc.get('chapters') == N and sc.get('arc_ar') and len(sc.get('latest', [])) == 5 and len(sc.get('shares', [])) == 2 and 'note_ar' in sc and '/me/journey' in sc['note_ar'])
st, tlp, _ = api('/mcp/public', {'jsonrpc': '2.0', 'id': 3, 'method': 'tools/list', 'params': {'_meta': {V: '2026-07-28'}}}, tok=None, headers={'Mcp-Method': 'tools/list'}); check('anonymous MCP does not expose my_journey', 'my_journey' not in [t['name'] for t in tlp.get('result', {}).get('tools', [])])
st, dgw, _ = api('/api/journey', {'action': 'note', 'chapter_key': 'case_first', 'body_ar': 'الوكيل يحاول الكتابة'}, tok=None, headers={'X-Athar-Delegate': 'bogus'}); check('writing without user token → 401 (agents cannot write the journey)', st == 401)

# 6) الخزنة
st, vt, _ = api('/api/vault'); tnames = {m.get('table') for m in vt.get('map', [])}
check('vault map lists portal_journey_notes / portal_journey_shares / portal_time_capsules (PDPL registry)', st == 200 and {'portal_journey_notes', 'portal_journey_shares', 'portal_time_capsules'} <= tnames)

# 7) المتصفح
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1280, 'height': 900})
    pg.goto(B + f'/journey/{CODE}'); pg.wait_for_selector('[data-testid="pj-river"]', timeout=20000); pg.wait_for_timeout(500)
    ht = pg.locator('[data-testid="pj-head"]').inner_text()
    check('/journey/<code> (logged-out): short name · intro · 2 chapters · verify link · own-words quotes', 'Ahmed A.' in ht and 'هذه رحلتي' in ht and pg.locator('[data-testid="pj-chapter"]').count() == 2 and pg.locator('[data-testid="verify"]').count() == 1 and 'بكلماته يومها' in pg.locator('[data-testid="pj-river"]').inner_text())
    pg.screenshot(path=f'{OUT}/01-public-journey.png', full_page=True)
    pg.goto(B + f'/verify/vc?code={urllib.parse.quote(CODE)}'); pg.wait_for_selector('[data-testid="vc-result"]', timeout=30000); vt_ = pg.locator('[data-testid="vc-result"]').inner_text()
    check('/verify/vc?code=ATH-J-… verifies the journey VC in the browser (ok=1 · holder short name)', pg.locator('[data-testid="vc-result"]').get_attribute('data-ok') == '1' and 'Ahmed A.' in vt_)
    pg.screenshot(path=f'{OUT}/02-verify-journey.png', full_page=True)
    pg.goto(B + '/login'); pg.fill('input[type=email]', 'admin@upm.edu.sa'); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url('**/dashboard', timeout=20000)
    pg.goto(B + '/me'); pg.wait_for_selector('.me-tabs', timeout=20000); check('/me nav has «رحلتي» tab → /me/journey', pg.locator('.me-tabs a[href="/me/journey"]').count() == 1)
    pg.goto(B + '/me/journey'); pg.wait_for_selector('[data-testid="river"]', timeout=20000); pg.wait_for_timeout(600)
    check('/me/journey: arc banner · 6 chapter cards in 3 eras · existing note shown on «أول عودة»', pg.locator('[data-testid="arc"]').count() == 1 and pg.locator('[data-testid="chapter"]').count() == N and pg.locator('.jr-eralabel').count() == 3 and pg.locator('[data-testid="note"]').count() == 1 and 'بما حدث' in pg.locator('[data-testid="note"]').inner_text())
    pg.screenshot(path=f'{OUT}/03-me-journey-river.png', full_page=True)
    first = pg.locator('[data-testid="chapter"]').first; first.locator('[data-testid="note-edit"]').click(); pg.wait_for_selector('[data-testid="note-channel"] textarea', timeout=10000)
    pg.fill('[data-testid="note-channel"] textarea', 'أول مرة أجلس مع أقران من جهات أخرى — اكتشفت أن مشكلتي ليست فريدة.'); pg.click('[data-testid="note-save"]'); pg.wait_for_timeout(1500)
    st_, m3, _ = api('/api/journey'); check('note written from the UI on «انضممتُ إلى مجلس» → saved (2 notes now) and rendered', len(m3['notes']) == 2 and pg.locator('[data-testid="note"]').count() == 2)
    pg.click('[data-testid="tab-share"]'); pg.wait_for_selector('[data-testid="pick"]', timeout=10000)
    check('share tab: 6 checkboxes · 2 existing share rows · create button disabled until a chapter is picked', pg.locator('[data-testid="pick"] input[type=checkbox]').count() == N and pg.locator('[data-testid="share-row"]').count() == 2 and pg.locator('[data-testid="share-create"]').is_disabled())
    pg.locator('[data-testid="pick"] input[type=checkbox]').nth(0).check(); pg.locator('[data-testid="pick"] input[type=checkbox]').nth(N - 1).check()
    pg.click('[data-testid="intro-ai"]'); pg.wait_for_timeout(1500); check('«اقترح لي مقدمة من كلماتي» fills the intro textarea (local source note shown)', len(pg.input_value('[data-testid="intro"]')) > 40 and 'محليًا' in pg.locator('.jr-rowbtns small').inner_text())
    pg.once('dialog', lambda d: d.accept()); pg.click('[data-testid="share-create"]'); pg.wait_for_selector('[data-testid="share-link"]', timeout=15000)
    st_, m4, _ = api('/api/journey'); check('share from UI (2 chapters incl. approved level) → link box with verify link · 3 shares now', pg.locator('[data-testid="share-link"] a[href*="/journey/ATH-J-"]').count() == 1 and pg.locator('[data-testid="share-link"] a[href*="/verify/vc?code="]').count() == 1 and len(m4['shares']) == 3)
    pg.screenshot(path=f'{OUT}/04-me-journey-share.png', full_page=True)
    pg.once('dialog', lambda d: d.accept()); pg.locator('[data-testid="share-revoke"]').first.click(); pg.wait_for_timeout(1500)
    st_, m5, _ = api('/api/journey'); check('revoke newest share from UI → 2 active + 1 revoked', sum(1 for s in m5['shares'] if s['status'] == 'active') == 2 and sum(1 for s in m5['shares'] if s['status'] == 'revoked') == 1)
    pg.click('[data-testid="tab-capsule"]'); pg.wait_for_selector('[data-testid="capsule-channel"] textarea', timeout=10000)
    check('capsule tab: delivered capsule card (then/now) · seal button disabled until 40 chars', pg.locator('[data-testid="delivered"]').count() == 1 and 'أين كنت' in pg.locator('[data-testid="delivered"]').inner_text() and pg.locator('[data-testid="capsule-seal"]').is_disabled())
    pg.fill('[data-testid="capsule-channel"] textarea', 'إلى نفسي بعد سنة: أرجو أن تكون قد تعلّمت أن تصمت أكثر وتسأل أكثر، وأن تعود إلى مجلسك بما حدث.'); pg.wait_for_timeout(200)
    pg.once('dialog', lambda d: d.accept()); pg.click('[data-testid="capsule-seal"]'); pg.wait_for_selector('[data-testid="sealed"]', timeout=15000)
    check('seal from UI → «رسالتك مختومة» card with delivery date and days left', 'مختومة' in pg.locator('[data-testid="sealed"]').inner_text() and 'يومًا' in pg.locator('[data-testid="sealed"]').inner_text())
    pg.screenshot(path=f'{OUT}/05-me-journey-capsule.png', full_page=True)
    # إلغاء نسخة عبر API ثم فتح رابطها العام
    api('/api/journey', {'action': 'share_revoke', 'id': SH['id']}, headers=IPH(6))
    pg.goto(B + f'/journey/{CODE}'); pg.wait_for_selector('[data-testid="gone"]', timeout=20000)
    st_, gone, _ = api(f'/api/journey?code={CODE}', tok=None); iss2 = next(x for x in rest('portal_vc_issuances?select=*') if x.get('code') == CODE)
    check('revoked share: public page shows «ألغى صاحب الرحلة هذه النسخة» · API 410 · VC issuance revoked_at set', 'ألغى صاحب الرحلة' in pg.locator('[data-testid="gone"]').inner_text() and st_ == 410 and iss2.get('revoked_at'))
    pg.screenshot(path=f'{OUT}/06-public-revoked.png', full_page=False)
    br.close()

passed = sum(1 for _, c in ok if c); print(f'\n{passed}/{len(ok)} passed')
for n, c in ok:
    if not c: print('  FAILED:', n)
sys.exit(0 if passed == len(ok) else 1)
