#!/usr/bin/env python3
"""هـ-3 ح «عدّة الغرفة» — تحويل صفحة غرفة قديمة إلى الإطار الموحّد:
   رأس <header className="xx-head"> → <RoomHead …/>؛ حذف روابط الغرف المكرّرة؛ xx-btn/card/kpi/… → rm-*؛
   حذف قواعد CSS التي صارت في العدّة؛ الجذر يأخذ rm-page.
   الاستعمال: python3 tools/roomkit/codemod.py app/admin/audit/page.tsx [--dry]"""
import re, sys, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
rooms_src = open(os.path.join(ROOT, 'lib/portal/rooms.ts'), encoding='utf-8').read()
ROOM_HREFS = set(re.findall(r"href:\s*'([^']+)'", rooms_src))
RENAME = ['btn', 'card', 'kpis', 'kpi', 'alert', 'muted', 'empty', 'table']
KIT_RULE = re.compile(r"^\.rm-(btn|card|kpis|kpi|alert|muted|empty|table)(\.(ok|info|bad|gold|warn|primary|danger|ghost|on))?(:[a-z-]+)?(\s+(h2|h3|b|span|small|th|td|tr|i|svg|a))?(:[a-z-]+)?(\s+(td|b|span))?$")

def kit_owned(selector_list: str) -> bool:
    sels = [x.strip() for x in selector_list.split(',') if x.strip()]
    return bool(sels) and all(KIT_RULE.match(s) for s in sels)

def transform(path: str, dry=False):
    src = open(path, encoding='utf-8').read()
    m = re.search(r'<header className="([a-z]{2,3})-head([^"]*)">', src)
    if not m:
        print('no header:', path); return
    pre = m.group(1)
    start = m.start(); end = src.index('</header>', start) + len('</header>')
    header = src[start:end]
    body = header[m.end() - start:-len('</header>')]
    # nav
    nav_m = re.search(r'<nav className="%s-nav[^"]*">(.*?)</nav>' % pre, body, re.S)
    nav_inner = nav_m.group(1) if nav_m else ''
    text_block = body[:nav_m.start()] if nav_m else body
    # kicker
    text_block = re.sub(r'\s*<div className="%s-kicker[^"]*">.*?</div>' % pre, '', text_block, count=1, flags=re.S)
    h1 = re.search(r'<h1>(.*?)</h1>', text_block, re.S)
    title = h1.group(1).strip() if h1 else None
    if h1: text_block = text_block[:h1.start()] + text_block[h1.end():]
    # strip outer <div> wrapper of text block
    tb = text_block.strip()
    if tb.startswith('<div>') and tb.endswith('</div>'): tb = tb[5:-6].strip()
    elif tb.startswith('<div') and tb.endswith('</div>'):
        tb = tb[tb.index('>') + 1:-6].strip()
    desc = tb
    # nav children: drop plain room links (no query, not primary)
    kept = []
    for line in nav_inner.strip('\n').split('\n'):
        lm = re.match(r'\s*<Link href="([^"?]+)" className="%s-btn([^"]*)">.*</Link>\s*$' % pre, line)
        if lm and lm.group(1) in ROOM_HREFS and 'primary' not in lm.group(2):
            continue
        if line.strip(): kept.append(line.rstrip())
    actions = '\n'.join(kept)
    parts = ['<RoomHead']
    if title: parts.append('        title={<>%s</>}' % title)
    if desc: parts.append('        desc={<>%s</>}' % desc)
    if actions.strip(): parts.append('        actions={<>\n%s\n        </>}' % actions)
    parts.append('      />')
    new_header = '\n'.join(parts) if len(parts) > 2 else '<RoomHead />'
    src = src[:start] + new_header + src[end:]
    # root class
    src = re.sub(r'<(div|main) className="%s"' % pre, r'<\1 className="%s rm-page"' % pre, src)
    # renames (JSX + CSS)
    for k in RENAME:
        src = re.sub(r'\b%s-%s\b' % (pre, k), 'rm-' + k, src)
    # CSS cleanup
    cm = re.search(r'const CSS = `(.*?)`;', src, re.S)
    if cm:
        css = cm.group(1)
        holes = []
        def hole(mm): holes.append(mm.group(0)); return '@@%d@@' % (len(holes) - 1)
        css = re.sub(r'\$\{[^}]*\}', hole, css)
        def rule(mm):
            sel, decl = mm.group(1), mm.group(2)
            s = sel.strip()
            if s.startswith('@'): return mm.group(0)
            if re.search(r'\.%s-(head|kicker|nav)\b' % pre, s): return ''
            if kit_owned(s): return ''
            if s == '.' + pre:
                decl = ';'.join(d for d in decl.split(';') if d.strip() and not re.match(r'\s*(background|min-height|padding)\s*:', d))
                return '%s{%s}' % (sel, decl)
            return mm.group(0)
        css2 = re.sub(r'([^{}]+)\{([^{}]*)\}', rule, css)
        css2 = css2.replace('#e5e9f0', '#EADFD6').replace('#E5E9F0', '#EADFD6')
        css2 = re.sub(r'\n{3,}', '\n\n', css2)
        css2 = re.sub(r'@@(\d+)@@', lambda mm: holes[int(mm.group(1))], css2)
        src = src[:cm.start(1)] + css2 + src[cm.end(1):]
    # import
    rel = '../' * (path.count('/') - 1) + 'components/RoomKit'  # app/admin/x/page.tsx → ../../components
    if 'RoomKit' not in src:
        im = list(re.finditer(r"^import .*?;\s*(/\*.*?\*/)?\s*$", src, re.M))
        last = im[-1]
        src = src[:last.end()] + "\nimport { RoomHead } from '%s'; /* هـ-3 ح «عدّة الغرفة» */" % rel + src[last.end():]
    # unused Link?
    if re.search(r"^import Link from 'next/link';\s*$", src, re.M) and not re.search(r'<Link\b', src):
        src = re.sub(r"^import Link from 'next/link';\s*\n", '', src, flags=re.M)
    if dry: print(src[:0]); return src
    open(path, 'w', encoding='utf-8').write(src)
    print('ok', path, 'prefix', pre, '| removed links:', nav_inner.count('<Link') - actions.count('<Link'))
    return src

if __name__ == '__main__':
    dry = '--dry' in sys.argv
    for p in [a for a in sys.argv[1:] if not a.startswith('--')]:
        transform(p, dry)
