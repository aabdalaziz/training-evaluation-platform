# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» C1-U08 «الإعلام والسجلّ المُذاع» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — C1 (Watching TV, film and video / Listening to audio media and recordings: can understand a wide range of recorded and broadcast audio material, including some non-standard usage, and identify finer points of detail including implicit attitudes and relationships between speakers · Identifying cues and inferring · Overall spoken production / Addressing audiences: can give a clear, well-structured presentation of a complex subject · Spoken fluency · Sociolinguistic appropriateness: can recognise a wide range of idiomatic expressions and colloquialisms, appreciating register shifts) · ثمّ مِعيار LI-C1-01 · LI-C1-02 · LI-C1-04 · SP-C1-01 · SP-C1-02 · SP-C1-03
# سياسة العامّيّة (قرار المالك 2026-11-20): تعرُّفًا لا إنتاجًا · < 5٪ من كلمات الشريط · في فم فهد وضيف واحد (سارة في A01) · قائمة مغلقة من 20 علامة تُدرَّس بالاسم في L03 مع مقابلها الفصيح · لا تمرين إنتاج واحد بالعامّيّة.
# python3 tools/iqra/author/c1-u08.py → tools/iqra/packs/iqra-pack-C1-U08.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'C1-U08'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-C1-U08.json')


UNIT = {'code': 'C1-U08', 'level': 'C1', 'idx': 8, 'title_ar': 'الإعلام والسجلّ المُذاع', 'title_en': 'Broadcast media and spoken register',
        'focus_ar': 'أسمع ما يُذاع كما يُذاع: النشرة والمقابلة والبودكاست، وأميّز التنغيم الساخر من السائل والتحفّظ من التردّد، وأعرف بالاسم عشرين علامة من السجلّ المُذاع فأفهمها ولا أقلّدها، وأردّ فصيحًا على سؤال مباغت، وأعرض موضوعًا بخاتمة. السياسة: العامّيّة هنا للتعرّف لا للإنتاج، كما ينصّ واصف C1 للوسائط المسموعة.',
        'domains': ['public', 'professional']}

