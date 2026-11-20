# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C2-U07 «خارج مجالي: النقاش المجرّد المعقّد» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا؛ الاقتباسات التراثيّة من الملك العامّ «بتصرّف يسير» مُسنَدة)
# المرجع الحاكم: CEFR Companion Volume 2020 — C2 (Grammatical accuracy C2: maintains consistent grammatical control of complex language even while attention is otherwise engaged · Vocabulary range/control C2 · Written production C2: clear, smoothly flowing, complex texts in an appropriate and effective style with a logical structure · Reading C2: appreciates subtle distinctions of style and implicit meaning · Listening C2: follows specialised discussion with ease)
# python3 tools/iqra/author/c2-u06.py → tools/iqra/packs/iqra-pack-C2-U07.json
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C2-U07'; _h.N_CARDS = 20; _h.N_EX = 40
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'iqra-pack-C2-U07.json')

# طبقات الأسئلة (LINT-C2-B): ح = حرفيّ 20٪ · س = استدلاليّ 40٪ · ن = نقديّ/أسلوبيّ 40٪ (± 10)
def LY(layer, ex): ex['layer'] = layer; return ex
H = lambda ex: LY('literal', ex)
S = lambda ex: LY('inferential', ex)
N = lambda ex: LY('critical', ex)

UNIT = {'code': 'C2-U07', 'level': 'C2', 'idx': 7, 'title_ar': 'خارج مجالي: النقاش المجرّد المعقّد', 'title_en': 'Outside my field: complex abstract discussion',
        'focus_ar': 'أفهم حوارًا مجرّدًا معقّدًا في علم لا أعرفه فأعيد بناءه، لا بأن أسأل «ماذا قال؟» بل «على أيّ تمييز بنى كلامه؟»: أتتبّع التعريف والتمييز والتفريع، وأشتقّ المصطلح من سياقه بقرائنه الأربع، وأكتب بلغة التجريد (بما هو، ومن حيث، وبوصفه، والشرط المضادّ للواقع)، وأعيد بناء حجّة الضيف في دقيقة بتمييزها المركزيّ ومثالها الحاسم واعتراضها الأقوى وما بقي مفتوحًا، وألخّص الحوار المجرّد فقرةً أكاديميّة بأسلوبها — على خمسة ضيوف من خمسة علوم في مجلس الجدّ حسن: نورة في فلسفة العقل، وسعيد في الاقتصاد السلوكيّ، ورنا في فيزياء الزمن، وفارس في الذكاء الاصطناعيّ واللغة، وأسماء في علم المخطوطات.',
        'domains': ['educational', 'public']}
