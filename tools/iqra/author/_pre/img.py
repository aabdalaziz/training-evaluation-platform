# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# صور Pre-A1: حروف الهجاء (text SVG كالأرقام) + ≈ 45 شيئًا بسيطًا بأسلوب مجموعة public/iqra/img (64×64، خلفية #FAF8F4، rx 12)
import os
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', '..', 'public', 'iqra', 'img')
HEAD = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128"><rect width="64" height="64" rx="12" fill="#FAF8F4"/>'
NAVY, TEAL, GOLD, SAND, GREEN, BROWN, RED, SKIN, INK, GREY, BLUE, WHITE = '#0F2A4E', '#2E7D86', '#D9A441', '#F4F1EA', '#3B7D4F', '#8A6410', '#B8433A', '#F3D3B8', '#0B222A', '#8C8C8C', '#3C6FB5', '#FFFFFF'
def svg(name, body): open(os.path.join(OUT, name + '.svg'), 'w', encoding='utf-8').write(HEAD + body + '</svg>')
def txt(ch, size=40, y=46, fill=NAVY): return f'<text x="32" y="{y}" font-size="{size}" text-anchor="middle" font-family="sans-serif" font-weight="700" fill="{fill}">{ch}</text>'

LETTERS = [('alif', 'ا'), ('ba', 'ب'), ('ta', 'ت'), ('tha', 'ث'), ('jim', 'ج'), ('ha', 'ح'), ('kha', 'خ'), ('dal', 'د'), ('dhal', 'ذ'), ('ra', 'ر'), ('zay', 'ز'), ('sin', 'س'), ('shin', 'ش'), ('sad', 'ص'), ('dad', 'ض'), ('tah', 'ط'), ('zah', 'ظ'), ('ain', 'ع'), ('ghain', 'غ'), ('fa', 'ف'), ('qaf', 'ق'), ('kaf', 'ك'), ('lam', 'ل'), ('mim', 'م'), ('nun', 'ن'), ('heh', 'ه'), ('waw', 'و'), ('ya', 'ي'), ('hamza', 'ء'), ('ta-marbuta', 'ة')]
for n, ch in LETTERS: svg('letter-' + n, txt(ch, 44, 48))
# حركات على الباء (بطاقات الحركات)
for n, ch in [('fatha', 'بَ'), ('damma', 'بُ'), ('kasra', 'بِ'), ('sukun', 'بْ'), ('shadda', 'بّ'), ('tanwin', 'بٌ')]: svg('haraka-' + n, txt(ch, 44, 48, TEAL))
svg('zero', txt('٠'))
COLORS = {'red': '#C62828', 'blue': '#1E5AA8', 'green': '#2E7D32', 'yellow': '#F2C200', 'black': '#111111', 'white': '#FFFFFF', 'brown': '#6D4C2A', 'orange': '#EF7D1A'}
for n, c in COLORS.items(): svg('color-' + n, f'<rect x="12" y="12" width="40" height="40" rx="8" fill="{c}" stroke="#0F2A4E" stroke-width="{2 if n == "white" else 0}"/>')

_fill = lambda f, extra: '' if 'fill=' in extra else f'fill="{f}"'
P = lambda d, f, extra='': f'<path d="{d}" {_fill(f, extra)} {extra}/>'
C = lambda x, y, r, f, extra='': f'<circle cx="{x}" cy="{y}" r="{r}" {_fill(f, extra)} {extra}/>'
R = lambda x, y, w, h, f, rx=0, extra='': f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{f}" {extra}/>'
L = lambda x1, y1, x2, y2, s, w=3: f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{s}" stroke-width="{w}" stroke-linecap="round"/>'
E = lambda x, y, rx, ry, f: f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{f}"/>'

def person(hair, body, beard=False, hijab=False):
    g = C(32, 20, 9, SKIN)
    if hijab: g += P('M21 20a11 11 0 0 1 22 0v14H21z', hair) + C(32, 21, 7.5, SKIN)
    else: g += P('M23 20a9 9 0 0 1 18 0v-3a9 9 0 0 0-18 0z', hair)
    if beard: g += P('M25 24a7 7 0 0 0 14 0v4a7 7 0 0 1-14 0z', hair)
    g += P('M20 58V40a12 12 0 0 1 24 0v18z', body)
    return f'<g transform="translate(32 8) scale(0.8) translate(-32 0)">{g}</g>'
svg('father', person(INK, NAVY, beard=True))
svg('mother', person(TEAL, GOLD, hijab=True))
svg('fig', P('M32 16c-10 0-18 9-18 20s8 18 18 18 18-7 18-18-8-20-18-20z', '#5B3A7A') + L(32, 8, 32, 17, GREEN, 3) + P('M24 38c3 6 13 6 16 0', '#C98FD6'))
svg('coffee-beans', E(22, 30, 9, 13, BROWN) + L(22, 19, 22, 41, SAND, 2) + E(42, 36, 9, 13, BROWN) + L(42, 25, 42, 47, SAND, 2))
svg('flute', R(8, 29, 48, 7, BROWN, 3) + ''.join(C(x, 32.5, 1.8, SAND) for x in (20, 27, 34, 41, 48)))
svg('chicken', E(32, 38, 16, 12, SAND) + C(44, 26, 7, SAND) + P('M50 25l6 2-6 2z', GOLD) + P('M42 18l2-4 2 4 2-4 2 4z', RED) + C(45, 25, 1.3, INK) + L(28, 50, 28, 57, GOLD) + L(36, 50, 36, 57, GOLD))
svg('bear', C(20, 20, 7, BROWN) + C(44, 20, 7, BROWN) + C(32, 32, 18, BROWN) + E(32, 38, 8, 6, SAND) + C(26, 28, 2, INK) + C(38, 28, 2, INK) + C(32, 36, 2.5, INK))
svg('fly', E(32, 36, 7, 11, INK) + C(32, 22, 5, INK) + E(22, 30, 9, 5, '#BFDDE3') + E(42, 30, 9, 5, '#BFDDE3') + C(30, 21, 1.5, RED) + C(34, 21, 1.5, RED))
svg('hand', P('M22 56V34a3 3 0 0 1 6 0V22a3 3 0 0 1 6 0v10V18a3 3 0 0 1 6 0v14V22a3 3 0 0 1 6 0v22c0 7-5 12-12 12h-4a8 8 0 0 1-8-8z', SKIN) + P('M22 44l-6-8a3 3 0 0 1 5-3l5 7z', SKIN))
svg('oil', R(22, 20, 20, 36, '#C9B13A', 4) + R(27, 10, 10, 12, GREEN, 2) + R(25, 34, 14, 10, SAND, 2))
svg('milk', P('M22 22l4-10h12l4 10v32H22z', WHITE, f'stroke="{NAVY}" stroke-width="2.5"') + R(22, 38, 20, 16, '#DCEBF5'))
svg('dog', E(34, 40, 16, 10, BROWN) + C(18, 30, 8, BROWN) + E(12, 36, 3.5, 7, '#5C3F18') + C(16, 28, 1.5, INK) + C(11, 32, 2, INK) + L(26, 49, 26, 57, BROWN, 4) + L(42, 49, 42, 57, BROWN, 4) + P('M50 36c6-4 8-10 4-14', '#5C3F18', 'stroke="#5C3F18" stroke-width="3" fill="none"'))
svg('camel', P('M14 52V38c0-8 6-12 10-10l4 6 4-8 6 8V52h-5V42h-4v10h-6V44h-4v8z', GOLD) + P('M38 34h6l6-10h4v6l-3 6v16h-5V40h-8z', GOLD) + C(52, 25, 1.3, INK))
svg('ant', C(20, 36, 6, INK) + E(32, 34, 7, 5, INK) + E(45, 34, 9, 7, INK) + L(28, 30, 22, 22, INK, 2) + L(30, 40, 24, 48, INK, 2) + L(34, 40, 36, 48, INK, 2) + L(36, 30, 44, 24, INK, 2) + L(17, 32, 12, 24, INK, 2))
svg('sea', R(6, 34, 52, 24, BLUE, 6) + P('M6 36q6-5 13 0t13 0 13 0 13 0', WHITE, 'stroke="#FFFFFF" stroke-width="3" fill="none"') + C(46, 18, 7, GOLD))
svg('bicycle', C(18, 42, 10, 'none', f'stroke="{NAVY}" stroke-width="3"') + C(46, 42, 10, 'none', f'stroke="{NAVY}" stroke-width="3"') + P('M18 42l10-16h12l6 16M28 26l6 16h-16', 'none', f'stroke="{TEAL}" stroke-width="3" stroke-linejoin="round"') + L(36, 24, 44, 24, TEAL))
svg('fridge', R(18, 8, 28, 48, SAND, 4, f'stroke="{NAVY}" stroke-width="2.5"') + L(18, 26, 46, 26, NAVY, 2) + L(40, 14, 40, 22, NAVY) + L(40, 32, 40, 44, NAVY))
svg('newspaper', R(10, 14, 44, 36, WHITE, 2, f'stroke="{NAVY}" stroke-width="2.5"') + R(14, 18, 16, 12, NAVY) + L(34, 20, 50, 20, GREY) + L(34, 26, 50, 26, GREY) + L(14, 36, 50, 36, GREY) + L(14, 42, 50, 42, GREY))
svg('corn', E(32, 34, 9, 20, GOLD) + P('M23 30c-8 8-8 20-2 26 4-8 6-14 2-26z', GREEN) + P('M41 30c8 8 8 20 2 26-4-8-6-14-2-26z', GREEN) + ''.join(C(32 + dx, 22 + dy, 1.4, '#B8860B') for dy in range(0, 26, 6) for dx in (-4, 0, 4)))
svg('fire', P('M32 8c4 10 14 14 14 28a14 14 0 0 1-28 0c0-8 4-10 6-16 2 4 4 6 6 6-2-8 0-12 2-18z', '#E8622A') + P('M32 30c2 6 7 8 7 14a7 7 0 0 1-14 0c0-6 5-8 7-14z', GOLD))
svg('fish', E(28, 32, 16, 10, TEAL) + P('M44 32l12-9v18z', TEAL) + C(20, 29, 2, WHITE) + C(20, 29, 1, INK) + P('M26 23q6 2 12 0', TEAL, f'stroke="{SAND}" stroke-width="2" fill="none"'))
svg('soap', R(14, 22, 36, 22, '#E7B7D2', 8) + C(22, 16, 4, '#BFDDE3') + C(44, 14, 3, '#BFDDE3') + C(50, 22, 2.5, '#BFDDE3') + R(22, 30, 20, 6, '#F6D9E8', 3))
svg('tooth', P('M22 14c-8 0-10 10-6 18l4 22c1 4 6 4 7 0l3-12h4l3 12c1 4 6 4 7 0l4-22c4-8 2-18-6-18-4 0-6 3-10 3s-6-3-10-3z', WHITE, f'stroke="{NAVY}" stroke-width="2.5"'))
svg('eye', P('M8 32q24-24 48 0-24 24-48 0z', WHITE, f'stroke="{NAVY}" stroke-width="2.5"') + C(32, 32, 9, BROWN) + C(32, 32, 4.5, INK) + C(35, 29, 1.6, WHITE))
svg('grapes', ''.join(C(x, y, 5, '#6A3D9A') for x, y in [(24, 26), (32, 26), (40, 26), (20, 34), (28, 34), (36, 34), (44, 34), (24, 42), (32, 42), (40, 42), (28, 50), (36, 50)]) + L(32, 20, 34, 10, BROWN) + P('M34 12c6-4 12-2 14 2-6 2-12 2-14-2z', GREEN))
svg('crow', E(34, 38, 16, 10, INK) + C(18, 30, 8, INK) + P('M10 30l-8 2 8 3z', GOLD) + C(16, 28, 1.5, WHITE) + P('M48 34l10-6-6 10z', INK) + L(30, 48, 30, 56, GOLD) + L(38, 48, 38, 56, GOLD))
svg('gazelle', E(34, 40, 14, 8, '#C8995A') + C(18, 28, 6, '#C8995A') + L(22, 34, 30, 36, '#C8995A', 4) + L(16, 22, 10, 10, BROWN, 2.5) + L(20, 22, 20, 10, BROWN, 2.5) + C(16, 27, 1.2, INK) + L(26, 47, 24, 58, '#C8995A', 3) + L(32, 47, 32, 58, '#C8995A', 3) + L(40, 47, 42, 58, '#C8995A', 3) + L(46, 46, 50, 56, '#C8995A', 3))
svg('duck', E(34, 40, 16, 10, GOLD) + C(20, 28, 8, GOLD) + P('M12 28l-8 2 8 3z', '#E8622A') + C(18, 26, 1.5, INK) + R(6, 50, 52, 6, BLUE, 3))
svg('elephant', E(36, 36, 18, 14, GREY) + C(20, 30, 11, GREY) + P('M14 36c-4 6-4 14 0 20 3-2 4-8 4-14z', GREY) + C(18, 28, 1.6, INK) + E(28, 26, 6, 9, '#A8A8A8') + L(30, 50, 30, 58, GREY, 5) + L(44, 50, 44, 58, GREY, 5))
svg('crescent', C(30, 32, 20, GOLD) + C(38, 28, 17, '#FAF8F4'))
svg('cat', C(32, 36, 16, '#B7A58A') + P('M18 26l-2-14 12 8zM46 26l2-14-12 8z', '#B7A58A') + C(26, 34, 2, INK) + C(38, 34, 2, INK) + P('M30 41h4l-2 3z', '#D98A8A') + L(10, 40, 24, 42, INK, 1.5) + L(10, 46, 24, 44, INK, 1.5) + L(54, 40, 40, 42, INK, 1.5) + L(54, 46, 40, 44, INK, 1.5))
svg('coffee', P('M16 24h28v14a14 14 0 0 1-28 0z', WHITE, f'stroke="{NAVY}" stroke-width="2.5"') + P('M44 28h6a6 6 0 0 1 0 12h-6', 'none', f'stroke="{NAVY}" stroke-width="2.5"') + R(16, 26, 28, 6, BROWN) + P('M24 18c0-4 4-4 4-8M32 18c0-4 4-4 4-8', 'none', f'stroke="{GREY}" stroke-width="2"'))
svg('box', P('M12 24l20-8 20 8v24l-20 8-20-8z', '#C9A066') + P('M12 24l20 8 20-8', 'none', f'stroke="{BROWN}" stroke-width="2.5"') + L(32, 32, 32, 56, BROWN, 2.5))
svg('paper', P('M16 8h22l10 10v38H16z', WHITE, f'stroke="{NAVY}" stroke-width="2.5"') + P('M38 8v10h10', 'none', f'stroke="{NAVY}" stroke-width="2.5"') + L(22, 28, 42, 28, GREY) + L(22, 36, 42, 36, GREY) + L(22, 44, 36, 44, GREY))
svg('water', P('M18 10h28l-4 44H22z', '#DCEBF5', f'stroke="{NAVY}" stroke-width="2.5"') + P('M21 26h22l-3 28H24z', BLUE))
svg('sky', R(6, 6, 52, 52, '#9CC9F0', 12) + E(24, 34, 12, 7, WHITE) + C(30, 28, 8, WHITE) + E(40, 36, 10, 6, WHITE) + C(50, 16, 6, GOLD))
svg('shoe', P('M10 44c0-6 6-8 12-10l8-12h8v10c6 2 16 4 18 10v6H10z', BROWN) + R(10, 46, 46, 6, INK, 2) + L(32, 30, 38, 30, SAND, 2) + L(31, 35, 39, 35, SAND, 2))
svg('lion', ''.join(f'<polygon points="{32+26*__import__("math").cos(a*0.5236):.1f},{32+26*__import__("math").sin(a*0.5236):.1f} {32+16*__import__("math").cos((a+0.5)*0.5236):.1f},{32+16*__import__("math").sin((a+0.5)*0.5236):.1f} {32+16*__import__("math").cos((a-0.5)*0.5236):.1f},{32+16*__import__("math").sin((a-0.5)*0.5236):.1f}" fill="#A8691C"/>' for a in range(12)) + C(32, 32, 16, '#C98A2E') + C(32, 34, 11, GOLD) + C(27, 31, 2.2, INK) + C(37, 31, 2.2, INK) + P('M29 38h6l-3 4z', INK) + L(22, 42, 16, 44, INK, 1.5) + L(42, 42, 48, 44, INK, 1.5))
svg('well', P('M14 36h36v18H14z', '#9E9E9E') + ''.join(L(x, 36, x, 54, '#6E6E6E', 1.5) for x in (22, 30, 38, 46)) + L(18, 36, 18, 18, BROWN, 3) + L(46, 36, 46, 18, BROWN, 3) + P('M12 20l20-10 20 10z', RED) + L(32, 20, 32, 32, INK, 1.5) + R(28, 32, 8, 6, GREY, 1))
svg('mouse', E(34, 38, 14, 10, GREY) + C(20, 34, 7, GREY) + C(16, 26, 4, '#D9B3B3') + C(24, 26, 4, '#D9B3B3') + C(18, 33, 1.3, INK) + C(13, 36, 1.5, '#D98A8A') + P('M48 40c8 0 10 8 4 12', 'none', f'stroke="{GREY}" stroke-width="2.5"'))
svg('medicine', R(14, 20, 36, 24, WHITE, 12, f'stroke="{NAVY}" stroke-width="2.5"') + P('M32 20v24h18V32a12 12 0 0 0-12-12z', RED) + R(31, 20, 2, 24, NAVY))
svg('apple', C(32, 36, 17, '#C62828') + P('M32 20c0-6 3-9 6-11', 'none', f'stroke="{BROWN}" stroke-width="3"') + P('M34 16c6-6 12-4 14 0-6 4-12 4-14 0z', GREEN))
svg('shop', R(10, 28, 44, 28, SAND, 2, f'stroke="{NAVY}" stroke-width="2.5"') + P('M8 28l6-12h36l6 12z', RED) + ''.join(R(8 + i * 8, 24, 8, 6, WHITE if i % 2 else RED) for i in range(6)) + R(26, 38, 12, 18, NAVY, 2) + R(14, 36, 8, 8, '#BFDDE3'))
svg('mountain', P('M4 54l20-32 10 16 8-12 18 28z', '#6E7B8B') + P('M24 22l6 10 4-6-4-6z', WHITE) + C(50, 16, 6, GOLD))
print('ok', len(os.listdir(OUT)), 'svg files')
