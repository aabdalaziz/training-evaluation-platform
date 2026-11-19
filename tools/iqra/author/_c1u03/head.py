# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C1-U03 «الأساليب البلاغية» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — C1 (Flexibility: can reformulate ideas in differing linguistic forms to convey finer shades of meaning, emphasis, differentiation · Sociolinguistic appropriateness: can recognise a wide range of idiomatic expressions and register shifts · Overall written production: clear, well-structured texts with an appropriate and effective style) · ثمّ مِعيار LU-C1-03
# python3 tools/iqra/author/c1-u03.py → tools/iqra/packs/iqra-pack-C1-U03.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C1-U03'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-C1-U03.json')


UNIT = {'code': 'C1-U03', 'level': 'C1', 'idx': 3, 'title_ar': 'الأساليب البلاغية', 'title_en': 'Rhetorical devices',
        'focus_ar': 'أتعرّف الأساليب البلاغية الشائعة في الخطابة والمقال (القصر بإنّما وبالنفي والاستثناء وبالتقديم · التقديم والتأخير · الالتفات · الاستفهام الإنكاريّ والتقريريّ · الكناية والاستعارة والتشبيه · الطباق والمقابلة · الحذف والإيجاز · التكرار البلاغيّ · القسم) وأسمّيها وأشرح ما يفعله كلّ أسلوب في موضعه، وأستعمل كلًّا منها في جملة صحيحة، وأحكم متى يُحسن الأسلوب ومتى يثقل، وأكتب المضمون الواحد مرّتين: مزخرفًا ثمّ مقتصدًا، وأختار لكلّ قارئ نسخته',
        'domains': ['educational', 'public']}

