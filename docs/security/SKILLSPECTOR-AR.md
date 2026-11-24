# فحص أمان مهارات الوكلاء (NVIDIA SkillSpector) — 2026-11-24

> **لماذا:** مهارات `.agents/skills/*` هي تعليمات يقرؤها الوكيل ويعمل بها على كود أَثَر وقاعدة بياناته؛ أيّ حقن أو تعليمة خفيّة فيها خطرٌ على الإنتاج. المالك أشار إلى الأداة (2026-11-24) فاعتُمدت كخطوة قياسيّة.
> **الأداة:** SkillSpector v2.13.7 — فحص ثابت (أنماط + YARA) بلا نموذج لغويّ (`--no-llm`)، من المصدر داخل venv مؤقّت (لا تُضاف إلى المستودع).

## النتيجة الإجماليّة
| المهارة | الدرجة | الخطورة | أعلى مسألة | مسائل | اكتمال الفحص |
|---|---|---|---|---|---|
| `athar-dialogue` | 7 | LOW | MEDIUM | 1 | complete_with_caveats |
| `athar-feature` | 0 | LOW | NONE | 0 | partial |
| `athar-iqra` | 39 | MEDIUM | HIGH | 3 | partial |
| `athar-product` | 0 | LOW | NONE | 0 | complete_with_caveats |
| `athar-qa` | 43 | MEDIUM | HIGH | 7 | complete_with_caveats |
| `athar-release` | 10 | LOW | MEDIUM | 2 | complete_with_caveats |
| `athar-sql` | 0 | LOW | NONE | 0 | complete_with_caveats |
| `athar-ui` | 16 | LOW | HIGH | 1 | complete_with_caveats |

- لا سكربتات تنفيذيّة داخل أيّ مهارة (نصوص إرشاديّة فقط).
- **14 مسألة، كلّها إيجابيّات كاذبة بعد المراجعة اليدويّة** — جدولها أدناه — **ما عدا واحدة حقيقيّة أُصلحت**: frontmatter مهارة `athar-iqra` كان YAML غير صالح (الوصف يحوي «: » بلا اقتباس) فكان الماسح — وأيّ وكيل يقرأ الـ manifest — يفشل في تحليله.
- **حدّ معروف للأداة:** الطبقة الحتميّة تعدّ العربيّة الكثيفة «نصًّا مُعمًّى» (`obfuscated_instruction_text`) فتخفّض الاكتمال إلى `partial`. لا علاج سوى طبقة LLM (معطَّلة هنا عمدًا لعدم إرسال محتوى المستودع لمزوّد خارجيّ).

## تفصيل المسائل وحكمها
| المهارة | الخطورة | التصنيف | السطر | الحكم |
|---|---|---|---|---|
| `athar-dialogue` | MEDIUM | Excessive Agency | 192 | سطر عن اختبارات/بذور وهميّة — «Excessive Agency» بسبب كلمات مثل placed/unplaced. إيجابيّ كاذب. |
| `athar-iqra` | HIGH | analysis-evasion | 47 | «analysis-evasion / obfuscated text» = الماسح لا يقرأ العربيّة الكثيفة فيعدّها تعمية. إيجابيّ كاذب بنيويّ. **ما كان حقيقيًا وأُصلح:** وصف الـ frontmatter في `athar-iqra` كان YAML غير صالح (نقطتان داخل النصّ) → وُضع بين علامتي اقتباس. |
| `athar-iqra` | MEDIUM | MCP Rug Pull | 105 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-iqra` | MEDIUM | Privilege Escalation | 119 | ذكر أدوار/صلاحيّات (`org_admin`, `service role`) في شرح نموذج الأمان نفسه. إيجابيّ كاذب. |
| `athar-qa` | HIGH | Tool Misuse | 13 | أمر الإعداد `sudo -n python3 -m playwright install-deps` في بيئة اختبار مؤقّتة — ليس تصعيدًا في الإنتاج. مقبول، مع ملاحظة: `-n` يمنع أيّ طلب كلمة مرور. |
| `athar-qa` | MEDIUM | Privilege Escalation | 13 | أمر الإعداد `sudo -n python3 -m playwright install-deps` في بيئة اختبار مؤقّتة — ليس تصعيدًا في الإنتاج. مقبول، مع ملاحظة: `-n` يمنع أيّ طلب كلمة مرور. |
| `athar-qa` | MEDIUM | MCP Rug Pull | 17 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-qa` | MEDIUM | MCP Rug Pull | 18 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-qa` | MEDIUM | MCP Rug Pull | 19 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-qa` | MEDIUM | MCP Rug Pull | 20 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-qa` | MEDIUM | Data Exfiltration | 33 | `curl` إلى GitHub API لقراءة حالة النشر — قراءة علنيّة، لا تسريب. |
| `athar-release` | MEDIUM | MCP Rug Pull | 12 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-release` | MEDIUM | MCP Rug Pull | 21 | «MCP Rug Pull» يطلق على أيّ ذكر لأوامر تثبيت/تحديث (`npm install`, `pip install`, `git clone`) في خطوات الإعداد. إيجابيّ كاذب. |
| `athar-ui` | HIGH | Output Handling | 15 | نمط `dangerouslySetInnerHTML` لحقن CSS ثابت داخل الصفحة — نمط قائم في الكود (CSS حرفيّ لا مُدخَلات مستخدم). مقبول؛ يبقى قيدًا: لا يُستعمل أبدًا مع نصّ من المستخدم. |

## القاعدة المعتمدة (أُضيفت إلى AGENTS.md §2)
- أيّ مهارة/إضافة/خادم MCP من طرف ثالث **يُفحَص بـ SkillSpector قبل الاستخدام**، ويُرفق تقريره هنا. لا تُثبَّت مهارات خارجيّة داخل `.agents/skills/` أصلًا — تُقرأ وتُقتبس مبادئها فقط.
- إعادة الفحص عند كلّ تعديل على مهارة:
```bash
python3 -m venv /tmp/ss/.venv && . /tmp/ss/.venv/bin/activate && pip install -q git+https://github.com/NVIDIA/skillspector.git
for s in .agents/skills/*/; do skillspector scan "$s" --no-llm -f json -o "/tmp/ss-$(basename $s).json"; done
```
