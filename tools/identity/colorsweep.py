#!/usr/bin/env python3
"""هـ-3 م «لون واحد»: كنس كل الألوان الست-عشرية خارج لوحة أَثَر إلى أقرب درجة في سلالمها الخمس.

python3 tools/identity/colorsweep.py --plan        # يطبع جدول التحويل فقط
python3 tools/identity/colorsweep.py --apply       # يطبّق على app/ و lib/
"""
import colorsys, os, re, sys

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
HEX = re.compile(r'#([0-9a-fA-F]{6})\b')

# لوحة أَثَر المعتمدة — لا تُمسّ
IDENTITY = {c.lower() for c in """
#3A1F36 #22101F #6A3350 #4A2946 #8E4A68 #B07A9A #D4614A #E8795C #F0A48C #B9544A #9A3A2A #D9A866 #F1D9A8 #B8893F #8A5A1E
#F6EBE0 #FBF4EE #5EA8A0 #8E7F8A #2A1626 #4A3645 #5C4858 #EADFD6 #D9CBC2 #B3A5AE #FBEDE7 #F3C4B6 #F6D3C8 #F0C9BC #C9A6B6
#E6F3F1 #BFE1DC #8FD0C8 #3F7F79 #2F6B66 #F3E8EF #E2CBDA #D9C6CF #FFFFFF #000000 #FFD9CF #F3B4B4 #FDF0F0 #9A2A2A #E6F4F1
#F3E6DC #3A2634 #FFFDFB #3B1D0E #1F4F4A #E9C98A #7A2A1E #5C3B12
""".split()}

RAMPS = {
    #           bg        line      light     accent    dark      deep      deepest
    'coral':  ['#FBEDE7', '#F3C4B6', '#F0A48C', '#D4614A', '#B9544A', '#9A3A2A', '#7A2A1E'],
    'sand':   ['#FBF4EE', '#F1D9A8', '#E9C98A', '#D9A866', '#8A5A1E', '#8A5A1E', '#5C3B12'],
    'sea':    ['#E6F3F1', '#BFE1DC', '#8FD0C8', '#5EA8A0', '#3F7F79', '#2F6B66', '#1F4F4A'],
    'plum':   ['#F3E8EF', '#E2CBDA', '#C9A6B6', '#8E4A68', '#6A3350', '#3A1F36', '#22101F'],
    'neutral':['#FBF4EE', '#EADFD6', '#D9CBC2', '#B3A5AE', '#8E7F8A', '#4A3645', '#2A1626'],
}
STEPS = [0.90, 0.78, 0.64, 0.50, 0.36, 0.22]  # حدود الإضاءة من الأفتح إلى الأغمق
STEPS_N = [0.95, 0.86, 0.72, 0.55, 0.36, 0.22]  # المحايد: الرمادي الفاتح حدٌّ لا خلفية

# rgba القديمة (ظلال/تراكبات) → مكافئها في اللوحة
RGBA = {'15,23,42': '42,22,38', '2,6,23': '34,16,31', '8,26,51': '34,16,31', '20,70,107': '58,31,54', '20,8,18': '34,16,31',
        '220,38,38': '212,97,74', '185,28,28': '185,84,74', '248,113,113': '240,164,140', '225,29,72': '212,97,74',
        '34,197,94': '94,168,160', '45,212,191': '94,168,160', '52,211,153': '94,168,160', '0,137,123': '47,107,102',
        '251,191,36': '217,168,102', '148,163,184': '179,165,174', '100,116,139': '142,127,138', '30,41,59': '42,22,38', '17,24,39': '42,22,38'}
RGBA_RE = re.compile(r'rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*([,)])')

def family(h, s, l):
    if s < 0.10 or (l > 0.88 and s < 0.35) or (l < 0.2 and s < 0.3):
        return 'neutral'
    d = h * 360
    if d < 17 or d >= 340: return 'coral'      # أحمر/وردي → مرجاني (خطر)
    if d < 70:  return 'sand'                  # برتقالي/كهرماني/أصفر → رملي (تنبيه)
    if d < 205: return 'sea'
    return 'plum'

def step(l, fam='x'):
    for i, t in enumerate(STEPS_N if fam == 'neutral' else STEPS):
        if l >= t: return i
    return 6

def target(hexcode):
    c = hexcode.lower()
    if c in IDENTITY: return None
    r, g, b = (int(c[i:i+2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    fam = family(h, s, l)
    return RAMPS[fam][step(l, fam)], fam

def files():
    for base in ('app', 'lib'):
        for dp, _, fns in os.walk(os.path.join(ROOT, base)):
            if '/.arena' in dp or 'node_modules' in dp: continue
            for fn in fns:
                if fn.endswith(('.tsx', '.ts', '.css')): yield os.path.join(dp, fn)

def main():
    apply = '--apply' in sys.argv
    counts, plan, touched = {}, {}, []
    for f in files():
        s = open(f, encoding='utf-8').read()
        def rep(m):
            c = '#' + m.group(1)
            t = target(c)
            if not t: return c
            counts[c.lower()] = counts.get(c.lower(), 0) + 1
            plan[c.lower()] = t
            return t[0]
        n = HEX.sub(rep, s)
        def rrep(m):
            k = ','.join(m.group(i) for i in (1, 2, 3))
            if k in RGBA:
                counts['rgba(' + k] = counts.get('rgba(' + k, 0) + 1; plan['rgba(' + k] = ('rgba(' + RGBA[k], 'rgba')
                return m.group(0)[:m.group(0).index('(') + 1] + RGBA[k] + m.group(4)
            return m.group(0)
        n = RGBA_RE.sub(rrep, n)
        if n != s:
            touched.append(os.path.relpath(f, ROOT))
            if apply: open(f, 'w', encoding='utf-8').write(n)
    for c, (t, fam) in sorted(plan.items(), key=lambda kv: (kv[1][1], -counts[kv[0]])):
        print(f'{fam:8} {c} → {t}  ×{counts[c]}')
    print(f'\n{len(plan)} لونًا خارج اللوحة في {len(touched)} ملفًا — {"طُبِّق" if apply else "خطة فقط"}')
    if '--files' in sys.argv: print('\n'.join(touched))

if __name__ == '__main__':
    main()
