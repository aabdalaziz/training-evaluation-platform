# -*- coding: utf-8 -*-
# © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved.
# دوالّ مشتركة لمولّدات حزم A2 (tools/iqra/author/a2-uXX.py)
import json, os
IMG = lambda n: f'/iqra/img/{n}.svg'

def mcq(q, opts, c, ex=''): return {'kind': 'mcq', 'prompt_ar': q, 'options': opts, 'correct': c, 'explanation_ar': ex}
def match(q, pairs, ex=''): return {'kind': 'matching', 'prompt_ar': q, 'pairs': [{'l': l, 'r': r} for l, r in pairs], 'explanation_ar': ex}
def order(q, words, ex=''): return {'kind': 'ordering', 'prompt_ar': q, 'words': list(words), 'order': list(words), 'explanation_ar': ex}
def pic(q, imgs, c, ex=''): return {'kind': 'picture_choice', 'prompt_ar': q, 'options': [{'text': '', 'image': IMG(i)} for i in imgs], 'correct': c, 'explanation_ar': ex}
def cloze(q, text, gaps, extra, ex=''): return {'kind': 'cloze_bank', 'prompt_ar': q, 'text': text, 'gaps': gaps, 'bank': gaps + extra, 'explanation_ar': ex}
def tf(q, passage, c, ex=''): return {'kind': 'true_false_notgiven', 'prompt_ar': q, 'passage_ar': passage, 'correct': c, 'explanation_ar': ex}
def tap(q, words, c, ex=''): return {'kind': 'word_tap', 'prompt_ar': q, 'words': words, 'correct': c, 'explanation_ar': ex}
def dic(text, alt=None, ex=''): return {'kind': 'short_dictation', 'prompt_ar': 'اسمع واكتب', 'text_ar': text, 'alt': alt or [], 'explanation_ar': ex}
def seq(q, frames, ex=''): return {'kind': 'picture_sequence', 'prompt_ar': q, 'frames': [{'image': IMG(i), 'text': t} for i, t in frames], 'order': [t for _, t in frames], 'explanation_ar': ex}
def card(w, g, e): return {'word_ar': w, 'gloss_ar': g, 'example_ar': e}
UNIT_CODE = 'A2-U00'
def lesson(idx, title, skill, domain, goal, can_ar, can_en, codes, intro, text, grammar, produce, closing, cards, exercises):
    assert len(cards) == 14, (title, len(cards)); assert len(exercises) == 30, (title, len(exercises))
    return {'code': f'{UNIT_CODE}-L0{idx}', 'unit_code': UNIT_CODE, 'idx': idx, 'title_ar': title, 'skill': skill, 'minutes': 20, 'minutes_total': 120, 'domain': domain,
            'goal_ar': goal, 'can_do_ar': can_ar, 'can_do_en': can_en, 'descriptor_codes': codes,
            'content': {'intro_ar': intro, 'text': text, 'grammar': grammar, 'produce': produce, 'closing_ar': closing}, 'cards': cards, 'exercises': exercises}


def apply_uplift(lessons):
    """دفعة رفع «أُنتج» (2026-11-18، الخيار أ): إن وُجد uplift/<UNIT>.json طُبّقت تعديلاته على الحلقات (goal_ar · can_do_ar · can_do_en · content.produce)
    فوق ما يولّده المولّد — المولّد يبقى كما هو، والرفع ملفّ مستقلّ قابل للمراجعة."""
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uplift', f'{UNIT_CODE}.json')
    if not os.path.exists(f): return 0
    ov = json.load(open(f, encoding='utf-8')); n = 0
    for l in lessons:
        o = ov.get(l['code'])
        if not o: continue
        for k in ('goal_ar', 'can_do_ar', 'can_do_en'):
            if k in o: l[k] = o[k]
        if 'produce' in o: l['content']['produce'] = o['produce']
        if 'closing_ar' in o: l['content']['closing_ar'] = o['closing_ar']
        n += 1
    print('uplift', UNIT_CODE, n, 'lessons')
    return n

def write_pack(unit, lessons, library, out, source):
    apply_uplift(lessons)
    pack = {'version': 'iqra-pack-2', 'source': source, 'units': [unit], 'lessons': lessons, 'library': library}
    json.dump(pack, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('wrote', out, 'lessons', len(lessons), 'exercises', sum(len(l['exercises']) for l in lessons), 'cards', sum(len(l['cards']) for l in lessons))
