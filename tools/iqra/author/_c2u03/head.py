# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C2-U03 «التحكّم التامّ: التراكيب المعقّدة والنادرة» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا؛ الاقتباسات التراثيّة من الملك العامّ «بتصرّف يسير» مُسنَدة)
# المرجع الحاكم: CEFR Companion Volume 2020 — C2 (Grammatical accuracy C2: maintains consistent grammatical control of complex language even while attention is otherwise engaged · Vocabulary range/control C2 · Written production C2: clear, smoothly flowing, complex texts in an appropriate and effective style with a logical structure · Reading C2: appreciates subtle distinctions of style and implicit meaning · Listening C2: follows specialised discussion with ease)
# python3 tools/iqra/author/c2-u03.py → tools/iqra/packs/iqra-pack-C2-U03.json
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C2-U03'; _h.N_CARDS = 20; _h.N_EX = 40
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'iqra-pack-C2-U03.json')

# طبقات الأسئلة (LINT-C2-B): ح = حرفيّ 20٪ · س = استدلاليّ 40٪ · ن = نقديّ/أسلوبيّ 40٪ (± 10)
def LY(layer, ex): ex['layer'] = layer; return ex
H = lambda ex: LY('literal', ex)
S = lambda ex: LY('inferential', ex)
N = lambda ex: LY('critical', ex)

UNIT = {'code': 'C2-U03', 'level': 'C2', 'idx': 3, 'title_ar': 'التحكّم التامّ: التراكيب المعقّدة والنادرة', 'title_en': 'Full control: complex and rare structures',
        'focus_ar': 'أتحكّم في التراكيب التي لا يملكها إلّا المتقن وأعرف متى تُستعمل ومتى تُترك: الاشتغال والتنازع، والحال المؤكِّدة والجملة الحاليّة المركّبة، وإعمال المصدر واسم الفاعل، و«ما» الكافّة والمصدريّة والزمانيّة، والقصر بطرقه الأربع، والاستثناء المفرّغ، والتضمين، والجملة المعترضة داخل المعترضة — على مخطوط رواية يوسف الأولى الذي تحرّره ماريا: كلّ حلقة جملة من المخطوط تُفكَّك وتُعاد بثلاث صيغ، ويحتكم الاثنان إلى الشواهد.',
        'domains': ['educational', 'public']}
