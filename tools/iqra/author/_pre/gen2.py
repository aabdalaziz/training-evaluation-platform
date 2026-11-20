# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# مولّد تمارين Pre-A1 ت٢ (جمل وعبارات لا حروفًا): 30 تمرينًا × 9 أنواع لكلّ حلقة من بيانات data2.PH (حتميّ: بذرة = رمز الحلقة)
#  ت٣: 40 تمرينًا = 14 اختيار بالصورة (7 اسمع كلمة + 7 اقرأ جملة) · 3 مطابقة · 5 ترتيب كلمات الجملة · 3 المس · 3 فراغ · 5 إملاء · 3 اختيار · 3 صواب/خطأ · 1 ترتيب صور
import random, re, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gen import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, N_EX
from data import NAME, glyphs, skel
from data2 import PH

def _strip_al(b): return b[2:] if b.startswith('ال') and len(b) > 3 else b
def _core(tok): return re.sub(r'[^\u0621-\u064A\u064B-\u0652]', '', tok)

def build2(key, code):
    d = PH[key]; rnd = random.Random(code)
    items, sent = d['items'], d['sent']
    item_words = [w for w, _ in items]
    ex = []
    def distinct(correct_img, pool, n):
        others = list(dict.fromkeys(img for _, img in pool if img != correct_img)); rnd.shuffle(others); return others[:n]
    # 1) اسمع واختر الصورة ×7 (كلمات/عبارات)
    for w, img in rnd.sample(items, 7):
        opts = [img] + distinct(img, items + sent, 3); rnd.shuffle(opts)
        ex.append(pic(f'اسمع واختر الصورة: «{w}»', opts, opts.index(img), w))
    # 2) اقرأ واختر الصورة ×7 (جمل)
    for s, img in rnd.sample(sent, 7):
        opts = [img] + distinct(img, sent + items, 3); rnd.shuffle(opts)
        ex.append(pic(f'اقرأ واختر الصورة: «{s}»', opts, opts.index(img), s))
    # 3) مطابقة ×3
    PR = ['طابق', 'صِل كلّ عبارة بما يناسبها', 'طابق العمودين']
    for i, g in enumerate(d['pairs']):
        g = list(g); rnd.shuffle(g); ex.append(match(PR[i], g, ' · '.join(f'{l} ← {r}' for l, r in g)))
    # 4) رتّب كلمات الجملة ×5 (جمل من كلمتين فأكثر بكلمات مختلفة)
    cand = [s for s, _ in sent if len(s.split()) >= 2 and len(set(s.split())) == len(s.split())]
    for s in rnd.sample(cand, 5):
        ex.append(order(f'رتّب الكلمات لتكوّن الجملة', s.split(), s))
    # 5) المس ×3
    for q, words, c in d['tap']:
        words = list(words); rnd.shuffle(words); ex.append(tap(q, words, c, c))
    # 6) الفراغ ×3: جمل مكتوبة يدويًّا (الفجوة كلمة بصورتها في الجملة + مشتّتان)
    for text, gap, dis in rnd.sample(d['cloze'], 3):
        ex.append(cloze('أكمل الجملة بالكلمة الصحيحة', text, [gap], list(dis), text.replace('___', gap)))
    # 7) إملاء ×5 (كلمات مفردة من الحلقة — لا أرقام)
    for w, _ in rnd.sample([x for x in items if re.search(r'[\u0621-\u064A]', x[0])], 5): ex.append(dic(w, [], w))
    # 8) اختيار ×3
    for q, opts, c, e in d['mcq']:
        o = list(opts); ci = o[c]; rnd.shuffle(o); ex.append(mcq(q, o, o.index(ci), e))
    # 9) صواب/خطأ ×3
    for q, passage, c, e in d['tf']: ex.append(tf(q, passage, c, e))
    # 10) ترتيب الصور ×1
    q, frames = d['seq']; ex.append(seq(q, frames, ' ← '.join(t for _, t in frames)))
    assert len(ex) == N_EX, (key, len(ex))
    kinds = {e['kind'] for e in ex}; assert len(kinds) == 9, kinds
    return ex

def cards2(key, extra=None):
    """بطاقات الحلقة: كلمات الحلقة (الشرح من gloss أو أسماء الحروف) + بطاقات إضافيّة (عبارات)."""
    d = PH[key]; out = []
    for w, _ in d['items']:
        g = d['gloss'].get(w) or ' ، '.join(NAME[x] for x in glyphs(w))
        out.append(card(w, g, ''))
    out += (extra or [])
    out = out[:16]; assert 12 <= len(out) <= 16, (key, len(out))
    return out
