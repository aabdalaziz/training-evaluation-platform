# E2E P60 «لأن… بصوتك» (خريطتك مسموعة)
#  1) API (نورة): صوت على خيط غير مُبقى 404 · نوع غريب 400 · رفع 200 (sec/replaced/map.voice) · إعادة الرفع تستبدل (ملف واحد) · رابط موقَّع · ?all=1 · غير صاحبه 404 · بلا دخول 401
#  2) الصوت لا يسافر: نسيج الشعبة (المدرّب) بلا voice/map-voice · اللقطة الموقَّعة تحمل «خيط واحد من خيوطك بصوتك» فقط · /verify/map بلا مسار
#  3) حذف فوري: DELETE → الملف 404 في المخزن · حذف الخيط يحذف الصوت
#  4) المتصفح: شارة 🎙️ · «اسمع خريطتك» → الآن/الخيط المضاء · بطاقة الخيط: اسمع/أعد/احذف · المسجّل يظهر · «احذف صوتي» يزيل الشارة · ?play=1 من «نادِ» · التذييل · جوّال 390 · a11y · لا أخطاء
import sys, json, urllib.request, urllib.error, urllib.parse, os, time, uuid, warnings; warnings.filterwarnings('ignore')
from playwright.sync_api import sync_playwright
B = 'http://127.0.0.1:3100'; M = 'http://127.0.0.1:54321'; OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots-p60'
os.makedirs(OUT, exist_ok=True); ok = []; R = int(time.time()) % 250 + 1
def check(name, cond): ok.append((name, bool(cond))); print(('PASS ' if cond else 'FAIL ') + name)
def rest(path): return json.load(urllib.request.urlopen(M + '/rest/v1/' + path))
def reset(): urllib.request.urlopen(urllib.request.Request(M + '/__reset', method='POST')).read()
def obj_status(path):
    try: urllib.request.urlopen(M + '/storage/v1/object/athar-media/' + path); return 200
    except urllib.error.HTTPError as e: return e.code
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
    def voice(self, fields, file=None, tok=None):
        bd = '----p60' + uuid.uuid4().hex; parts = []
        for k, v in fields.items(): parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        if file: name, ctype, data = file; parts.append(f'--{bd}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {ctype}\r\n\r\n'.encode() + data + b'\r\n')
        body = b''.join(parts) + f'--{bd}--\r\n'.encode()
        h = {'Content-Type': f'multipart/form-data; boundary={bd}', 'X-Forwarded-For': self.ip}
        if tok or self.tok: h['Authorization'] = f'Bearer {tok or self.tok}'
        req = urllib.request.Request(B + '/api/me/map/voice', data=body, method='POST', headers=h)
        try:
            r = urllib.request.urlopen(req); return r.status, json.loads(r.read() or b'{}')
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read() or b'{}')
            except Exception: return e.code, {}
reset(); time.sleep(31)
nu = Client(f'10.{R}.60.2', tok='tok-u2'); kh = Client(f'10.{R}.60.3', tok='tok-u3'); tr = Client(f'10.{R}.60.1', tok='tok'); anon = Client(f'10.{R}.60.9')
WEBM = b'\x1a\x45\xdf\xa3' + bytes(4000); M4A = b'\x00\x00\x00\x18ftypM4A ' + bytes(3000)
# ---- 1) API
st, d = nu.call('/api/me/map'); th = d['map']['threads']; prop = [t for t in th if t['status'] == 'proposed']; kept0 = [t for t in th if t['status'] == 'kept']
print('noura threads:', len(th), 'proposed', len(prop), 'kept', len(kept0))
T = prop[0]; F, TO = T['from'], T['to']; q = f"from={urllib.parse.quote(F)}&to={urllib.parse.quote(TO)}"
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 8}, ('v.webm', 'audio/webm', WEBM)); check('voice on a proposed (unkept) thread → 404', st == 404)
st, d = nu.call('/api/me/map', {'action': 'keep', 'from': F, 'to': TO, 'note': 'لأن هذا الخيط غيّر طريقتي'}); check('keep thread (text «لأن…» first)', st == 200)
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 8}, ('v.txt', 'text/plain', WEBM)); check('bad mime → 400', st == 400)
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 40}, ('v.webm', 'audio/webm', WEBM)); check('40 s → 400 (limit 15 s)', st == 400)
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 8}, ('v.webm', 'audio/webm', WEBM)); v = d.get('voice') or {}; mt = next((t for t in d.get('map', {}).get('threads', []) if t['from'] == F and t['to'] == TO), {})
check('upload 200 · voice.sec 8 · replaced false · map thread carries voice {sec,at} only', st == 200 and v.get('sec') == 8 and d.get('replaced') is False and mt.get('voice', {}).get('sec') == 8 and set(mt.get('voice', {}).keys()) == {'sec', 'at'})
rows = [r for r in rest('portal_map_threads') if r.get('email') == 'noura@upm.edu.sa' and r.get('from_key') == F and r.get('to_key') == TO]; row = rows[0] if rows else {}; nv = row.get('note_voice') or {}; path1 = nv.get('path', '')
check('row note_voice.path = map-voice/<user>/<row id>.webm · stored object exists', path1.startswith('map-voice/') and path1.endswith('.webm') and obj_status(path1) == 200)
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 5}, ('v.m4a', 'audio/mp4', M4A)); row = [r for r in rest('portal_map_threads') if r.get('id') == row.get('id')][0]; path2 = (row.get('note_voice') or {}).get('path', '')
check('re-upload replaces: replaced true · new .m4a path · old .webm removed from storage', st == 200 and d.get('replaced') is True and path2.endswith('.m4a') and obj_status(path2) == 200 and obj_status(path1) == 404)
st, d = nu.call(f'/api/me/map/voice?{q}'); check('GET signed url for owner · sec 5 · expires 300', st == 200 and 'url' in d and d.get('sec') == 5 and d.get('expires_in') == 300)
st, d = nu.call('/api/me/map/voice?all=1'); check('GET ?all=1 → 1 url keyed by thread', st == 200 and d.get('count') == 1 and f'{F}>{TO}' in d.get('urls', {}))
st, d = kh.call(f'/api/me/map/voice?{q}'); check('another learner → 404 (not his thread)', st == 404)
st, d = anon.call(f'/api/me/map/voice?{q}'); check('no token → 401', st == 401)
st, d = anon.voice({'from': F, 'to': TO, 'duration_sec': 8}, ('v.webm', 'audio/webm', WEBM)); check('no token upload → 401', st == 401)
# ---- 2) الصوت لا يسافر
st, d = nu.call('/api/me/map', {'action': 'share', 'from': F, 'to': TO, 'share': True})
st, d = tr.call('/api/me/day/weave?classroom=c1&fresh=1'); raw = json.dumps(d, ensure_ascii=False)
check('trainer weave (fresh): no voice / map-voice / note_voice anywhere in JSON', st == 200 and 'map-voice' not in raw and 'note_voice' not in raw and '"voice"' not in raw)
st, d = nu.call('/api/me/map', {'action': 'sign', 'is_public': True}); code = (d.get('snap') or {}).get('code', ''); snaps = rest('portal_map_snapshots'); body = next((s.get('body') for s in snaps if s.get('code') == code), {}) or {}
check('signed snapshot: mirror_ar has «خيط واحد من خيوطك بصوتك» · no path in body', st == 200 and 'خيط واحد من خيوطك بصوتك' in (body.get('mirror_ar') or []) and 'map-voice' not in json.dumps(body))
st, d = anon.call(f'/api/verify/map?code={code}'); raw = json.dumps(d, ensure_ascii=False)
check('/api/verify/map: valid · no map-voice/note_voice', st == 200 and d.get('valid') is True and 'map-voice' not in raw and 'note_voice' not in raw)
# ---- 3) حذف
st, d = nu.call(f'/api/me/map/voice?{q}', method='DELETE'); row = [r for r in rest('portal_map_threads') if r.get('id') == row.get('id')][0]
check('DELETE → had true · row note_voice {} · object gone · thread + note stay', st == 200 and d.get('had') is True and (row.get('note_voice') or {}) == {} and obj_status(path2) == 404 and row.get('status') == 'kept' and row.get('note_ar'))
st, d = nu.call(f'/api/me/map/voice?{q}'); check('GET after delete → 404', st == 404)
st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 6}, ('v.webm', 'audio/webm', WEBM)); row = [r for r in rest('portal_map_threads') if r.get('id') == row.get('id')][0]; path3 = (row.get('note_voice') or {}).get('path', '')
st, d = nu.call('/api/me/map', {'action': 'remove', 'from': F, 'to': TO}); check('remove thread → its voice object removed too', st == 200 and obj_status(path3) == 404)
# نعيد الخيط بصوت للمتصفح
nu.call('/api/me/map', {'action': 'keep', 'from': F, 'to': TO, 'note': 'لأن هذا الخيط غيّر طريقتي'}); st, d = nu.voice({'from': F, 'to': TO, 'duration_sec': 7}, ('v.webm', 'audio/webm', WEBM)); check('re-keep + voice for the browser pass', st == 200)
# ---- 4) المتصفح
def login(pg, email):
    pg.goto(B + '/login', wait_until='domcontentloaded'); pg.fill('input[type=email]', email); pg.click('[data-testid="login-mode-password"]'); pg.fill('input[type=password]', 'x'); pg.click('button[type=submit]'); pg.wait_for_url(lambda u: '/login' not in u, timeout=60000)
errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    lp = br.new_context(viewport={'width': 1380, 'height': 950}, locale='ar').new_page(); lp.on('pageerror', lambda e: errs.append(lp.url + ' ' + str(e)))
    login(lp, 'noura@upm.edu.sa'); lp.goto(B + '/me/athar-map', wait_until='domcontentloaded'); lp.wait_for_selector('[data-testid="am-svg"]', timeout=60000); lp.wait_for_timeout(800)
    check('kept card shows 🎙️ «بصوتك (7 ث)» badge', lp.locator('[data-testid="am-voice-badge"]').count() == 1 and '7 ث' in lp.locator('[data-testid="am-voice-badge"]').inner_text())
    pl = lp.locator('[data-testid="am-player"]'); check('player bar: «اسمع خريطتك» · «1 بصوتك»', pl.count() == 1 and 'اسمع خريطتك' in pl.inner_text() and '1 بصوتك' in pl.inner_text())
    lp.click('[data-testid="am-play-all"]'); lp.wait_for_selector('[data-testid="am-play-now"]', timeout=10000)
    snap = lp.evaluate('''() => { const n = document.querySelector('[data-testid="am-play-now"]'); return { txt: n ? n.textContent : '', live: n ? n.getAttribute('aria-live') : null, active: document.querySelectorAll('[data-testid="am-active"]').length, stop: !!document.querySelector('[data-testid="am-play-stop"]') }; }''')
    print('playing:', snap); check('playing: now line «1/N» · aria-live · active thread lit in SVG (am-active) · stop button', '1/' in snap['txt'] and snap['live'] == 'polite' and snap['active'] == 1 and snap['stop'])
    lp.screenshot(path=f'{OUT}/01-playing.png', full_page=True)
    if lp.locator('[data-testid="am-play-stop"]').count(): lp.click('[data-testid="am-play-stop"]')
    lp.wait_for_selector('[data-testid="am-play-all"]', timeout=8000); check('stop/end → player idle again · no active thread', lp.locator('[data-testid="am-active"]').count() == 0)
    lp.locator('[data-testid="am-kept-item"]').filter(has=lp.locator('[data-testid="am-voice-badge"]')).locator('.am-linkbtn').first.click(); lp.wait_for_selector('[data-testid="am-voice"]', timeout=10000)
    vb = lp.locator('[data-testid="am-voice"]'); check('thread card: «قلتَها بصوتك» · hear · redo · delete', 'قلتَها بصوتك' in vb.inner_text() and lp.locator('[data-testid="am-voice-hear"]').count() == 1 and lp.locator('[data-testid="am-voice-redo"]').count() == 1 and lp.locator('[data-testid="am-voice-clear"]').count() == 1)
    lp.click('[data-testid="am-voice-redo"]'); lp.wait_for_selector('[data-testid="am-voice-recorder-box"]', timeout=10000); check('redo opens the P54 recorder (same component) with «احفظ صوتي»', lp.locator('[data-testid="am-voice-recorder-start"]').count() == 1)
    lp.screenshot(path=f'{OUT}/02-card.png', full_page=True)
    lp.once('dialog', lambda dlg: dlg.accept()); lp.click('[data-testid="am-voice-clear"]'); lp.wait_for_selector('[data-testid="am-voice-rec"]', timeout=15000)
    check('«احذف صوتي» → immediate: card offers 🎙️ again · badge gone · thread still kept', lp.locator('[data-testid="am-voice-badge"]').count() == 0 and lp.locator('[data-testid="am-kept-item"]').count() >= 1 and lp.locator('[data-testid="am-thread-card"]').inner_text().count('لأن') >= 1)
    rows = [r for r in rest('portal_map_threads') if r.get('email') == 'noura@upm.edu.sa' and r.get('from_key') == F]; check('row after UI delete: note_voice {}', rows and (rows[0].get('note_voice') or {}) == {})
    foot = lp.locator('[data-testid="am-voice-foot"]'); check('footer principle «صوتك لك وحدك؛ كلمتك المكتوبة هي ما يسافر»', foot.count() == 1 and 'صوتك لك وحدك' in foot.inner_text())
    lp.goto(B + '/me/athar-map?play=1', wait_until='domcontentloaded'); lp.wait_for_selector('[data-testid="am-player"]', timeout=60000)
    try: lp.wait_for_selector('[data-testid="am-play-now"], [data-testid="am-play-all"]', timeout=10000); auto = True
    except Exception: auto = False
    check('«نادِ»: /me/athar-map?play=1 → player ready/auto (no crash)', auto)
    mp = br.new_context(viewport={'width': 390, 'height': 844}, locale='ar', is_mobile=True, storage_state=lp.context.storage_state()).new_page(); mp.goto(B + '/me/athar-map', wait_until='domcontentloaded'); mp.wait_for_selector('[data-testid="am-player"]', timeout=60000); mp.wait_for_timeout(500)
    mp.screenshot(path=f'{OUT}/03-mobile.png', full_page=True)
    check('mobile: player visible · no horizontal overflow inside map root', mp.locator('[data-testid="am-play-all"]').is_visible() and mp.evaluate('(() => { const r = document.querySelector(\'[data-testid="am-root"]\'); return r.scrollWidth <= r.clientWidth + 2; })()'))
    check('a11y: play buttons are real buttons with text · SVG role=img', mp.locator('[data-testid="am-play-all"]').evaluate('e => e.tagName') == 'BUTTON' and mp.locator('[data-testid="am-svg"] svg').get_attribute('role') == 'img')
    check('no page errors', not errs); print(errs)
    br.close()
n = sum(1 for _, c in ok if c); print(f'\n==== P60 E2E: {n} / {len(ok)} PASS'); print([k for k, c in ok if not c])
