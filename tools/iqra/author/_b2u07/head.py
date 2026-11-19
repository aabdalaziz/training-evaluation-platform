# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# «اقْرَأْ — من أَثَر» B2-U07 «الموقف والنبرة» — مولّد الحزمة (المحتوى مؤلَّف يدويًّا هنا)
# المرجع الحاكم: CEFR Companion Volume 2020 — B2 (Reading for information and argument · Identifying cues and inferring · Understanding conversation between other speakers) · ثمّ مِعيار RD-B2-03 · LI-B2-03
# python3 tools/iqra/author/b2-u07.py → tools/iqra/packs/iqra-pack-B2-U07.json
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
import _h
from _h import mcq, match, order, pic, cloze, tf, tap, dic, seq, card, lesson
_h.UNIT_CODE = 'B2-U07'
OUT = os.path.join(os.path.dirname(__file__), '..', 'packs', 'iqra-pack-B2-U07.json')


UNIT = {'code': 'B2-U07', 'level': 'B2', 'idx': 7, 'title_ar': 'الموقف والنبرة', 'title_en': 'Stance and tone',
        'focus_ar': 'أميّز موقف الكاتب أو المتكلّم الصريح من الضمنيّ، وأتعرّف على نبرته (متحمّسة · متحفّظة · ساخرة · محايدة) من اختيار الكلمات لا من الكلمات وحدها، وأرصد أدوات التلطيف (ربّما · قد · يبدو أنّ · إن صحّ التعبير) وأدوات التشديد (لا شكّ · من الواضح أنّ · بالتأكيد · من المؤسف أنّ)، وأتابع نقاشًا على الهواء بين متحدّثين يختلفون في الموقف والنبرة، وأقرأ مقالين في قضية واحدة بنبرتين مختلفتين، وأكتب الرأي نفسه بنبرتين وأختار النبرة التي تناسب القارئ، وأعبّر عن موقفي في اجتماع بنبرة مقصودة وأردّ على اعتراض',
        'domains': ['public', 'professional']}
