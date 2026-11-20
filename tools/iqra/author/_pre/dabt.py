# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# ضبط Pre-A1: النصوص مكتوبة مضبوطة أصلًا، فالملفّ يُولَّد آليًّا من مقاطع --plan:
#  · الحرف المفرد «ب» → اسمه «بَاءْ» (المحرّك ينطق الاسم بثبات) · أسطر الحروف «ا ب ت» → أسماؤها
#  · الحرف الأخير بلا حركة → سكون (وقف) · «ـ» تطويل يُحذف · الأرقام الهنديّة في عناوين المشاهد → كلمات
#  الاستعمال: python3 _pre/dabt.py <pack.json>  → tools/iqra/dabt/<CODE>.json لكلّ حلقة/نصّ
import os, sys, re, json, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from data import NAME, HK, skel
HERE = os.path.dirname(os.path.abspath(__file__)); TEP = os.path.abspath(os.path.join(HERE, '..', '..', '..', '..'))
sys.path.insert(0, os.path.join(TEP, 'tools'))
import importlib.util
spec = importlib.util.spec_from_file_location('iqra_tts', os.path.join(TEP, 'tools', 'iqra-tts.py')); T = importlib.util.module_from_spec(spec)
_argv = sys.argv; sys.argv = ['x']; spec.loader.exec_module(T); sys.argv = _argv
AR = T.AR
NUMW = {'١': 'وَاحِد', '٢': 'اثْنَانِ', '٣': 'ثَلَاثَة', '٤': 'أَرْبَعَة', '٥': 'خَمْسَة', '٦': 'سِتَّة', '٧': 'سَبْعَة', '٨': 'ثَمَانِيَة', '٩': 'تِسْعَة', '١٠': 'عَشَرَة', '٠': 'صِفْر'}
LNAME = {g: n for g, n in NAME.items()}; LNAME.update({'أ': 'أَلِف', 'إ': 'أَلِف', 'آ': 'أَلِف مَدّ', 'ى': 'أَلِف مَقْصُورَة', 'ؤ': 'هَمْزَة', 'ئ': 'هَمْزَة'})
def sukun_final(w):
    """كلمة مضبوطة: إن كان آخر حرف صامت بلا حركة أُلحق به سكون (وقف)."""
    if not re.search('[' + AR + ']', w): return w
    m = re.match('^(.*?)([' + HK + ']*)$', w); core, tail = m.group(1), m.group(2)
    last = core[-1]
    if last in 'اىآءة' or tail: return w
    if last == 'و' and len(core) >= 2 and re.search('\u064F[' + HK + ']*$', w[:-1]): return w
    if last == 'ي' and len(core) >= 2 and re.search('\u0650[' + HK + ']*$', w[:-1]): return w
    return w + '\u0652'
def word_full(w):
    w = w.replace('\u0640', ''); bare = skel(w)
    if len(bare) == 1 and bare in LNAME and w == bare: return LNAME[bare] + ('ْ' if LNAME[bare][-1] not in 'ة' else '')  # «ب» → بَاءْ
    if bare in NUMW: return NUMW[bare]
    if re.fullmatch('[\u0660-\u0669]+', bare): return bare
    # حرف بحركة «بَ» أو مقطع «بَا» → يُترك كما هو (ينطقه المحرّك مقطعًا)
    return sukun_final(w.replace('\u0640', ''))
ORD = {'١': 'أَوَّلًا', '٢': 'ثَانِيًا', '٣': 'ثَالِثًا', '٤': 'رَابِعًا', '٥': 'خَامِسًا', '٦': 'سَادِسًا', '٧': 'سَابِعًا'}
def full_of(raw):
    raw = re.sub(r'^([١-٧]) ،', lambda m: ORD[m.group(1)] + ' ،', raw)
    out = []
    for tok in re.split(r'(\s+)', raw):
        if not tok or tok.isspace(): out.append(tok); continue
        m = re.match('^([^' + AR + HK + ']*)(.*?)([^' + AR + HK + ']*)$', tok)
        pre, core, post = m.groups()
        out.append(pre + (word_full(core) if core else '') + post)
    return ''.join(out)
def main(pack):
    d = json.load(open(pack, encoding='utf-8')); n = 0
    for code, S in [(l['code'], T.segments_lesson(l)) for l in d.get('lessons', [])] + [(t['code'], T.segments_library(t)) for t in d.get('library', [])]:
        raws = []
        for key, text, w in S:
            for t in ([x for x, _ in text] if isinstance(text, list) else [text]):
                r = T.speakable_raw(t)
                if r and r not in raws: raws.append(r)
        obj = {'_': f'ضبط {code} — مولَّد من نصوص Pre-A1 المضبوطة (أسماء الحروف المفردة، سكون الوقف)'}
        bad = []
        for r in raws:
            f = full_of(r); obj[r] = f
            b = T.dabt_lint(f)
            if b: bad.append((r, ''.join(b)))
        out = os.path.join(TEP, 'tools', 'iqra', 'dabt', code + '.json')
        json.dump(obj, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1); n += 1
        print(code, len(raws), 'segments', '· lint:', bad if bad else 'clean')
    print('wrote', n, 'dabt files')
if __name__ == '__main__':
    for p in sys.argv[1:]: main(p)
