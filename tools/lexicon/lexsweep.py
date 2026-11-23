#!/usr/bin/env python3
"""هـ-4 — معجم أَثَر: كنس المصطلحات إلى القاموس المعتمد.

python3 tools/lexicon/lexsweep.py --plan   # تقرير فقط (لا يكتب)
python3 tools/lexicon/lexsweep.py --apply  # يكتب الملفات
python3 tools/lexicon/lexsweep.py --plan --rule trainer   # قاعدة واحدة

القواعد في lib/lexicon.ts هي المرجع المقروء؛ هذا الملف ينفّذها على app/ lib/ tests/.
لا يلمس: أسماء الأعمدة والمفاتيح البرمجية (لا عربية فيها)، سطور regex/مقارنات DB بعربية (تُطبع للفرز اليدوي).
"""
import re, sys, os, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DIRS = ["app", "lib", "tests"]
EXT = {".ts", ".tsx"}
SELF = {str(Path(__file__).resolve()), str(ROOT / "lib/lexicon.ts")}

AR = "أ-يًٌٍَُِّْءآإؤئى"
NB = f"(?<![{AR}])"      # not preceded by Arabic letter
NA = f"(?![{AR}])"       # not followed by Arabic letter
PRE = "(?P<pre>ال|لل|بال|وال|كال|فال|ولل|وبال|)"
SUF = "(?P<suf>ًا|اً|ً|ين|ون|ان|ات|تين|تان|ة|ك|كم|نا|ه|ها|هم|تك|تكم|تها|ته|وك|وه|وها|وهم|يك|يه|يها|يهم|تي|و|ي|)"

def morph(stem_rx, new_stem):
    rx = re.compile(f"{NB}{PRE}(?:{stem_rx}){SUF}{NA}")
    def repl(m):
        return m.group("pre") + new_stem + m.group("suf")
    return rx, repl

# ── scopes ─────────────────────────────────────────────────────────────
LEARNER_PATHS = (
    "app/miaar/", "app/me/first", "app/me/grad", "app/me/line", "app/me/athar-map",
    "app/me/after", "app/me/page.tsx", "app/me/layout", "app/me/home", "app/me/wallet",
    "app/survey/", "app/evaluate/", "app/impact/", "app/followup/", "app/student/",
    "app/join/", "app/enter/", "app/attend/", "app/credential/", "app/verify/",
    "app/iqra/", "app/e/", "app/g/", "app/m/", "app/p/", "app/lv/",
    "lib/evaluation/links.ts", "lib/surveys/", "lib/first/registry.ts", "lib/grad/registry.ts",
)
def is_learner(rel): return any(rel.startswith(p) for p in LEARNER_PATHS)
def is_miaar(rel): return "miaar" in rel or "LevelExitQr" in rel or "ServiceInviteModal" in rel

# ── rules ──────────────────────────────────────────────────────────────
# (id, scope_fn, regex, repl, keep_if_regex, note)
RULES = []
def rule(id, rx, repl, scope=None, keep=None, note=""):
    RULES.append(dict(id=id, rx=rx if isinstance(rx, re.Pattern) else re.compile(rx),
                      repl=repl, scope=scope, keep=re.compile(keep) if keep else None, note=note))

# 1) الميسّر — شاشات المتعلّم فقط + «مدرّبك/مدرّبه» أينما وقعت (خطاب للمتعلّم)
_trx, _trep = morph("م[ُ]?د[َ]?رّ?[َ]?ب", "ميسّر")
rule("trainer-learner", _trx, _trep, scope=is_learner,
     keep=r"للمدرّبين والطاقم|لوحة المدرّب|سجلّ المدرّب|مكتب المدرّب|صفحة المدرّب|صباح المدرّب|بطاقة مدرّب",
     note="الميسّر في شاشات المتعلّم")
rule("trainer-yours", re.compile(f"{NB}(?P<pre>ال|لل|بال|وال|)م[ُ]?د[َ]?رّ?[َ]?ب(?P<suf>ك|كم|ه|ها|تك|تكم|ته|تها){NA}"),
     lambda m: m.group("pre") + "ميسّر" + m.group("suf"), note="«مدرّبك» خطاب للمتعلّم → «ميسّرك»")
rule("trainer-shadda", re.compile(f"{NB}{PRE}مدرب{SUF}{NA}"),
     lambda m: m.group("pre") + "مدرّب" + m.group("suf"), note="توحيد رسم «المدرّب» بالشدّة في شاشات الطاقم")
rule("facilitator-shadda", re.compile(f"{NB}{PRE}(?:ميسر|مُيسّر|مُيسِّر){SUF}{NA}"),
     lambda m: m.group("pre") + "ميسّر" + m.group("suf"), note="الميسّر بالشدّة")

# 2) المشارك (البرامج التدريبية) / الطالب (البرامج التعليمية: اقْرَأْ · مِعيار · مِران · الدبلومات · المقرّرات)
EDU_PATHS = ("app/iqra/", "app/miaar/", "app/admin/miaar/", "app/api/miaar/", "app/api/admin/miaar/", "app/api/admin/iqra/",
             "app/me/diploma", "lib/iqra/", "lib/miaar/", "lib/ai/", "lib/hour/", "lib/diploma/", "app/admin/hour", "app/admin/diploma",
             "app/sim/", "lib/portal/sim.ts", "lib/surveys/remoteLearning.ts", "app/survey/remote-learning", "app/reports/remote-survey",
             "app/components/Reports.tsx", "lib/reports/registry.ts", "app/components/ServiceInviteModal.tsx", "app/components/LevelExitQr.tsx")
TALIB_SKIP = ("directory", "accreditation", "daily-case", "rehearsal", "Rehearsal", "onair", "OnAir", "impact/generate", "impact/analytics",
              "portal/home.ts", "portal/lexicon.ts", "portal/roles.ts", "portal/search.ts", "lib/vault", "portal/missions", "tests/")
def is_edu(rel): return any(rel.startswith(p) for p in EDU_PATHS)
def _learner_repl(m):
    pre, suf = m.group("pre"), m.group("suf")
    if is_edu(_learner_repl.rel):
        if suf in ("ين", "ون", "و", "ي"): return pre + "طلاب"
        if suf[:1] in ("و", "ي") and len(suf) > 1: return pre + "طلاب" + suf[1:]
        return pre + "طالب" + suf
    return pre + "مشارك" + suf
_learner_repl.rel = ""
rule("learner-portal", r"بوابة المتدرب|بوّابة المتدرب|بوابة المتدرّب|بوّابة المتدرّب", "بوّابة المتعلّم", note="اسم البوّابة الشخصية")
rule("learner-mutadarrib", _lrx := re.compile(f"{NB}{PRE}(?:م[ُ]?ت[َ]?د[َ]?رّ?[َ]?ب){SUF}{NA}"), _learner_repl,
     keep=r"'student'|'trainee'|أو مشارك", note="المتدرّب → المشارك (تدريبي) / الطالب (تعليمي)")
rule("learner-no-shadda", re.compile(f"{NB}{PRE}(?:متعلم|مُتعلِّم|مُتعلّم){SUF}{NA}"),
     lambda m: m.group("pre") + "متعلّم" + m.group("suf"), note="المتعلم → المتعلّم (مظلّة عامّة)")
rule("learner-talib", re.compile(f"{NB}{PRE}طالب(?P<suf>ة|ات|){NA}"),
     lambda m: m.group("pre") + "مشارك" + m.group("suf"), scope=lambda rel: not is_edu(rel) and not any(x in rel for x in TALIB_SKIP),
     keep=r"الجهة الطالبة|الجهات الطالبة|طالب(ة|ات)? (الخدمة|العضوية|التسجيل|الاستشارة)|\|طالب\||مُطالب", note="الطالب (في التدريب) → المشارك")
rule("learner-tullab", re.compile(f"{NB}{PRE}(?:طلاب|طلبة)(?P<suf>ك|كم|نا|ه|ها|هم|){NA}"),
     lambda m: m.group("pre") + "مشاركي" + ("ن" if not m.group("suf") else "") + m.group("suf"),
     scope=lambda rel: not is_edu(rel) and not any(x in rel for x in TALIB_SKIP), keep=r"عن بُعد|عن بعد|مِران|Teams", note="الطلاب (في التدريب) → المشاركين (راجع حالة الرفع)")

# 3) الشعبة / القاعة
rule("group-phrase", r"القاعات / المجموعات|القاعات والمجموعات|القاعات/المجموعات|المجموعات / القاعات", "الشُّعب")
rule("group-phrase", r"القاعة / المجموعة|المجموعة / القاعة|القاعة/المجموعة|المجموعة/القاعة|الشعبة / القاعة|المجموعة/الشعبة|الشعبة \(القاعة\)|القاعة الدراسية", "الشعبة")
rule("group-phrase", r"قاعة / مجموعة|قاعة/مجموعة|مجموعة/قاعة|مجموعة / قاعة", "شعبة")
rule("group-majmua", re.compile(f"{NB}(?:QR المجموعة|اسم المجموعة|لوحة المجموعة|روابط المجموعات|عدد المجموعات|لا توجد مجموعات مسجلة|متوسط المجموعة|نسبة المجموعة|وسم المجموعة){NA}"),
     lambda m: m.group(0).replace("المجموعات", "الشُّعب").replace("مجموعات", "شُعب").replace("المجموعة", "الشعبة"),
     note="المجموعة (بمعنى الشعبة) → الشعبة")
KEEP_ROOM = (r"المجلس|مجلسه|الشاهد|بمراقب|شاهِد|المراقب|الاجتماعات|الملك فهد|باب القاعة|الفيزيائية|المشتركة|داخل القاعة|"
             r"في القاعة\)|رابط القاعة|رمز القاعة|المكان|فرع |Teams|قاعة [0-9]|تجهيز القاعة|يجهّز القاعة|قاعة الشرق|قاعة التدريب|قاعة تدريب|قاعة أو موعد|القاعة الفيزيائية|"
             r"شاشة القاعة|مقاعد القاعة|التجهيزات|تجهيز|التكييف|ضيقة|القاعة مناسبة|الشبكة|صمت في القاعة|خارج القاعة|تُبنَ له|قاعة أَثَر|لا في القاعة|زرتَ قاعة|"
             r"تعذّر فتح القاعة|نفتح القاعة|القاعات الدراسية|الفصول الافتراضية|slot\.room_ar|كل شعبة قاعة|القاعة / الموعد|قاعة في برنامج|الشُّعب والقاعات")
def _room_repl(m):
    pre, w, suf = m.group("pre"), m.group("w"), m.group("suf")
    if w == "قاعة": new = "شعبة"
    else: new = "شُعب"
    if pre == "ال" and new == "شُعب": return "الشُّعب" + suf
    return pre + new + suf
rule("group-room", re.compile(f"{NB}{PRE}(?P<w>قاعة|قاعات)(?P<suf>ك|كم|نا|ه|ها|هم|){NA}"), _room_repl,
     scope=lambda rel: not is_miaar(rel) and "daily-case" not in rel, keep=KEEP_ROOM, note="القاعة (المجموعة المسجّلة) → الشعبة")

# 4) الجلسة
rule("session-hissa", r"الحصة التدريبية|الحصص التدريبية|حصة تدريبية",
     lambda m: {"الحصة التدريبية": "الجلسة التدريبية", "الحصص التدريبية": "الجلسات التدريبية", "حصة تدريبية": "جلسة تدريبية"}[m.group(0)],
     note="الحصة التدريبية → الجلسة التدريبية")
rule("session-liqa", r"لقاء تدريبي", "جلسة تدريبية", note="لقاء تدريبي → جلسة تدريبية")
rule("session-hissa2", r"بعد كل حصة", "بعد كل جلسة")

# 5) الاستبيان
rule("survey-istitlaa", re.compile(f"{NB}{PRE}(?:استطلاع|إستطلاع)(?P<suf>ات|)(?P<tail> رأي| الرأي|){NA}"),
     lambda m: m.group("pre") + "استبيان" + m.group("suf") + m.group("tail"), keep=r"15 ث|polling|كل 15",
     note="الاستطلاع → الاستبيان")
rule("survey-istibana", re.compile(f"{NB}{PRE}استبان(?P<suf>ة|ات){NA}"),
     lambda m: m.group("pre") + "استبيان" + ("" if m.group("suf") == "ة" else "ات"), note="الاستبانة → الاستبيان")
rule("survey-dup", r"الاستبيان/الاستبيان", "الاستبيان")

# 6) التقييم (تقويم بمعنى التقييم فقط)
rule("eval-taqweem", r"منصة تقويم البرامج التدريبية|منصّة تقويم البرامج التدريبية", "بوّابة أَثَر")
rule("eval-taqweem", r"تقويم قائم على الأدلة", "تقييم قائم على الأدلة")
rule("eval-taqweem", r"تقويم البرامج وقياس", "تقييم البرامج وقياس")

# 7) البوّابة
NOT_SEO = lambda rel: rel not in ("app/layout.tsx", "tests/domain.test.ts")
rule("portal-brand", r"منصة أَثَر|منصّة أَثَر|منصة أثر|منصّة أثر|بوابة الأثر|بوابة أثر|بوّابة أثر|بوابة أَثَر", "بوّابة أَثَر", scope=NOT_SEO)
rule("portal-brand", r"منصة الجودة والتقييم|منصة تقييم التدريب", "بوّابة أَثَر")
rule("portal-gate", re.compile(f"{NB}(?P<pre>ال|لل|بال|وال|)بوابة{NA}"), lambda m: m.group("pre") + "بوّابة", scope=NOT_SEO, note="البوابة → البوّابة")
rule("portal-minassa", re.compile(f"{NB}(?P<pre>ال|لل|بال|وال)منص(?:ة|ّة){NA}"), lambda m: m.group("pre") + "بوّابة",
     keep=r"منصة أخرى|منصّة أخرى|غير معروفة|منصة الهيئة|مجانية|<select|lv-prov|الافتراضية|الوطنية|المنصّة · الرابط|Teams|Zoom|prov", note="المنصة → البوّابة")
rule("portal-admin", r"مدير المنصة|مدير المنصّة|مديري المنصة|مديري المنصّة|لمديري المنصة", lambda m: m.group(0).replace("المنصّة", "البوّابة").replace("المنصة", "البوّابة"))

# 7b) الجهة بدل العميل (الاستشارات والمدفوعات فقط؛ عميل OAuth/Supabase تقني يبقى)
CLIENT_SCOPE = lambda rel: ("consulting" in rel or "payments" in rel) and "api/" not in rel or rel.startswith("app/api/consulting")
rule("client-agree", r"اعتذر العميل", "اعتذرت الجهة", scope=CLIENT_SCOPE)
rule("client-agree", r"أغلق العميل", "أغلقت الجهة", scope=CLIENT_SCOPE)
rule("client-agree", r"رد العميل", "ردّ الجهة", scope=CLIENT_SCOPE)
rule("client", re.compile(f"{NB}(?P<pre>ال|لل|بال|وال)عميل{NA}"), lambda m: m.group("pre") + "جهة", scope=CLIENT_SCOPE,
     keep=r"OAuth|CIMD|Supabase|client|MCP|المتصفح", note="العميل → الجهة")

# 8) تشكيل العلامة
rule("brand-iqra", r"في اقرأ(?![أ-ي])", "في اقْرَأْ")

# 9) أفعال الأزرار — فقط حين يكون النصّ كلّه هو الزرّ
BTN = r"(?P<q>[>'\"`])\s*(?P<v>احفظ|أرسل|اعتمد)(?P<rest>(?: (?:الآن|التغييرات|المسوّدة|الكل|النتيجة|الرد|الردّ|الطلب|الإجابات))?)\s*(?=[<'\"`])"
rule("button-verbs", re.compile(BTN),
     lambda m: m.group("q") + {"احفظ": "حفظ", "أرسل": "إرسال", "اعتمد": "اعتماد"}[m.group("v")] + m.group("rest"),
     note="احفظ/أرسل/اعتمد → حفظ/إرسال/اعتماد (أزرار فقط)")

# ── sentinel lines (skip + report) ─────────────────────────────────────
RISKY = re.compile(r"\.test\(|\.match\(|new RegExp\(|\.replace\(/|\.eq\(|\.in\(|\.ilike\(|\.like\(|\.neq\(|=== ?['\"`][^'\"`]*[" + AR + r"]|case ['\"`][^'\"`]*[" + AR + r"]")

def files():
    for d in DIRS:
        for p in sorted((ROOT / d).rglob("*")):
            if p.suffix in EXT and p.is_file() and str(p) not in SELF and "node_modules" not in p.parts:
                yield p

def run(apply=False, only=None, verbose=False):
    stats, skipped, touched = {}, [], {}
    for p in files():
        rel = p.relative_to(ROOT).as_posix()
        _learner_repl.rel = rel
        src = p.read_text(encoding="utf-8")
        lines = src.split("\n")
        out = []
        changed = False
        for ln, line in enumerate(lines, 1):
            new = line
            for R in RULES:
                if only and R["id"] != only: continue
                if R["scope"] and not R["scope"](rel): continue
                if R["keep"] and R["keep"].search(new): continue
                if not R["rx"].search(new): continue
                if RISKY.search(new) and not rel.startswith("tests/"):
                    skipped.append((rel, ln, R["id"], new.strip()[:110]))
                    continue
                cand, n = R["rx"].subn(R["repl"], new)
                if n:
                    stats.setdefault(R["id"], [0, set()])
                    stats[R["id"]][0] += n; stats[R["id"]][1].add(rel)
                    if verbose: print(f"  {R['id']:18} {rel}:{ln}  {new.strip()[:70]}  →  {cand.strip()[:70]}")
                    new = cand
            if new != line:
                changed = True
                touched.setdefault(rel, []).append((ln, line.strip()[:90], new.strip()[:90]))
            out.append(new)
        if changed and apply:
            p.write_text("\n".join(out), encoding="utf-8")
    return stats, skipped, touched

if __name__ == "__main__":
    args = sys.argv[1:]
    apply = "--apply" in args
    only = args[args.index("--rule") + 1] if "--rule" in args else None
    verbose = "--verbose" in args
    stats, skipped, touched = run(apply, only, verbose)
    print("── القواعد ──")
    tot = 0
    for k, (n, fs) in sorted(stats.items(), key=lambda x: -x[1][0]):
        print(f"{k:20} {n:5} موضعًا في {len(fs):3} ملفًا"); tot += n
    print(f"المجموع: {tot} موضعًا في {len(touched)} ملفًا")
    if skipped:
        print(f"\n── سطور حسّاسة تُركت للفرز اليدوي ({len(skipped)}) ──")
        for s in skipped: print(f"  {s[0]}:{s[1]} [{s[2]}] {s[3]}")
    if "--dump" in args:
        Path("/tmp/lexsweep-plan.json").write_text(json.dumps(touched, ensure_ascii=False, indent=1), encoding="utf-8")
        print("\nكُتبت الخطّة الكاملة في /tmp/lexsweep-plan.json")
    print("\n" + ("✍️  طُبّق" if apply else "👁  معاينة فقط (--apply للتنفيذ)"))
