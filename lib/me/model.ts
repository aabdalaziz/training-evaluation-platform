/**
 * بوابة المتدرب (/me) — الأنواع وبناء قائمة المهام ونسبة الحضور (بدون تبعيات)
 */
export type MeCertificate = { serial: string | null; verify_code: string | null; kind: string; issued_at: string; award_title?: string | null; hours?: number | null; program_name?: string | null; revoked: boolean };
export type MeProgram = {
  id: string; name_ar: string; name_en?: string | null; status: string | null; start_date: string | null; end_date: string | null; is_final_open: boolean; delivery_mode?: string | null;
  attendance: { sessions: number; present: number; late: number; excused: number };
  open_sessions: { token: string; title: string | null; session_date: string; checked: boolean }[];
  evals: { daily: number; final: number; last_at: string | null };
  impact: { token: string; title_ar: string; pre_open: boolean; post_open: boolean }[];
  followups: { token: string; title_ar: string; answered: boolean }[];
  certificates: MeCertificate[];
};
export type MePortal = { ok: boolean; error?: string; email: string; name: string; programs: MeProgram[]; other_certificates: MeCertificate[]; today: string };

export type Task = { id: string; program_id: string; program_name: string; kind: 'attend' | 'daily' | 'final' | 'impact_pre' | 'impact_post' | 'followup'; title: string; hint: string; href: string; urgent: boolean; done?: boolean };

export const STATUS_AR: Record<string, string> = { ACTIVE: 'نشط', DRAFT: 'قريبًا', COMPLETED: 'مكتمل', CANCELLED: 'ملغى', PENDING_REVIEW: 'قيد الاعتماد' };

/** نسبة الحضور = (حاضر + متأخر) ÷ (الجلسات المنعقدة − المعتذر عنها) */
export function attendancePct(a: MeProgram['attendance'] | null | undefined): number | null {
  if (!a || !a.sessions) return null;
  const denom = Math.max(0, a.sessions - (a.excused || 0));
  if (!denom) return null;
  return Math.max(0, Math.min(100, Math.round((100 * ((a.present || 0) + (a.late || 0))) / denom)));
}
export function attendanceTone(pct: number | null): 'ok' | 'warn' | 'bad' | 'none' {
  if (pct == null) return 'none';
  return pct >= 80 ? 'ok' : pct >= 60 ? 'warn' : 'bad';
}

/** هل البرنامج جارٍ اليوم؟ */
export function isRunning(p: Pick<MeProgram, 'start_date' | 'end_date' | 'status'>, today: string): boolean {
  if (String(p.status || '').toUpperCase() === 'CANCELLED') return false;
  if (p.start_date && p.start_date > today) return false;
  if (p.end_date && p.end_date < today) return false;
  return true;
}

/** المهام المطلوبة من المتدرب الآن (مرتبة: العاجل أولًا) */
export function buildTasks(me: Pick<MePortal, 'programs' | 'today'>): Task[] {
  const out: Task[] = [];
  for (const p of me.programs) {
    const running = isRunning(p, me.today);
    for (const s of p.open_sessions || []) {
      if (s.checked) continue;
      out.push({ id: `attend:${s.token}`, program_id: p.id, program_name: p.name_ar, kind: 'attend', title: `سجّل حضورك: ${s.title || s.session_date}`, hint: 'جلسة مفتوحة الآن — يلزم تسجيل الحضور قبل إغلاقها', href: `/attend/${s.token}`, urgent: true });
    }
    for (const a of p.impact || []) {
      if (a.pre_open && running) out.push({ id: `impact_pre:${a.token}`, program_id: p.id, program_name: p.name_ar, kind: 'impact_pre', title: `القياس القبلي: ${a.title_ar}`, hint: 'يُعبّأ مرة واحدة في بداية البرنامج', href: `/impact/${a.token}?phase=pre`, urgent: false });
      if (a.post_open) out.push({ id: `impact_post:${a.token}`, program_id: p.id, program_name: p.name_ar, kind: 'impact_post', title: `القياس البعدي: ${a.title_ar}`, hint: 'يُعبّأ بعد ختام البرنامج لقياس الكسب', href: `/impact/${a.token}?phase=post`, urgent: true });
    }
    if (running) {
      const todayDone = p.evals?.last_at ? String(p.evals.last_at).slice(0, 10) === me.today : false;
      if (!todayDone) out.push({ id: `daily:${p.id}`, program_id: p.id, program_name: p.name_ar, kind: 'daily', title: 'التقييم اليومي', hint: 'رأيك في جلسة اليوم يساعد المدرب على التحسين', href: `/evaluate/daily?program=${p.id}`, urgent: false });
    }
    if (p.is_final_open && !(p.evals?.final > 0)) out.push({ id: `final:${p.id}`, program_id: p.id, program_name: p.name_ar, kind: 'final', title: 'التقييم النهائي للبرنامج', hint: 'مفتوح الآن — مطلوب لإصدار الشهادة', href: `/evaluate/final?program=${p.id}`, urgent: true });
    for (const f of p.followups || []) {
      if (!f.answered) out.push({ id: `followup:${f.token}`, program_id: p.id, program_name: p.name_ar, kind: 'followup', title: `متابعة أثر التدريب: ${f.title_ar}`, hint: 'تقييم ذاتي قصير: ماذا طبّقت فعلًا في عملك؟', href: `/followup/${f.token}?role=trainee`, urgent: true });
    }
  }
  return out.sort((a, b) => Number(b.urgent) - Number(a.urgent));
}

export const CERT_KIND_AR: Record<string, string> = { completion: 'شهادة إتمام', attendance: 'شهادة حضور', appreciation: 'شهادة شكر وتقدير' };
