#!/usr/bin/env python3
"""«استوديو اقرأ» — يولّد «شريط الحلقة» (ملفّ MP3 واحد + cues.json) لكلّ حلقة ونصّ مكتبة من ملفّ حزمة iqra-pack-2،
بأصوات «فرقة أَثَر» (tools/iqra/voices.json — الراوي حامد كما في مِعيار) وضبط المعجم الصغير (tools/iqra/tashkil.json).
المقاطع في الشريط: intro · سطور النصّ (كلّ سطر بصوت صاحبه) · البطاقات (الكلمة ثمّ المثال) · أمثلة القاعدة · الإملاء · «اسمع: …» في اختيار الصورة.
المشغّل في المتصفّح يطلب /iqra/audio/<code>.cues.json ويقفز إلى المقطع. بلا SQL.
الاستعمال: python3 tools/iqra-tts.py <pack.json> [<pack.json>…] [--out public/iqra/audio] [--only A1-U08-L04,…] [--force]
يتطلّب: pip install edge-tts mutagen · apt-get install -y ffmpeg (إعادة ترميز 32 ك.ب/ث + فواصل)"""
import json, sys, os, re, subprocess, tempfile, shutil, glob
try:
    from mutagen.mp3 import MP3
except ImportError:  # --plan لا يحتاجها
    MP3 = None
HERE = os.path.dirname(os.path.abspath(__file__))
V = json.load(open(os.path.join(HERE, 'iqra', 'voices.json'), encoding='utf-8'))
LEX = {k: v for k, v in json.load(open(os.path.join(HERE, 'iqra', 'tashkil.json'), encoding='utf-8')).items() if not k.startswith('_')}
AR = '\u0620-\u065F\u0660-\u06D3'  # حروف وحركات وأرقام، بلا علامات الترقيم العربية (، ؛ ؟)
PREF = '(?:و|ف|ب|ل|ك|لل|ال|وال|بال|فال|كال|ولل|وب|ول|فب)?'
LEX_RE = re.compile('(?<![' + AR + '])(' + PREF + ')(' + '|'.join(sorted(map(re.escape, LEX), key=len, reverse=True)) + ')(?![' + AR + '])')
CITY = re.compile('(\\b(?:إلى|في|من|رحلة|مطار|فندق|طائرة|قطار|أهل|سوق|جوّ|حرارة|كورنيش|شوارع|بحر|ولاية|بلدية) )جدّة')
def tashkil(t: str) -> str:
    t = re.sub(r'(?<![' + AR + '])(و|ل|ب|ك|ف|ول|وب|ال|وال)?جدّة(?![' + AR + '])', lambda m: (m.group(1) or '') + 'جَدَّة', CITY.sub(r'\1جِدَّة', t))  # الجدّة (grandmother) مقابل جِدّة (المدينة)
    t = t.replace('الجدّة', 'الجَدَّة').replace('جدّتي', 'جَدَّتي').replace('جدّته', 'جَدَّته').replace('جدّتك', 'جَدَّتك').replace('جدّتها', 'جَدَّتها')
    return LEX_RE.sub(lambda m: m.group(1) + LEX[m.group(2)], t)
# ---------- الضبط الكامل (tools/iqra/dabt/*.json): يكتبه المؤلّف لكلّ مقطع؛ الآلة لا تُشكّل ----------
DABT = {}
for _f in sorted(glob.glob(os.path.join(HERE, 'iqra', 'dabt', '*.json'))):
    DABT.update({k: v for k, v in json.load(open(_f, encoding='utf-8')).items() if not k.startswith('_')})
HARAKAT = '\u064B\u064C\u064D\u064E\u064F\u0650\u0651\u0652\u0670'
MISSING = []  # مقاطع بلا ضبط كامل (تُطبع في النهاية؛ --strict يوقف)
def strip_harakat(t: str) -> str: return re.sub('[' + HARAKAT + ']', '', t)
def dabt_lint(t: str):
    """يعيد الحروف التي بقيت بلا حركة في نصّ يُفترض أنّه مضبوط ضبطًا تامًّا (يُستثنى: ا ى آ ء، وحروف المدّ و/ي بعد ضمّة/كسرة، والهاء/التاء المربوطة في آخر الكلمة، ولام التعريف المدغمة)."""
    bad = []
    for w in re.findall('[' + AR + ']+', t):
        letters = re.findall('([^' + HARAKAT + '])([' + HARAKAT + ']*)', w)
        for i, (ch, hk) in enumerate(letters):
            if hk or ch in 'اىآءٱ' or ch in '٠١٢٣٤٥٦٧٨٩': continue
            prev_hk = letters[i - 1][1] if i else ''
            if ch == 'و' and '\u064F' in prev_hk: continue
            if ch == 'ي' and '\u0650' in prev_hk: continue
            if ch == 'ل' and i >= 1 and letters[i - 1][0] in 'اl' + 'ل' and i + 1 < len(letters) and '\u0651' in letters[i + 1][1]: continue  # اللام الشمسية (الـ / لِلـ) / اللَّه
            if i == len(letters) - 1 and ch in 'ةه': continue
            bad.append(ch)
    return bad
PAUSE_RE = re.compile('([' + AR + ']+)(?=\\s*(?:[.،؟!:؛,;?]|$))')
def waqf(word: str) -> str:
    """الوقف: تسقط الحركة الأخيرة قبل الترقيم ونهاية المقطع؛ تنوين الفتح مع الألف يبقى ألفًا."""
    if word.endswith('\u064Bا'): return word[:-2] + 'ا'
    if word.endswith('\u064Bى'): return word[:-2] + 'ى'
    w = re.sub('[\u064B\u064C\u064D\u064E\u064F\u0650]*(\u0651?)[\u064B\u064C\u064D\u064E\u064F\u0650]*$', r'\1', word)  # الشدّة تبقى أيًّا كان ترتيبها
    # الوقف على التاء المربوطة يكون بالهاء الساكنة (وَاحِدَةٌ → وَاحِدَهْ)؛ المحرّكات العصبية تُسقط فتحة ما قبل «ة» الساكنة فتُسمع «واحد» — رصدها المالك 2026-11-17
    if w.endswith('ة'): w = w[:-1] + 'هْ'
    return w
def pausal(t: str) -> str: return PAUSE_RE.sub(lambda m: waqf(m.group(1)), t)
def dabt_of(raw: str):
    """الصورة المضبوطة الكاملة إن كتبها المؤلّف، وإلّا None."""
    return DABT.get(raw) or DABT.get(strip_harakat(raw))
def speakable(t: str) -> str:
    raw = speakable_raw(t); full = dabt_of(raw)
    if full is not None:
        b = dabt_lint(full)
        if b: print(f'  ⚠ حروف بلا حركة في الضبط: {"".join(b)} ← {full[:50]}', file=sys.stderr)
        return pausal(full)
    MISSING.append(raw); return tashkil(raw)
def speakable_raw(t: str) -> str:
    t = re.sub(r'\([^)]*\)', '', t)                      # إرشادات المسرح
    t = re.sub(r'[«»"“”]', '', t).replace('…', '، ').replace(' · ', '، ').replace('·', '،').replace('—', '،').replace('×', ' في ').replace('=', ' يساوي ').replace('٪', ' في المئة').replace('%', ' في المئة').replace('___', ' فراغ ')
    t = re.sub(r'[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D]', ' ', t)  # الرموز التعبيرية لا تُقرأ
    t = re.sub(r'\s*/\s*', '، ', t)                       # يزن / تزن → وقفة
    t = re.sub(r'\s+', ' ', t).strip(' ،')
    return t
def norm_speaker(s: str) -> str: return re.sub(r'\s*\([^)]*\)?', '', s).strip()
# سطر الحوار: «اسم: نصّ» — الاسم قد يحمل ملاحظة بين قوسين فيها نقطتان «ليلى (٨:٣٠): …»
LINE_RE = re.compile(r'^([^:：(]{1,24}(?:\s*\([^)]*\))?)[:：]\s*(.+)$')
_SCENE = {}  # الشخصيّات غير المسمّاة في النصّ الحالي → ترتيب الاحتياطي (يُصفَّر مع كلّ نصّ)
_ROLE = {}  # دور عُرِّف باسم من الطاقم في هذا النصّ: «الموظّف فهد:» أو «السائق (أبو محمد):» → بقيّة سطور «الموظّف:»/«السائق:» بصوته
def scene_reset(): _SCENE.clear(); _ROLE.clear()
def _cast_in(s: str):
    for name, c in sorted(V['cast'].items(), key=lambda kv: -len(kv[0])):
        if re.search('(?<![' + AR + '])' + re.escape(name) + '(?![' + AR + '])', s): return name, c
    return None, None
def who(speaker: str):
    """→ (voice, pitch, rate_adj, g, a, canonical) لصوت المتكلّم: الاسم في السجلّ (أو كنيته: الجدّة → فاطمة)، أو دور عُرِّف باسمه في النصّ، ثمّ الجنس من العلامات، ثمّ احتياطيّ مرقّم داخل النصّ."""
    sp = norm_speaker(speaker); sp = V.get('aliases', {}).get(sp, sp); sp = _ROLE.get(sp, sp)
    name, c = _cast_in(sp); role = sp
    if not name:
        par = re.search(r'\(([^)]*)\)', speaker)
        if par: name, c = _cast_in(par.group(1))
    if name:
        role = re.sub('(?<![' + AR + '])' + re.escape(name) + '(?![' + AR + '])', '', role).strip(' ،—-')
        if role and role not in V['cast'] and re.fullmatch(r'[\u0621-\u064A\u064B-\u0652 ]{2,20}', role) and len(role.split()) <= 2: _ROLE.setdefault(role, name)
        a = V['role_avatars'].get(sp, c['a']); return c['voice'], c.get('pitch', '+0Hz'), c.get('rate'), c['g'], a, name
    g = 'f' if any(m in sp for m in V['female_markers']) or re.match(r'^(ال)?[' + AR + ']+ة$', sp.split()[0]) else 'm'
    fbs = V['fallback'][g]; fbs = fbs if isinstance(fbs, list) else [fbs]
    key = (g, re.sub(r'\s*[٠-٩0-9]+$', '', sp))  # «النداء ١» و«النداء ٢» دور واحد بصوت واحد
    if key not in _SCENE: _SCENE[key] = len([k for k in _SCENE if k[0] == g])
    fb = fbs[_SCENE[key] % len(fbs)]; a = V['role_avatars'].get(sp, fb['a'])
    return fb['voice'], '+0Hz', None, g, a, sp
def in_cast(name: str) -> bool:
    sp = norm_speaker(name); return sp in V['cast'] or sp in V.get('aliases', {})
SPLIT_RE = re.compile(r'\s[—–·]\s*([^:،.!؟—·]{2,30}?)\s?[:：]\s*')
def split_speakers(first: str, rest: str):
    """سطر يجمع متكلّمَين أو أكثر «فهد: …؟ — سامي: … — نورة: …» → [(نصّ، who), …] بصوت كلّ متكلّم؛ None إن لم يكن فيه فاصل أسماء من الطاقم."""
    bits = SPLIT_RE.split(rest)
    if len(bits) < 3 or not all(in_cast(n) for n in bits[1::2]): return None
    parts = [(bits[0], who(first))] + [(bits[j + 1], who(bits[j])) for j in range(1, len(bits), 2)]
    return [(t.strip(), w) for t, w in parts if t.strip()]
def narr(): n = V['narrator']; return n['voice'], n.get('pitch', '+0Hz'), None, n['g'], n['a'], ''
HEADER_RE = re.compile(r'^[\(\[]?[٠-٩0-9]+[\)\]\-—.:]')
CUR_AUTHOR = {}
def author_of(code: str, idx: int, line: str):
    """صوت كاتب النصّ (رسالة/دفتر/بطاقة بضمير المتكلّم) من voices.json → authors؛ العناوين والسطر الأوّل الذي يسمّي الكاتب تبقى للراوي.
    القيمة إمّا اسم، وإمّا {"start": اسم, "at": {"بداية سطر العنوان": اسم}} لنصّ فيه أكثر من كاتب (رسالة وردّها)."""
    spec = (V.get('authors') or {}).get(code)
    if isinstance(spec, dict):
        if idx == 0 or code not in CUR_AUTHOR: CUR_AUTHOR[code] = spec.get('start')
        for pref, nm in (spec.get('at') or {}).items():
            if line.startswith(pref): CUR_AUTHOR[code] = nm; return narr()
        name = CUR_AUTHOR[code]
    else: name = spec
    if not name or (HEADER_RE.match(line) and (len([x for x in line.split() if re.search('[\u0621-\u064A]', x)]) <= 5 or line.rstrip().endswith(':'))) or (idx == 0 and name in line and len(line.split()) <= 8 and re.search(r'كتب|رسالة|دفتر|دليل|بطاقة', line)) or re.match(r'^(رسالة|بطاقة|دفتر|ملاحظة)\b.*:$', line): return narr()
    return who(name)
def mark(key: dict, w):
    if w[5]: key.update({'r': w[5], 'g': w[3], 'a': w[4]})
    return key
def rate_of(level: str, adj):
    base = int(V['rate'].get(level, '+0%').rstrip('%')); r = base + (int(adj.rstrip('%')) if adj else 0); return f'{r:+d}%'
FFMPEG = shutil.which('ffmpeg')
def tts(text, voice, rate, pitch, out):
    """edge-tts → ثمّ ffmpeg: أحاديّ 24 كيلوهرتز 32 ك.ب/ث + صمت 0.35 ث في نهاية المقطع (فاصل طبيعي بين السطور)."""
    raw = out + '.raw.mp3'
    for attempt in range(3):
        r = subprocess.run([sys.executable, '-m', 'edge_tts', '--voice', voice, f'--rate={rate}', f'--pitch={pitch}', '--text', text, '--write-media', raw], capture_output=True, text=True)
        if r.returncode == 0 and os.path.exists(raw) and os.path.getsize(raw) > 800: break
    else: raise SystemExit(f'tts failed [{voice}] {text[:40]}: {r.stderr[-300:]}')
    if not FFMPEG: raise SystemExit('ffmpeg مطلوب (apt-get install -y ffmpeg)')
    r = subprocess.run([FFMPEG, '-loglevel', 'error', '-y', '-i', raw, '-af', 'apad=pad_dur=0.35', '-ac', '1', '-ar', '24000', '-b:a', '32k', '-codec:a', 'libmp3lame', '-write_xing', '0', '-map_metadata', '-1', '-id3v2_version', '0', out], capture_output=True, text=True)
    if r.returncode != 0: raise SystemExit('ffmpeg failed: ' + r.stderr[-300:])
    os.remove(raw)
def segments_lesson(l):
    """قائمة المقاطع: (key dict, speakable text, who-tuple)."""
    c = l['content']; S = []; scene_reset()
    if c.get('intro_ar'): S.append(({'k': 'intro'}, c['intro_ar'], narr()))
    if c.get('text') and c['text'].get('body'):
        for i, ln in enumerate(c['text']['body'].split('\n')):
            ln = ln.strip()
            if not ln: continue
            m = re.match(r'^\((.+)\)$', ln)
            if m: S.append(({'k': 'line', 'i': i, 'r': '', 'g': 'n', 'a': ''}, m.group(1), narr())); continue
            m = LINE_RE.match(ln); parts = m and split_speakers(m.group(1), m.group(2))
            if m and (c['text'].get('kind') == 'dialogue' or (in_cast(m.group(1)) and (parts or not re.search(r'[،.!؟]\s*[^:،.!؟]{2,14}\s?:', m.group(2))))):  # سطر «هند: …» داخل نصّ سرديّ يُقرأ بصوت هند (وإن جمع السطر عدّة متكلّمين من الطاقم قُسِّم بينهم، وإلّا فالراوي)
                w = who(m.group(1)); S.append(({'k': 'line', 'i': i, 'r': w[5], 'g': w[3], 'a': w[4]}, parts or m.group(2), w))
            else: w = author_of(l['code'], i, ln); S.append((mark({'k': 'line', 'i': i, 'r': '', 'g': 'n', 'a': ''}, w), ln, w))
    for cd in l.get('cards', []):
        S.append(({'k': 'card', 't': cd['word_ar']}, cd['word_ar'], narr()))
        if cd.get('example_ar'):
            m = LINE_RE.match(cd['example_ar']); w = who(m.group(1)) if m and (norm_speaker(m.group(1)) in V['cast'] or any(x in m.group(1) for x in V['cast'])) else narr()
            S.append(({'k': 'ex', 't': cd['example_ar']}, m.group(2) if m and w[5] else cd['example_ar'], w))
    for e in (c.get('grammar') or {}).get('examples', []): S.append(({'k': 'gex', 't': e}, e, narr()))
    said = {}
    if c.get('text') and c['text'].get('body'):
        for i, ln in enumerate(c['text']['body'].split('\n')):
            m = LINE_RE.match(ln.strip())
            if m: said[re.sub(r'[^' + AR + ']', '', m.group(2))] = who(m.group(1))
            elif ln.strip() and (V.get('authors') or {}).get(l['code']): said[re.sub(r'[^' + AR + ']', '', ln)] = author_of(l['code'], i, ln.strip())
    for ex in l.get('exercises', []):
        if ex['kind'] == 'short_dictation':
            t = ex['text_ar']; w = said.get(re.sub(r'[^' + AR + ']', '', t)) or next((v for k, v in said.items() if re.sub(r'[^' + AR + ']', '', t) and re.sub(r'[^' + AR + ']', '', t) in k), None) or narr()
            S.append(({'k': 'dict', 't': t}, t, w))
        elif ex['kind'] == 'picture_choice' and ex['prompt_ar'].startswith('اسمع'):
            m = re.search(r'«([^»]+)»', ex['prompt_ar']); S.append(({'k': 'pic', 't': ex['prompt_ar']}, m.group(1) if m else ex['prompt_ar'], narr()))
    return S
def segments_library(t):
    """نصّ المكتبة: الاستماع (listen) حوار بأصوات؛ القراءة (read) يقرؤها الراوي كاملة إلا سطور شخصيّات الطاقم المسمّاة (جداول «القطار ٤: …» ليست حوارًا)."""
    S = []; scene_reset(); listen = t.get('kind') == 'listen'
    for i, ln in enumerate(t['body_ar'].split('\n')):
        ln = ln.strip()
        if not ln: continue
        m = LINE_RE.match(ln); sc = re.match(r'^\((.+)\)$', ln)
        if sc: S.append(({'k': 'line', 'i': i, 'r': '', 'g': 'n', 'a': ''}, sc.group(1), narr())); continue
        vm = listen and re.match(r'^(الرسالة\s+\S+،[^:]*):\s*(.+)$', ln)  # بريد صوتيّ: «الرسالة الأولى، اليوم في…: صباح الخير، أنا نورة…» → العنوان بصوت الهاتف والرسالة بصوت صاحبها
        if vm:
            spk = next((n for n in sorted(V['cast'], key=len, reverse=True) if re.search(r'(?:أنا|هذه|هذا|معك|معكِ)\s+(?:ال(?:دكتور|أستاذ|معلّم|ممرّض)(?:ة)?\s+)?' + re.escape(n) + '(?![' + AR + '])', vm.group(2))), None)
            w = who(spk) if spk else narr(); ph = who('الهاتف')
            S.append(({'k': 'line', 'i': i, 'r': w[5], 'g': w[3], 'a': w[4]}, [(vm.group(1) + ':', ph), (vm.group(2), w)], w)); continue
        named = m and (norm_speaker(m.group(1)) in V['cast'] or norm_speaker(m.group(1)) in V.get('aliases', {}) or any(re.search('(?<![' + AR + '])' + re.escape(n) + '(?![' + AR + '])', m.group(1)) for n in V['cast']))
        multi = m and not listen and re.search(r'[،.!؟]\s*[^:،.!؟]{2,14}\s?:', m.group(2))  # سطر قراءة يجمع متكلّمَين «كين: … — يوسف: …» → الراوي
        if m and not multi and len(norm_speaker(m.group(1)).split()) <= 3 and (named or (listen and (any(x in m.group(1) for x in V['female_markers']) or norm_speaker(m.group(1)) in V['role_avatars'] or m.group(1).startswith('ال') or not re.search(r'[٠-٩0-9]', m.group(1))))):
            w = who(m.group(1)); S.append(({'k': 'line', 'i': i, 'r': w[5], 'g': w[3], 'a': w[4]}, split_speakers(m.group(1), m.group(2)) or m.group(2), w))
        else: w = author_of(t['code'], i, ln); S.append((mark({'k': 'line', 'i': i, 'r': '', 'g': 'n', 'a': ''}, w), ln, w))
    return S
def build(code, level, S, out_dir):
    tmp = tempfile.mkdtemp(); cues = []; pos = 0.0; parts_files = []
    for n, (key, text, w) in enumerate(S):
        parts = text if isinstance(text, list) else [(text, w)]
        if not any(speakable(t) for t, _ in parts): continue
        d = 0.0; full = ' '.join(x for x in (dabt_of(speakable_raw(t)) or '' for t, _ in parts) if x) or None
        for j, (t, pw) in enumerate(parts):
            sp = speakable(t)
            if not sp: continue
            voice, pitch, adj, g, a, name = pw
            f = os.path.join(tmp, f'{n:03d}-{j}.mp3'); tts(sp, voice, rate_of(level, adj), pitch, f); d += MP3(f).info.length; parts_files.append(f)
        cue = {**key, 's': round(pos, 2), 'e': round(pos + d, 2)}
        if full: cue['d'] = full  # الصورة المضبوطة الكاملة لعرضها عند «أظهر التشكيل»
        cues.append(cue); pos += d
    mp3 = os.path.join(out_dir, code + '.mp3')
    with open(mp3, 'wb') as wfh:
        for f in parts_files: wfh.write(open(f, 'rb').read())
    shutil.rmtree(tmp)
    json.dump({'v': 1, 'code': code, 'src': f'/iqra/audio/{code}.mp3', 'level': level, 'rate': V['rate'].get(level, '+0%'), 'dur': round(pos, 2), 'cast': 'athar-voices-1', 'cues': cues}, open(os.path.join(out_dir, code + '.cues.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return len(cues), round(pos, 1), os.path.getsize(mp3)
if __name__ == '__main__':
    args = sys.argv[1:]; out_dir = 'public/iqra/audio'; only = set(); force = False
    if '--out' in args: i = args.index('--out'); out_dir = args[i + 1]; del args[i:i + 2]
    if '--only' in args: i = args.index('--only'); only = set(args[i + 1].split(',')); del args[i:i + 2]
    if '--force' in args: force = True; args.remove('--force')
    strict = '--strict' in args
    if strict: args.remove('--strict')
    if '--check' in args:  # فحص مسبق: كلّ أصوات الطاقم والاحتياطيّ والراوي تستجيب الآن (الخدمة تُسقط صوتًا أحيانًا)
        args.remove('--check'); tmp = tempfile.mkdtemp(); bad = []
        voices = sorted({V['narrator']['voice']} | {c['voice'] for c in V['cast'].values()} | {f['voice'] for g in V['fallback'].values() for f in (g if isinstance(g, list) else [g])})
        for v in voices:
            r = subprocess.run([sys.executable, '-m', 'edge_tts', '--voice', v, '--text', 'السَّلَامُ عَلَيْكُمْ', '--write-media', os.path.join(tmp, 'c.mp3')], capture_output=True, text=True)
            ok = r.returncode == 0 and os.path.exists(os.path.join(tmp, 'c.mp3')) and os.path.getsize(os.path.join(tmp, 'c.mp3')) > 800
            print(('✓ ' if ok else '✗ ') + v, flush=True)
            if not ok: bad.append(v)
            try: os.remove(os.path.join(tmp, 'c.mp3'))
            except OSError: pass
        shutil.rmtree(tmp); print('voices', len(voices), 'down', bad); sys.exit(1 if bad else 0)
    if '--plan' in args:  # يطبع المقاطع الخام التي تحتاج ضبطًا (لكتابة tools/iqra/dabt/<code>.json) بلا توليد
        args.remove('--plan')
        for pf in args:
            d = json.load(open(pf, encoding='utf-8'))
            for code, S in [(l['code'], segments_lesson(l)) for l in d.get('lessons', [])] + [(t['code'], segments_library(t)) for t in d.get('library', [])]:
                if only and code not in only: continue
                raws = []
                for key, text, w in S:
                    for t in ([x for x, _ in text] if isinstance(text, list) else [text]):
                        r = speakable_raw(t)
                        if r and r not in raws: raws.append(r)
                miss = [r for r in raws if dabt_of(r) is None]
                print(f'{code}: {len(raws)} مقطعًا فريدًا · بلا ضبط {len(miss)}')
                for r in miss: print('  ' + r)
        sys.exit(0)
    os.makedirs(out_dir, exist_ok=True); total = 0
    for pf in args:
        d = json.load(open(pf, encoding='utf-8')); level = (d.get('units') or [{}])[0].get('level', 'A1')
        jobs = [(l['code'], segments_lesson(l)) for l in d.get('lessons', [])] + [(t['code'], segments_library(t)) for t in d.get('library', [])]
        for code, S in jobs:
            if only and code not in only: continue
            if not force and os.path.exists(os.path.join(out_dir, code + '.cues.json')): print('skip', code); continue
            n, dur, size = build(code, level, S, out_dir); total += 1; print(f'{code}: {n} cues · {dur}s · {size // 1024} KB', flush=True)
    print('built', total)
    if MISSING:
        u = sorted(set(MISSING)); print(f'⚠ {len(u)} مقطعًا بلا ضبط كامل (نُطق بالمعجم الصغير فقط):', file=sys.stderr)
        for r in u[:40]: print('  ' + r, file=sys.stderr)
        if strict: sys.exit(2)
