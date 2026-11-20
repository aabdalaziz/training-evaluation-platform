# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# مولّد تمارين Pre-A1: 30 تمرينًا × 9 أنواع لكلّ حلقة من بيانات الحروف والكلمات (حتميّ: بذرة = رمز الحلقة)
import random, re, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import LETTERS, NAME, LIMG, W, NEW, known, glyphs, skel, HK, HARAKA_NAME, NO_JOIN
IMG = lambda n: f'/iqra/img/{n}.svg'
def mcq(q, opts, c, ex=''): return {'kind': 'mcq', 'prompt_ar': q, 'options': opts, 'correct': c, 'explanation_ar': ex}
def match(q, pairs, ex=''): return {'kind': 'matching', 'prompt_ar': q, 'pairs': [{'l': l, 'r': r} for l, r in pairs], 'explanation_ar': ex}
def order(q, words, ex=''): return {'kind': 'ordering', 'prompt_ar': q, 'words': list(words), 'order': list(words), 'explanation_ar': ex}
def pic(q, imgs, c, ex=''): return {'kind': 'picture_choice', 'prompt_ar': q, 'options': [{'text': '', 'image': IMG(i)} for i in imgs], 'correct': c, 'explanation_ar': ex}
def cloze(q, text, gaps, extra, ex=''): return {'kind': 'cloze_bank', 'prompt_ar': q, 'text': text, 'gaps': gaps, 'bank': gaps + extra, 'explanation_ar': ex}
def tf(q, passage, c, ex=''): return {'kind': 'true_false_notgiven', 'prompt_ar': q, 'passage_ar': passage, 'correct': c, 'explanation_ar': ex}
def tap(q, words, c, ex=''): return {'kind': 'word_tap', 'prompt_ar': q, 'words': words, 'correct': c, 'explanation_ar': ex}
def dic(text, alt=None, ex=''): return {'kind': 'short_dictation', 'prompt_ar': 'اسمع واكتب', 'text_ar': text, 'alt': alt or [], 'explanation_ar': ex}
def seq(q, frames, ex=''): return {'kind': 'picture_sequence', 'prompt_ar': q, 'frames': [{'image': IMG(i), 'text': t} for i, t in frames], 'order': [t for _, t in frames], 'explanation_ar': ex}
def card(w, g, e): return {'word_ar': w, 'gloss_ar': g, 'example_ar': e}

SUN = set('تثدذرزسشصضطظلن')
def al(g):
    """اسم الحرف معرَّفًا: الْبَاء · التَّاء · الْأَلِف"""
    n = NAME[g]
    return ('ال' + n[0] + '\u0651' + n[1:]) if n[0] in SUN else ('الْ' + n)
def units(w):
    """وحدات الكلمة: حرف + حركاته (للترتيب والفراغ)."""
    return re.findall('([^' + HK + '])([' + HK + ']*)', w)
def has_al(w): return skel(w).startswith('ال') and len(skel(w)) > 3
def first_glyph(w):
    g = glyphs(w); return g[2] if has_al(w) else g[0]
def FIRST(w): return 'الحرف الأوّل بعد «ال»' if has_al(w) else 'الحرف الأوّل'
def tokens(w):
    """قطع فريدة للترتيب: حرف+حركة؛ إن تكرّرت قطعة دُمجت مع ما قبلها."""
    u = [a + b for a, b in units(w)]
    toks = []
    for t in u:
        if t in toks: toks[-1] += t
        else: toks.append(t)
    while len(toks) > 1 and len(set(toks)) != len(toks):
        toks = [toks[0] + toks[1]] + toks[2:]
    return toks
def haraka_of(w, idx):
    """حركة الحرف رقم idx في الكلمة (أو None)."""
    u = units(w)
    if idx >= len(u): return None
    hk = u[idx][1]
    for h in ('\u0651', '\u064E', '\u064F', '\u0650', '\u0652', '\u064B', '\u064C', '\u064D'):
        if h in hk and h != '\u0651': return h
    return None

N_EX = 40   # ت٣ (2026-11-20): سقف التمهيديّ 40 (IQRA_LIMITS.items_per_lesson_max_pre_a1) — كان 30
def build(key, code, letters_pool=None):
    """40 تمرينًا للحلقة key (مثل U01L03) — 12 اختيار بالصورة (6 حروف + 6 كلمات) · 3 مطابقة · 5 ترتيب · 4 المس · 4 فراغ · 5 إملاء · 3 اختيار · 3 صواب/خطأ · 1 ترتيب صور."""
    rnd = random.Random(code)
    new = NEW[key]; kn = known(key); words = W[key]
    pool = letters_pool or (new if len(new) >= 4 else kn)       # حروف التمارين: الجديدة، أو كلّ المعروف في حلقات المراجعة
    pool = [g for g in pool if g != 'ة' or 'ة' in new or key.endswith(('L05', 'L06', 'L07'))]
    focus = new if new else [first_glyph(w) for w, _ in words][:8]
    ex = []
    def distinct_imgs(correct_img, n):
        others = [img for _, img in words if img != correct_img]
        others = list(dict.fromkeys(others)); rnd.shuffle(others)
        return others[:n]
    # 1) اسمع والمس الحرف ×6
    for g in (rnd.sample(focus, 6) if len(focus) >= 6 else [focus[i % len(focus)] for i in range(6)]):
        others = [x for x in pool if x != g]; rnd.shuffle(others); opts = [g] + others[:3]; rnd.shuffle(opts)
        ex.append(pic(f'اسمع والمس الحرف: «{NAME[g]}»', [LIMG[x] for x in opts], opts.index(g), f'هَذَا حَرْفُ {NAME[g]}: {g}'))
    # 2) اسمع واختر الصورة ×6
    for w, img in rnd.sample(words, min(6, len(words))):
        opts = [img] + distinct_imgs(img, 3); rnd.shuffle(opts)
        ex.append(pic(f'اسمع واختر الصورة: «{w}»', opts, opts.index(img), f'{w}'))
    # 3) مطابقة ×3
    L4 = rnd.sample(pool, min(4, len(pool)))
    ex.append(match('طابق الحرف باسمه', [(g, NAME[g]) for g in L4], 'اِقْرَأِ الْحَرْفَ ثُمَّ اسْمَهُ'))
    ws = []; seen = set()
    for w, _ in rnd.sample(words, len(words)):
        g = first_glyph(w)
        if g not in seen and g in kn: seen.add(g); ws.append((w, g))
        if len(ws) == 4: break
    ex.append(match('طابق الكلمة بحرفها الأوّل' + (' بعد «ال»' if has_al(words[0][0]) else ''), [(w, g) for w, g in ws], 'الْحَرْفُ الْأَوَّلُ مِنَ الْكَلِمَةِ'))
    ws2 = []; seen = set()
    for w, _ in rnd.sample(words, len(words)):
        g = glyphs(w)[-1]
        if g not in seen: seen.add(g); ws2.append((w, g))
        if len(ws2) == 4: break
    ex.append(match('طابق الكلمة بحرفها الأخير', [(w, g) for w, g in ws2], 'الْحَرْفُ الْأَخِيرُ مِنَ الْكَلِمَةِ'))
    # 4) ترتيب الحروف ×5
    _ord = [x for x in words if len(tokens(x[0])) >= 2]
    for w, _ in rnd.sample(_ord, min(5, len(_ord))):
        t = tokens(w); ex.append(order(f'رتّب الحروف لتكتب: {w}', t, f'{" ، ".join(t)} = {w}'))
    # 5) المس ×3
    row = list(dict.fromkeys(pool + rnd.sample(kn, min(len(kn), 3))))[:8]
    if len(row) < 3: row = (row + kn)[:4]
    for g in (rnd.sample(focus, 3) if len(focus) >= 3 else (focus + [x for x in rnd.sample(kn, len(kn)) if x not in focus])[:3]):
        r = row if g in row else [g] + row[:7]; r = list(dict.fromkeys(r)); rnd.shuffle(r)
        ex.append(tap(f'المس حرف {al(g)}', r, g, f'{NAME[g]} = {g}'))
    w, _ = rnd.choice(words); g = first_glyph(w)
    cand = [x for x, _ in words if first_glyph(x) != g]; rnd.shuffle(cand); r = [w] + cand[:3]; rnd.shuffle(r)
    ex.append(tap(f'المس الكلمة التي تبدأ' + (' بعد «ال»' if has_al(w) else '') + f' بحرف {al(g)}', r, w, f'{w} تَبْدَأُ بِـ{al(g)}'))
    # 6) الحرف الناقص ×4
    for w, _ in rnd.sample(words, min(4, len(words))):
        u = units(w); i = rnd.randrange(len(u)); missing = u[i][0] + u[i][1]
        text = ''.join(a + b for a, b in u[:i]) + '___' + ''.join(a + b for a, b in u[i + 1:])
        g = glyphs(w)[i] if i < len(glyphs(w)) else None
        dis = [x + u[i][1] for x in rnd.sample([x for x in pool if x != g and x not in 'ءة'], 2)] if g else []
        dis = [d for d in dis if d != missing][:2] or [x + u[i][1] for x in rnd.sample([x for x in kn if x != g and x not in 'ءة'], 2)]
        ex.append(cloze('أكمل الحرف الناقص', text, [missing], dis, f'{w}'))
    # 7) إملاء ×5
    for w, _ in rnd.sample(words, min(5, len(words))): ex.append(dic(w, [], f'{w}'))
    # 8) اختيار ×3
    g = rnd.choice(focus); others = [NAME[x] for x in rnd.sample([x for x in kn if x != g], 3)]; opts = [NAME[g]] + others; rnd.shuffle(opts)
    ex.append(mcq(f'ما اسم هذا الحرف: {g} ؟', opts, opts.index(NAME[g]), f'{g} = {NAME[g]}'))
    def first_hk(w):
        for i in range(len(units(w))):
            h = haraka_of(w, i)
            if h in ('\u064E', '\u064F', '\u0650'): return i, h
        return None
    w, _ = rnd.choice([x for x in words if first_hk(x[0])]); i, h = first_hk(w); hn = HARAKA_NAME[h]; g = units(w)[i][0]
    opts = ['فَتْحَة', 'ضَمَّة', 'كَسْرَة']
    ex.append(mcq(f'ما الحركة على حرف {al(g) if g in NAME else g} في «{w}»؟', opts, opts.index(hn), f'{w}: {g}{h} {hn}'))
    w, _ = rnd.choice(words); n = len(glyphs(w)); NUM = {2: 'حَرْفَان', 3: 'ثَلَاثَة', 4: 'أَرْبَعَة', 5: 'خَمْسَة', 6: 'سِتَّة', 7: 'سَبْعَة', 8: 'ثَمَانِيَة'}
    opts = [NUM[n]] + [NUM[k] for k in (n - 1, n + 1, n + 2) if k in NUM and k != n][:2]; rnd.shuffle(opts)
    ex.append(mcq(f'كم حرفًا في كلمة «{w}»؟', opts, opts.index(NUM[n]), f'{" ، ".join(glyphs(w))}'))
    # 9) صواب/خطأ ×3
    w, _ = rnd.choice(words); g = first_glyph(w)
    ex.append(tf(f'تبدأ الكلمة' + (' بعد «ال»' if has_al(w) else '') + f' بحرف {al(g)}', w, 'true', f'{w} تَبْدَأُ بِـ{al(g)}'))
    w, _ = rnd.choice(words); g = rnd.choice([x for x in pool if x not in glyphs(w)] or [x for x in kn if x not in glyphs(w)])
    ex.append(tf(f'في الكلمة حرف {al(g)}', w, 'false', f'لَيْسَ فِي «{w}» حَرْفُ {al(g)}'))
    w, _ = rnd.choice(words); g = glyphs(w)[-1]
    ex.append(tf(f'آخر حرف في الكلمة هو {al(g)}', w, 'true', f'{w} تَنْتَهِي بِـ{al(g)}'))
    # 10) ترتيب الصور ×1 — بترتيب الحروف الأولى كما في الهجاء
    AB = list(LETTERS.keys())
    cand = []; seen = set()
    for w, img in sorted(words, key=lambda x: AB.index(first_glyph(x[0]))):
        g = first_glyph(w)
        if g not in seen and img not in [c[1] for c in cand]: seen.add(g); cand.append((w, img))
    cand = cand[:4] if len(cand) >= 3 else cand
    ex.append(seq('رتّب الصور بترتيب حروفها الأولى' + (' بعد «ال»' if has_al(cand[0][0]) else '') + ' في الهجاء: ' + ' ثمّ '.join(al(first_glyph(w)) for w, _ in cand), [(img, w) for w, img in cand], ' ← '.join(w for w, _ in cand)))
    assert len(ex) == N_EX, (key, len(ex))
    kinds = {e['kind'] for e in ex}; assert len(kinds) == 9, kinds
    return ex

def letter_cards(gs):
    out = []
    for g in gs:
        n, img, i, m, f = LETTERS[g]
        forms = f'{i} {m} {f}' if g not in 'ءة' else ('أ ؤ ئ ء' if g == 'ء' else 'ة ـة')
        base = g if g not in 'ءة' else ('أ' if g == 'ء' else 'ة')
        hk = f'{base}\u064E {base}\u064F {base}\u0650' if g not in 'اءة' else ''
        out.append(card(g, f'{n} · {forms}' + (f' · {hk}' if hk else ''), ''))
    return out
def word_cards(ws, n):
    out = []
    for w, img in ws[:n]:
        gl = glyphs(w); out.append(card(w, ' ، '.join(NAME[g] for g in gl), ''))
    return out
def cards_for(key, letters=None, extra=None):
    lc = letter_cards(NEW[key] if letters is None else letters); need = 16 - len(lc)
    wc = word_cards([x for x in W[key] if x[0] not in {c['word_ar'] for c in (extra or [])}], need - len(extra or []))
    out = lc + wc + (extra or [])
    assert 12 <= len(out) <= 16, (key, len(out))
    return out

LEVEL = 'PRE_A1'
def lesson(unit, idx, title, skill, domain, goal, can_ar, can_en, codes, intro, text, grammar, produce, closing, cards, exercises):
    assert 8 <= len(cards) <= 16
    return {'code': f'{unit}-L{idx:02d}', 'unit_code': unit, 'idx': idx, 'title_ar': title, 'skill': skill, 'minutes': 15, 'minutes_total': 90, 'domain': domain,
            'goal_ar': goal, 'can_do_ar': can_ar, 'can_do_en': can_en, 'descriptor_codes': codes,
            'content': {'intro_ar': intro, 'text': text, 'grammar': grammar, 'produce': produce, 'closing_ar': closing}, 'cards': cards, 'exercises': exercises}
def write_pack(unit, lessons, library, out, source):
    pack = {'version': 'iqra-pack-2', 'source': source, 'units': [unit], 'lessons': lessons, 'library': library}
    json.dump(pack, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', out, 'lessons', len(lessons), 'exercises', sum(len(l['exercises']) for l in lessons), 'cards', sum(len(l['cards']) for l in lessons))

# ───── ميثاق الإنصاف (نسخة بايثون من lib/iqra/content.ts) + بحث عن بذرة متوازنة ─────
_SRC = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'lib', 'iqra', 'content.ts'), encoding='utf-8').read()
def _norm(t):
    t = re.sub('[' + HK + '\u0640]', '', t); t = re.sub('[أإآ]', 'ا', t); t = t.replace('ة', 'ه').replace('ى', 'ي')
    return re.sub(r'[^\w\s]', ' ', t)
_F = {_norm(x) for x in re.findall(r"'([^']+)'", re.search(r"const F_WORDS = \[(.*?)\];", _SRC).group(1))}
_M = {_norm(x) for x in re.findall(r"'([^']+)'", re.search(r"const M_WORDS = \[(.*?)\];", _SRC).group(1))}
def lesson_texts(l):
    c = l['content']; out = [c.get('intro_ar', ''), (c.get('text') or {}).get('body', ''), (c.get('grammar') or {}).get('explanation_ar', ''), *(c.get('grammar') or {}).get('examples', []), (c.get('produce') or {}).get('prompt_ar', ''), (c.get('produce') or {}).get('model_ar', ''), c.get('closing_ar', '')]
    for k in l['cards']: out += [k['gloss_ar'], k.get('example_ar', '')]
    for e in l['exercises']:
        out += [e['prompt_ar'], e.get('explanation_ar', '')]; k = e['kind']
        if k == 'mcq': out += e['options']
        if k == 'matching': out += [x for p in e['pairs'] for x in (p['l'], p['r'])]
        if k == 'ordering': out.append(' '.join(e['order']))
        if k == 'cloze_bank': out += [e['text'], *e['bank']]
        if k == 'true_false_notgiven': out.append(e['passage_ar'])
        if k == 'word_tap': out.append(' '.join(e['words']))
        if k == 'short_dictation': out.append(e['text_ar'])
        if k == 'picture_sequence': out += [f['text'] for f in e['frames']]
        if k == 'picture_choice': out += [o['text'] for o in e['options']]
    return out
def fairness(l):
    f = m = 0
    for t in lesson_texts(l):
        for w0 in _norm(re.sub(r'(?<!\w)(?:و|ف)?على(?!\w)', ' ', t)).split():
            w = re.sub(r'^(و|ف|ب|ل|ك|ال|وال|بال|لل)', '', w0)
            if w0 in _F or w in _F: f += 1
            elif w0 in _M or w in _M: m += 1
    tot = f + m; pct = round(f / tot * 100) if tot else 50
    return f, m, pct, (tot < 6 or 40 <= pct <= 60)
def fair_lesson(key, *args, tries=60, builder=None):
    """يبني الحلقة ثمّ يعيد توليد التمارين ببذور متتالية حتى يتوازن حضور الجنسين (40–60٪). builder: build (حروف) أو gen2.build2 (جمل)."""
    l = lesson(*args)
    code = l['code']; builder = builder or build
    for i in range(tries):
        l['exercises'] = builder(key, code if i == 0 else f'{code}#{i}')
        f, m, pct, ok = fairness(l)
        if ok: return l
    raise SystemExit(f'{code}: لم يتوازن الإنصاف بعد {tries} محاولة — آخر نسبة {pct}% ({f}/{m})')
