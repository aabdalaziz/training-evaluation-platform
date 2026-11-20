# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C2-U05 «الأكاديميا: المنهج والمسلّمات والنقد» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا؛ الاقتباسات التراثيّة من الملك العامّ «بتصرّف يسير» مُسنَدة)
# المرجع الحاكم: CEFR Companion Volume 2020 — C2 (Grammatical accuracy C2: maintains consistent grammatical control of complex language even while attention is otherwise engaged · Vocabulary range/control C2 · Written production C2: clear, smoothly flowing, complex texts in an appropriate and effective style with a logical structure · Reading C2: appreciates subtle distinctions of style and implicit meaning · Listening C2: follows specialised discussion with ease)
# python3 tools/iqra/author/c2-u05.py → tools/iqra/packs/iqra-pack-C2-U05.json
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C2-U05'; _h.N_CARDS = 20; _h.N_EX = 40
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'iqra-pack-C2-U05.json')

# طبقات الأسئلة (LINT-C2-B): ح = حرفيّ 20٪ · س = استدلاليّ 40٪ · ن = نقديّ/أسلوبيّ 40٪ (± 10)
def LY(layer, ex): ex['layer'] = layer; return ex
H = lambda ex: LY('literal', ex)
S = lambda ex: LY('inferential', ex)
N = lambda ex: LY('critical', ex)

UNIT = {'code': 'C2-U05', 'level': 'C2', 'idx': 5, 'title_ar': 'الأكاديميا: المنهج والمسلّمات والنقد', 'title_en': 'Academia: method, assumptions and critique',
        'focus_ar': 'أقرأ الورقة البحثيّة من منهجها لا من نتيجتها: المشكلة والمنهج والعيّنة والنتيجة والحدود، وأنقد المسلَّمات التي بُني عليها القياس قبل أن أنقد الرقم، وأكتب مراجعة علميّة بترتيبها (الكبير قبل الصغير) وبلغة التوصية، وألخّص من مصادر متعارضة بلا ترجيح مبكّر، وأقتبس وأحيل على الأصول فلا آخذ جملة أحد بلا اسمه — على ورقة ليلى الأولى «أثر القراءة الجهريّة على الذاكرة» التي تراجعها أسماء وتحكّمها سارة أمام المجلس.',
        'domains': ['educational', 'professional']}
