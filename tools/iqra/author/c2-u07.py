# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C2-U07 «خارج مجالي: النقاش المجرّد المعقّد» — يجمع حلقات _c2u07/l0*.py ومكتبة _c2u07/lib.py
# python3 tools/iqra/author/c2-u07.py → tools/iqra/packs/iqra-pack-C2-U07.json
import os, sys, importlib
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, '_c2u07')); sys.path.insert(0, HERE)
import head; from head import UNIT, OUT, _h
lessons = []
for i in range(1, 6):
    try: m = importlib.import_module(f'l0{i}')
    except ModuleNotFoundError: print('missing', f'l0{i}'); continue
    lessons.append(getattr(m, f'L0{i}'))
try: from lib import LIBRARY
except ModuleNotFoundError: LIBRARY = []
_h.write_pack(UNIT, lessons, LIBRARY, OUT, 'athar-authored · C2 batch 4 · U07 (2026-11-21)')
