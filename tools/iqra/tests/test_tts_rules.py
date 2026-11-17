#!/usr/bin/env python3
"""اختبارات قواعد «استوديو اقرأ» (tools/iqra-tts.py) بلا شبكة: الضبط، المتكلّم، جِدّة/الجَدّة، السرعة. تشغيل: python3 tools/iqra/tests/test_tts_rules.py"""
import os, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
src = open(os.path.join(ROOT, 'iqra-tts.py'), encoding='utf-8').read().split('if __name__')[0]
g = {'__file__': os.path.join(ROOT, 'iqra-tts.py'), '__name__': 'rules'}; exec(src, g)
speakable, who, rate_of, LINE_RE, scene_reset = g['speakable'], g['who'], g['rate_of'], g['LINE_RE'], g['scene_reset']
dabt_lint, pausal, waqf, dabt_of, speakable_raw = g['dabt_lint'], g['pausal'], g['waqf'], g['dabt_of'], g['speakable_raw']
assert speakable('رحلة جدّة مع الجدّة فاطمة وجدّتي') == 'رحلة جِدَّة مع الجَدَّة فاطِمَة وجَدَّتي'
assert speakable('ماريا تسافر إلى جدّة مع ليلى') == 'مارْيا تسافر إلى جِدَّة مع لَيْلَى'
assert who('الجدّة فاطمة')[4] == 'grandma' and who('الجدّة فاطمة')[3] == 'f' and who('الجدّة فاطمة')[5] == 'فاطمة'
assert who('الجدّة')[0] == who('فاطمة')[0] and who('الجدّة')[5] == 'فاطمة' and who('جدّتي')[5] == 'فاطمة' and who('الجدّ')[5] == 'حسن', 'الكنية → الاسم: صوت واحد للجدّة'
assert who('الموظّف أبو فيصل')[5] == 'أبو فيصل' and who('المعلّمة هند')[5] == 'هند' and who('الرسالة ١ — ليلى')[5] == 'ليلى'
m = LINE_RE.match('ليلى (٨:٣٠): صباح الخير.'); assert m and m.group(1) == 'ليلى (٨:٣٠)' and m.group(2) == 'صباح الخير.' and who(m.group(1))[5] == 'ليلى'
assert LINE_RE.match('القطار ٤: يغادر ٧:٣٠').group(1) == 'القطار ٤'
scene_reset(); a = who('الرجل'); b = who('رجل كبير'); c = who('الرجل'); w = who('زوجته'); assert a[0] != b[0] and a[0] == c[0] and w[3] == 'f', 'احتياطيّ مرقّم داخل المشهد'
scene_reset(); assert who('السائق')[0] == 'ar-IQ-BasselNeural' and who('الكاشيرة')[0] == 'ar-IQ-RanaNeural'
assert who('الموظّف أبو فيصل')[0] == 'ar-BH-AliNeural'
assert who('المذيعة')[3] == 'f' and who('المفتّش')[4] == 'officer' and who('المفتّش')[3] == 'm'
assert who('عمر (يدخل مسرعًا)')[5] == 'عمر' and who('عمر (يدخل مسرعًا)')[1] == '+25Hz'
assert who('سارة (ضاحكة)')[0] == 'ar-KW-NouraNeural'
assert speakable('(١ — عند البائع)') == ''
assert speakable('عصير ٣ × ٦ = ١٨ · خصم ٢٥٪') == 'عصير ٣ في ٦ يساوي ١٨، خَصْم ٢٥ في المِئَة'
assert speakable('بكم كيلو العجوة؟ بالعدّاد من فضلك.') == 'بكم كِيلُو العَجْوَة؟ بالعَدّاد من فضلك.'
assert rate_of('A1', None) == '-20%' and rate_of('A1', '-8%') == '-28%' and rate_of('B2', None) == '+0%'
assert speakable('مرحبًا يا جماعة 👋 أكيد 👍 ✅') == 'مرحبًا يا جماعة أكيد'
# الضبط الكامل: الفاحص، الوقف، والمعجم المؤلَّف
assert dabt_lint('السَّلَامُ عَلَيْكُمْ يَا عَمِّ. بِكَمْ كِيلُو الْعَجْوَةِ؟') == []
assert dabt_lint('اللَّهُ يُبَارِكُ فِيكَ · لِلطَّالِبَةِ · وَالصَّفَاوِي · الِاقْتِصَادِيَّةُ') == []
assert dabt_lint('السلام عَلَيْكُمْ') == ['ل', 'س', 'ل', 'م'], dabt_lint('السلام عَلَيْكُمْ')
assert pausal('الْعَجْوَةُ بِسِتِّينَ رِيَالًا، وَالصَّفَاوِي بِأَرْبَعِينَ.') == 'الْعَجْوَةُ بِسِتِّينَ رِيَالا، وَالصَّفَاوِي بِأَرْبَعِين.'
assert pausal('هَلْ عِنْدَكَ سِعْرٌ أَحْسَنُ؟') == 'هَلْ عِنْدَكَ سِعْرٌ أَحْسَن؟' and waqf('غَالٍ') == 'غَال' and waqf('هُدًى') == 'هُدى' and waqf('فِيكُمْ') == 'فِيكُمْ'
assert pausal('كِيلُو') == 'كِيلُو' and pausal('عُلْبَةٌ') == 'عُلْبَهْ' and pausal('عِنْدِي أُخْتٌ وَاحِدَةٌ.') == 'عِنْدِي أُخْتٌ وَاحِدَهْ.' and pausal('مَدْرَسَةً') == 'مَدْرَسَهْ' and pausal('الْعَجْوَةُ بِسِتِّينَ') == 'الْعَجْوَةُ بِسِتِّين'
full = dabt_of(speakable_raw('السلام عليكم يا عمّ. بكم كيلو العجوة؟')); assert full and full.startswith('السَّلَامُ'), 'المعجم المؤلَّف يُقرأ من tools/iqra/dabt'
assert speakable('السلام عليكم يا عمّ. بكم كيلو العجوة؟') == 'السَّلَامُ عَلَيْكُمْ يَا عَمّ. بِكَمْ كِيلُو الْعَجْوَهْ؟'
assert dabt_of(speakable_raw('(١ — عند البائع)')) is None and dabt_of('١ ، عند البائع') == 'الْمَشْهَدُ الْأَوَّلُ: عِنْدَ الْبَائِعِ.'
# الأصوات المرفوضة بالسماع لا تظهر في الطاقم ولا في الاحتياطيّ
V = g['V']; _rej = {v for k, vs in V['rejected'].items() if not k.startswith('_') for v in vs}
assert not ({c['voice'] for c in V['cast'].values()} | {c['voice'] for g in V['fallback'].values() for c in g} | {V['narrator']['voice']}) & _rej
assert who('ريم')[:2] == ('ar-QA-AmalNeural', '+6Hz') and who('أبو سعد')[:2] == ('ar-KW-FahedNeural', '-6Hz')
# الجولة 4: الدور المعرَّف باسمه، تقسيم السطر بين متكلّمين، البريد الصوتيّ، العناوين المرقّمة القصيرة
split_speakers, author_of, segments_library = g['split_speakers'], g['author_of'], g['segments_library']
scene_reset(); assert who('الموظّف فهد')[5] == 'فهد' and who('الموظّف')[5] == 'فهد', 'بعد «الموظّف فهد:» يبقى «الموظّف:» بصوت فهد'
scene_reset(); assert who('السائق (أبو محمد)')[5] == 'أبو محمد' and who('السائق')[5] == 'أبو محمد'
scene_reset(); assert who('السائق')[0] == 'ar-IQ-BasselNeural', 'بلا تعريف يبقى الاحتياطيّ'
scene_reset(); ps = split_speakers('فهد', 'هل ضغطت الزرّ الأزرق؟ — سامي: … الآن يعمل. شكرًا!'); assert ps and [w[5] for _, w in ps] == ['فهد', 'سامي'] and ps[1][0].startswith('…'), ps
assert split_speakers('هند', 'حسنًا، الدرس الأوّل: الأرقام') is None and split_speakers('كين', 'بطاقة المعهد! — الرجل: نعم.') is None
assert [w[5] for _, w in split_speakers('كين', 'طبقي سوشي. · ماريا: تورتيّا. · يوسف: أرزّ. · عمر (ليس في الصفّ): سوشي!')] == ['كين', 'ماريا', 'يوسف', 'عمر']
t = {'code': 'T-VM', 'kind': 'listen', 'body_ar': 'الهاتف: لديكِ رسالة.\nالرسالة الأولى، اليوم في الثامنة: صباح الخير يا ماريا، أنا نورة من مكتب التسجيل.\nانتهت الرسائل.'}
S = segments_library(t); assert isinstance(S[1][1], list) and S[1][0]['r'] == 'نورة' and S[1][1][0][1][0] == S[0][2][0] and S[1][1][1][1][5] == 'نورة', 'عنوان الرسالة بصوت الهاتف ونصّها بصوت نورة'
g['CUR_AUTHOR'].clear(); assert author_of('A1-U06-L05', 2, '٢) إلى الجدّة فاطمة — شكر')[5] == '' and author_of('A1-U06-L05', 8, '٥) إلى كين — سؤال عن مريض')[5] == '' and author_of('A1-U06-L05', 3, 'جدّتي الحبيبة، شكرًا جزيلًا على الغداء أمس.')[5] == 'ليلى'
assert author_of('A1-U04-L05', 3, '١) اخرجوا من المعهد واتّجهوا إلى اليسار (نحو البنك).')[5] == 'ليلى', 'خطوات الدليل المرقّمة الطويلة بصوت كاتبتها'
g['CUR_AUTHOR'].clear(); assert author_of('A1-U07-L05', 0, 'نموذج تسجيل النزيل — فندق الواحة')[5] == '' and author_of('A1-U07-L05', 12, 'رسالة سامي إلى الاستقبال')[5] == '' and author_of('A1-U07-L05', 13, 'صباح الخير. أنا سامي العتيبي.')[5] == 'سامي'
scene_reset(); assert who('النداء ١')[0] == who('النداء ٢')[0] == who('النداء ٦')[0], 'نداءات المطار المرقّمة صوت واحد'
print('tts rules OK')
