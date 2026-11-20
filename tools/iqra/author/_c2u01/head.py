# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C2-U01 «قراءة التراث: من الجاحظ إلى ابن خلدون» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا؛ الاقتباسات التراثيّة من الملك العامّ «بتصرّف يسير» مُسنَدة)
# المرجع الحاكم: CEFR Companion Volume 2020 — C2 (Reading as a leisure activity / for information and argument: can understand virtually all forms of written language including classical texts · Identifying cues and inferring: can recognise stylistic and register differences · Sociolinguistic appropriateness C2 · Mediating a text: can explain in clear, well-structured contemporary language the sense of a classical passage)
# python3 tools/iqra/author/c2-u01.py → tools/iqra/packs/iqra-pack-C2-U01.json
import os, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C2-U01'; _h.N_CARDS = 20; _h.N_EX = 40
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'packs', 'iqra-pack-C2-U01.json')

# طبقات الأسئلة (LINT-C2-B): ح = حرفيّ 20٪ · س = استدلاليّ 40٪ · ن = نقديّ/أسلوبيّ 40٪ (± 10)
def LY(layer, ex): ex['layer'] = layer; return ex
H = lambda ex: LY('literal', ex)
S = lambda ex: LY('inferential', ex)
N = lambda ex: LY('critical', ex)

UNIT = {'code': 'C2-U01', 'level': 'C2', 'idx': 1, 'title_ar': 'قراءة التراث: من الجاحظ إلى ابن خلدون', 'title_en': 'Reading the classical heritage: al-Jahiz to Ibn Khaldun',
        'focus_ar': 'أقرأ النصّ التراثيّ النثريّ الطويل (الجاحظ · ابن خلدون · التوحيدي · المعرّي · ابن بطّوطة) بالراحة التي أقرأ بها مقال الصباح: أفكّ معجمه وبناءه، وأميّز أسلوبه من أسلوب المعاصرين تمييزًا أستطيع أن أسمّيه، وأعيد صياغته بلسان اليوم بلا خيانة لمعناه ولا لصوته.',
        'domains': ['educational', 'public']}
