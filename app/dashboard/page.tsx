'use client';
/**
 * /dashboard — Executive dashboard (real data).
 * Every number on this page is computed from the live evaluation data through
 * lib/reports/analytics.ts — the same engine used by the Reports Center — so the
 * dashboard, the reports and the exports always agree.
 */
import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase/client';
import { REPORTS, REPORT_GROUPS } from '../../lib/reports/catalog';
import { Icon, type IconName } from '../../lib/ui/icons';
import {
  TARGET, THRESHOLDS, PERF_LABEL, RISK_LABEL, addDays, applyFilters, buildEvaluations, buildFacts, groupBy, kpis as computeKpis,
  labelFor, periodComparison, riskRegister, riyadhDate, timeSeries,
  type Action, type Evaluation, type Fact, type GroupRow, type Kpis, type Lookups,
} from '../../lib/reports/analytics';

/* ============================================================ types */
type Profile = { full_name: string; role: string; organization_id: string; phone: string | null };
type Program = {
  id: string; name_ar: string; name_en: string | null; description_ar?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'; start_date: string | null; end_date: string | null; created_at: string;
  delivery_mode: 'onsite' | 'remote' | null;
  intro_ar?: string | null; intro_en?: string | null; objectives_ar?: string | null; objectives_en?: string | null; outcomes_ar?: string | null; outcomes_en?: string | null; audience_ar?: string | null; audience_en?: string | null;
  approval_status?: ApprovalStatus | null; approval_note?: string | null; rejection_reason?: string | null;
  submitted_at?: string | null; reviewed_at?: string | null; approved_at?: string | null;
};
type ApprovalStatus = 'DRAFT' | 'PENDING_REVIEW' | 'REVIEWED' | 'APPROVED' | 'REJECTED';
type ApprovalLog = { id: string; program_id: string; from_status: string | null; to_status: ApprovalStatus; actor_name: string | null; actor_role: string | null; comment: string | null; created_at: string };
type Classroom = { id: string; code: string; program_id: string | null; trainer_id: string | null; delivery_mode: string | null; level_id?: string | null; level?: string | null };
type Trainer = { id: string; name: string };
type View = 'overview' | 'programs' | 'evaluations' | 'reports' | 'settings';
type FormState = { name_ar: string; name_en: string; description_ar: string; start_date: string; end_date: string; delivery_mode: 'onsite' | 'remote'; intro_ar: string; intro_en: string; objectives_ar: string; objectives_en: string; outcomes_ar: string; outcomes_en: string; audience_ar: string; audience_en: string };
type Range = '7d' | '14d' | '30d' | 'all';

const NAVY = '#0f2a4e', TEAL = '#0b8a83', GOLD = '#C9A24B';
const PROFILE_KEYS = ['intro_ar', 'intro_en', 'objectives_ar', 'objectives_en', 'outcomes_ar', 'outcomes_en', 'audience_ar', 'audience_en'] as const;
const emptyForm: FormState = { name_ar: '', name_en: '', description_ar: '', start_date: '', end_date: '', delivery_mode: 'onsite', intro_ar: '', intro_en: '', objectives_ar: '', objectives_en: '', outcomes_ar: '', outcomes_en: '', audience_ar: '', audience_en: '' };
const STATUS_STYLE: Record<Program['status'], { bg: string; color: string; label: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#475569', label: 'مسودة' }, ACTIVE: { bg: '#d1fae5', color: '#047857', label: 'نشط' },
  COMPLETED: { bg: '#dbeafe', color: '#1d4ed8', label: 'مكتمل' }, CANCELLED: { bg: '#fee2e2', color: '#b91c1c', label: 'ملغى' },
};
const APPROVAL_STYLE: Record<ApprovalStatus, { bg: string; color: string; label: string; hint: string }> = {
  DRAFT: { bg: '#f1f5f9', color: '#475569', label: 'لم يُرسل', hint: 'البرنامج مسودة ولم يُرسل للمراجعة بعد' },
  PENDING_REVIEW: { bg: '#fff7e6', color: '#b45309', label: 'بانتظار المراجعة', hint: 'أُرسل من مدير البرامج وينتظر المراجعة' },
  REVIEWED: { bg: '#eef4ff', color: '#1d4ed8', label: 'تمت المراجعة', hint: 'روجع وينتظر اعتماد محلل الجودة / مدير المنصة' },
  APPROVED: { bg: '#eafaf0', color: '#15803d', label: 'معتمد', hint: 'معتمد — يمكن تفعيله' },
  REJECTED: { bg: '#fef2f2', color: '#b91c1c', label: 'مرفوض', hint: 'رُفض — راجع السبب وعدّل ثم أعد الإرسال' },
};
const APPROVER_ROLES = ['PLATFORM_ADMIN', 'SUPER_ADMIN', 'ADMIN', 'QUALITY_ANALYST'];
const SUBMITTER_ROLES = [...APPROVER_ROLES, 'PROGRAM_MANAGER'];
const ROLE_LABEL: Record<string, string> = { PLATFORM_ADMIN: 'مدير المنصة', SUPER_ADMIN: 'مدير عام', ADMIN: 'مدير', PROGRAM_MANAGER: 'مدير برامج', QUALITY_ANALYST: 'محلل جودة', MANAGER: 'مدير برامج', TRAINER: 'مدرب', USER: 'مستخدم' };

/* الأيقونات: من المكتبة الموحّدة lib/ui/icons */
const REPORT_ICON: Record<string, IconName> = { trainer_card: 'star', executive: 'shield', trainers: 'users', programs: 'book', classrooms: 'school', axes: 'compass', questions: 'question', trend: 'trend', comparison: 'scale', participation: 'users', qualitative: 'chat', actions: 'target', raw: 'folder' };

/* ============================================================ page */
export default function Dashboard() {
  const db = useMemo(() => supabase(), []);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [raw, setRaw] = useState<{ evaluations: any[]; answers: any[]; questions: any[]; classrooms: Classroom[]; trainers: Trainer[]; schedules: any[]; remoteResponses: number } | null>(null);
  const [view, setView] = useState<View>('overview');
  const [range, setRange] = useState<Range>('7d');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Program | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const notify = (s: string) => { setNotice(s); setTimeout(() => setNotice(''), 4000); };

  async function load() {
    setLoading(true);
    const { data: { user } } = await db.auth.getUser();
    if (!user) { router.replace('/login'); return; }
    try {
      const v = new URLSearchParams(window.location.search).get('view') as View | null;
      if (v && ['overview', 'programs', 'evaluations', 'reports', 'settings'].includes(v)) setView(v);
    } catch { /* ignore */ }
    const [p, pr, ev, an, qs, cl, tr, sc, rr] = await Promise.all([
      db.from('profiles').select('full_name,role,organization_id,phone').eq('id', user.id).single(),
      db.from('programs').select('*').order('created_at', { ascending: false }),
      db.from('evaluations').select('*').order('submitted_at', { ascending: false }),
      db.from('evaluation_answers').select('*'),
      db.from('questions').select('*'),
      db.from('classrooms').select('*'),
      db.from('trainers').select('*'),
      db.from('class_schedules').select('id,classroom_id,is_active'),
      db.from('remote_learning_survey_responses').select('id', { count: 'exact', head: true }),
    ]);
    const failed = [p, pr, ev, an, qs, cl, tr].map(r => r.error?.message).filter(Boolean) as string[];
    setLoadError(failed.length ? Array.from(new Set(failed)).join(' | ') : null);
    setProfile(p.data as Profile);
    setPrograms((pr.data || []) as Program[]);
    setRaw({ evaluations: ev.data || [], answers: an.data || [], questions: qs.data || [], classrooms: (cl.data || []) as Classroom[], trainers: (tr.data || []) as Trainer[], schedules: sc.data || [], remoteResponses: rr.count || 0 });
    setLastRefresh(new Date());
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function logout() { await db.auth.signOut(); router.replace('/'); }

  /* ---------- programs CRUD (unchanged behaviour) ---------- */
  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(p: Program) { setEditing(p); setForm({ name_ar: p.name_ar || '', name_en: p.name_en || '', description_ar: p.description_ar || '', start_date: p.start_date || '', end_date: p.end_date || '', delivery_mode: p.delivery_mode || 'onsite', ...Object.fromEntries(PROFILE_KEYS.map(k => [k, String((p as any)[k] || '')])) as Record<(typeof PROFILE_KEYS)[number], string> }); setShowForm(true); }
  function closeForm() { setShowForm(false); setEditing(null); setForm(emptyForm); }
  async function saveProgram(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile) return;
    if (!form.name_ar.trim()) { notify('اسم البرنامج بالعربية مطلوب.'); return; }
    setSaving(true);
    const payload = { name_ar: form.name_ar.trim(), name_en: form.name_en.trim() || null, description_ar: form.description_ar.trim() || null, start_date: form.start_date || null, end_date: form.end_date || null, delivery_mode: form.delivery_mode, ...Object.fromEntries(PROFILE_KEYS.map(k => [k, form[k].trim() || null])) };
    const res = editing ? await db.from('programs').update(payload).eq('id', editing.id) : await db.from('programs').insert({ organization_id: profile.organization_id, status: 'DRAFT', ...payload });
    setSaving(false);
    if (res.error) { notify('تعذر الحفظ: ' + res.error.message); return; }
    notify(editing ? '✓ تم تحديث البرنامج' : '✓ تمت إضافة البرنامج كمسودة'); closeForm(); load();
  }
  async function setStatus(id: string, status: Program['status']) {
    const { error } = await db.from('programs').update({ status }).eq('id', id);
    if (error) { notify('تعذر تحديث الحالة: ' + error.message); return; }
    notify('✓ تم تحديث حالة البرنامج'); load();
  }
  /* ---------- approval workflow ---------- */
  const roleU = String(profile?.role || '').toUpperCase();
  const canApprove = APPROVER_ROLES.includes(roleU);
  const canSubmit = SUBMITTER_ROLES.includes(roleU);
  const [apModal, setApModal] = useState<{ program: Program; to: ApprovalStatus; note: string; busy: boolean } | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<ApprovalLog[]>([]);
  const AP_ACTION: Record<ApprovalStatus, { title: string; cta: string; needNote: boolean; help: string }> = {
    PENDING_REVIEW: { title: 'إرسال البرنامج للمراجعة', cta: 'إرسال للمراجعة', needNote: false, help: 'سيظهر البرنامج في قائمة انتظار المراجعة لدى مدير البرامج ومحلل الجودة.' },
    REVIEWED: { title: 'تأكيد مراجعة البرنامج', cta: 'تمت المراجعة', needNote: false, help: 'تؤكد أن المحتوى والأهداف والجدول روجعت وهي جاهزة للاعتماد.' },
    APPROVED: { title: 'اعتماد البرنامج', cta: 'اعتماد', needNote: false, help: 'بعد الاعتماد يمكن تفعيل البرنامج وفتح التقييمات عليه. يُسجَّل اسمك ووقت الاعتماد.' },
    REJECTED: { title: 'رفض البرنامج', cta: 'رفض', needNote: true, help: 'سبب الرفض إلزامي ويُرسل لمدير البرامج ليعدّل ويعيد الإرسال.' },
    DRAFT: { title: 'إعادة البرنامج إلى مسودة', cta: 'إعادة لمسودة', needNote: false, help: 'يلغي الاعتماد الحالي ويعيد البرنامج إلى بداية الدورة.' },
  };
  function openApproval(program: Program, to: ApprovalStatus) { setApModal({ program, to, note: '', busy: false }); }
  async function applyApproval() {
    if (!apModal) return;
    const { program, to, note } = apModal;
    if (AP_ACTION[to].needNote && !note.trim()) { notify('سبب الرفض مطلوب.'); return; }
    setApModal(m => m && { ...m, busy: true });
    const payload: Record<string, unknown> = { approval_status: to, approval_note: note.trim() || null };
    if (to === 'REJECTED') payload.rejection_reason = note.trim();
    const { error } = await db.from('programs').update(payload).eq('id', program.id);
    if (error) { setApModal(m => m && { ...m, busy: false }); notify('تعذر تنفيذ الإجراء: ' + error.message); return; }
    setApModal(null); notify(`✓ ${AP_ACTION[to].cta}: ${program.name_ar}`); load();
    if (historyFor === program.id) loadHistory(program.id);
  }
  async function loadHistory(programId: string) {
    if (historyFor === programId) { setHistoryFor(null); return; }
    const { data } = await db.from('program_approvals').select('*').eq('program_id', programId).order('created_at', { ascending: false });
    setHistory((data || []) as ApprovalLog[]); setHistoryFor(programId);
  }
  const pendingMine = programs.filter(p => (canApprove && ['PENDING_REVIEW', 'REVIEWED'].includes(p.approval_status || 'DRAFT')) || (roleU === 'PROGRAM_MANAGER' && (p.approval_status || 'DRAFT') === 'REJECTED'));
  async function deleteProgram(p: Program) {
    if (!window.confirm(`حذف البرنامج "${p.name_ar}" نهائيًا؟\nإن كانت له تقييمات أو قاعات مرتبطة فقد يرفض النظام الحذف حفاظًا على البيانات.`)) return;
    const { error } = await db.from('programs').delete().eq('id', p.id);
    if (error) { notify('تعذر الحذف (قد تكون هناك بيانات مرتبطة): ' + error.message); return; }
    notify('✓ تم حذف البرنامج'); load();
  }
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const current = String(fd.get('current_password') || '');
    const next = String(fd.get('new_password') || '');
    const confirm = String(fd.get('confirm_password') || '');
    setPwMsg(null);
    if (next.length < 8) { setPwMsg({ ok: false, text: 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف.' }); return; }
    if (!/[A-Za-z]/.test(next) || !/[0-9]/.test(next)) { setPwMsg({ ok: false, text: 'يجب أن تحتوي كلمة المرور على حروف وأرقام معًا.' }); return; }
    if (next !== confirm) { setPwMsg({ ok: false, text: 'تأكيد كلمة المرور غير مطابق.' }); return; }
    if (next === current) { setPwMsg({ ok: false, text: 'كلمة المرور الجديدة مطابقة للحالية.' }); return; }
    setPwBusy(true);
    try {
      const email = (await db.auth.getUser()).data.user?.email;
      if (!email) throw new Error('تعذر تحديد حساب المستخدم.');
      // تحقق من كلمة المرور الحالية قبل التغيير
      const { error: verifyErr } = await db.auth.signInWithPassword({ email, password: current });
      if (verifyErr) throw new Error('كلمة المرور الحالية غير صحيحة.');
      const { error } = await db.auth.updateUser({ password: next });
      if (error) throw new Error(error.message);
      form.reset();
      setPwMsg({ ok: true, text: 'تم تغيير كلمة المرور بنجاح. استخدم الكلمة الجديدة في الدخول القادم.' });
      notify('✓ تم تغيير كلمة المرور');
    } catch (err: any) {
      setPwMsg({ ok: false, text: err?.message || 'تعذر تغيير كلمة المرور.' });
    } finally { setPwBusy(false); }
  }

  async function updateProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!profile) return;
    const fd = new FormData(e.currentTarget);
    const uid = (await db.auth.getUser()).data.user?.id;
    const { error } = await db.from('profiles').update({ full_name: String(fd.get('full_name')), phone: String(fd.get('phone') || '') || null }).eq('id', uid);
    if (error) { notify('تعذر الحفظ: ' + error.message); return; }
    notify('✓ تم حفظ الملف الشخصي'); load();
  }

  /* ---------- analytics (real data) ---------- */
  const lk: Lookups = useMemo(() => ({ classrooms: raw?.classrooms || [], trainers: raw?.trainers || [], programs, questions: raw?.questions || [] }), [raw, programs]);
  const allEvals: Evaluation[] = useMemo(() => raw ? buildEvaluations(raw.evaluations, raw.answers, lk) : [], [raw, lk]);
  const facts: Fact[] = useMemo(() => raw ? buildFacts(raw.answers, raw.questions) : [], [raw]);
  const today = riyadhDate(new Date().toISOString());
  const rangeDays = range === '7d' ? 7 : range === '14d' ? 14 : range === '30d' ? 30 : 0;
  const filters = useMemo(() => rangeDays ? { from: addDays(today, -(rangeDays - 1)), to: today } : {}, [rangeDays, today]);
  const evals = useMemo(() => applyFilters(allEvals, filters, lk), [allEvals, filters, lk]);
  const k: Kpis = useMemo(() => computeKpis(evals, facts), [evals, facts]);
  const kToday: Kpis = useMemo(() => computeKpis(applyFilters(allEvals, { from: today, to: today }, lk), facts), [allEvals, today, lk, facts]);
  const kAll: Kpis = useMemo(() => computeKpis(allEvals, facts), [allEvals, facts]);
  const cmp = useMemo(() => rangeDays ? periodComparison(allEvals, facts, filters, lk) : null, [rangeDays, allEvals, facts, filters, lk]);
  const axes = useMemo(() => groupBy('axis', evals, facts, lk, 'ar'), [evals, facts, lk]);
  const trainers = useMemo(() => groupBy('trainer', evals, facts, lk, 'ar').filter(r => r.key), [evals, facts, lk]);
  const rooms = useMemo(() => groupBy('classroom', evals, facts, lk, 'ar').filter(r => r.key), [evals, facts, lk]);
  const series = useMemo(() => timeSeries(applyFilters(allEvals, { from: addDays(today, -13), to: today }, lk), facts, 'day', lk, 'ar'), [allEvals, today, lk, facts]);
  const actions: Action[] = useMemo(() => riskRegister(evals, facts, lk, 'ar'), [evals, facts, lk]);
  const lastSubmit = allEvals.map(e => e.submitted_at || '').filter(Boolean).sort().pop();

  /* ---------- alerts (real) ---------- */
  const alerts = useMemo(() => {
    if (!raw) return [] as { level: 'red' | 'amber' | 'blue'; text: string; href?: string; cta?: string }[];
    const out: { level: 'red' | 'amber' | 'blue'; text: string; href?: string; cta?: string }[] = [];
    const activeIds = new Set(programs.filter(p => p.status === 'ACTIVE').map(p => p.id));
    const recent = applyFilters(allEvals, { from: addDays(today, -2), to: today }, lk);
    const recentRooms = new Set(recent.map(e => e.classroom_id));
    const silent = raw.classrooms.filter(c => c.program_id && activeIds.has(c.program_id) && !recentRooms.has(c.id));
    if (silent.length) out.push({ level: 'amber', text: `${silent.length} قاعة/مجموعة في برامج نشطة بلا أي استجابة خلال آخر 3 أيام: ${silent.slice(0, 4).map(c => c.code).join('، ')}${silent.length > 4 ? '…' : ''}`, href: '/reports/center?type=participation&preset=7d', cta: 'تقرير المشاركة' });
    for (const a of actions.filter(x => x.priority === 'HIGH').slice(0, 3)) out.push({ level: 'red', text: `${a.label}: متوسط ${a.mean.toFixed(2)}/5 و${a.lowPct.toFixed(0)}% تقييمات منخفضة (n=${a.responses})`, href: `/reports/center?type=${a.area === 'trainer' ? 'trainers' : a.area === 'classroom' ? 'classrooms' : a.area === 'program' ? 'programs' : 'axes'}&preset=${range === 'all' ? 'all' : range}`, cta: 'افتح التقرير' });
    const declining = trainers.filter(t => t.delta !== null && (t.delta as number) <= -0.3);
    if (declining.length) out.push({ level: 'amber', text: `اتجاه تنازلي لدى ${declining.map(t => `${t.label} (${(t.delta as number).toFixed(2)})`).join('، ')}`, href: `/reports/center?type=trainers&preset=${range === 'all' ? 'all' : range}`, cta: 'أداء المدربين' });
    const noTrainer = raw.classrooms.filter(c => !c.trainer_id && c.program_id && activeIds.has(c.program_id));
    if (noTrainer.length) out.push({ level: 'amber', text: `${noTrainer.length} قاعة بدون مدرب مرتبط (${noTrainer.slice(0, 3).map(c => c.code).join('، ')})`, href: '/admin/management?tab=rooms', cta: 'لوحة الإدارة' });
    const schedRooms = new Set(raw.schedules.filter(s => s.is_active !== false).map(s => s.classroom_id));
    const remoteIncomplete = raw.classrooms.filter(c => c.delivery_mode === 'remote' && (!(c.level_id || c.level) || !schedRooms.has(c.id)));
    if (remoteIncomplete.length) out.push({ level: 'amber', text: `${remoteIncomplete.length} مجموعة عن بُعد لن تظهر في الاستطلاع (بدون مستوى أو مواعيد)`, href: '/admin/management?tab=rooms', cta: 'أكمل البيانات' });
    const activeNoRooms = programs.filter(p => p.status === 'ACTIVE' && !raw.classrooms.some(c => c.program_id === p.id));
    if (activeNoRooms.length) out.push({ level: 'blue', text: `برامج نشطة بلا قاعات: ${activeNoRooms.map(p => p.name_ar).join('، ')}`, href: '/admin/management?tab=rooms', cta: 'أضف قاعة' });
    const drafts = programs.filter(p => p.status === 'DRAFT').length;
    if (drafts) out.push({ level: 'blue', text: `${drafts} برنامج في حالة مسودة بانتظار التفعيل`, cta: 'البرامج' });
    if (k.responses > 0 && k.responses < THRESHOLDS.minSample) out.push({ level: 'blue', text: `حجم العينة في الفترة المختارة صغير (${k.responses}) — القرارات تُبنى على مؤشرات أولية` });
    return out;
  }, [raw, programs, allEvals, today, lk, actions, trainers, k.responses, range]);

  const decision = actions[0];
  const best = trainers.filter(t => t.responses >= THRESHOLDS.minSample)[0];

  /* ============================================================ render */
  if (loading) return <div className="db-loading"><style dangerouslySetInnerHTML={{ __html: CSS }} /><div className="db-spin" /></div>;
  if (!profile) return <main className="db-loading"><style dangerouslySetInnerHTML={{ __html: CSS }} /><p style={{ color: '#fff' }}>تعذر تحميل ملف المستخدم. أعد تسجيل الدخول.</p></main>;

  const NAV: { id: View; label: string; icon: IconName; hint: string }[] = [
    { id: 'overview', label: 'النظرة التنفيذية', icon: 'dashboard', hint: 'المؤشرات والقرارات' },
    { id: 'programs', label: 'البرامج التدريبية', icon: 'programs', hint: `${programs.length} برنامج` },
    { id: 'evaluations', label: 'التقييمات والروابط', icon: 'evaluations', hint: 'النماذج و QR' },
    { id: 'reports', label: 'التقارير', icon: 'reports', hint: `${REPORTS.length} نوعًا` },
    { id: 'settings', label: 'الإعدادات', icon: 'settings', hint: 'الملف الشخصي' },
  ];
  const rangeLabel = { '7d': 'آخر 7 أيام', '14d': 'آخر 14 يومًا', '30d': 'آخر 30 يومًا', all: 'كل الفترة' }[range];
  const perf = PERF_LABEL[k.perf], risk = RISK_LABEL[k.risk];
  const freshness = lastSubmit ? timeAgo(lastSubmit) : 'لا توجد استجابات بعد';

  return (
    <div className="db" dir="rtl">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {notice && <div className="db-toast">{notice}</div>}
      {apModal && (
        <div className="db-modal" role="dialog" aria-modal="true" onClick={e => { if (e.target === e.currentTarget && !apModal.busy) setApModal(null); }}>
          <div className="db-modal-box">
            <div className="db-ct" style={{ marginBottom: 8 }}><Icon name="shield" size={18} /> {AP_ACTION[apModal.to].title}</div>
            <p className="db-modal-p"><b>{apModal.program.name_ar}</b>{apModal.program.name_en ? <small className="db-muted"> · {apModal.program.name_en}</small> : null}</p>
            <p className="db-modal-help">{AP_ACTION[apModal.to].help}</p>
            <label className="db-modal-field">{apModal.to === 'REJECTED' ? 'سبب الرفض *' : 'ملاحظة (اختياري)'}
              <textarea rows={3} value={apModal.note} onChange={e => setApModal(m => m && { ...m, note: e.target.value })} placeholder={apModal.to === 'REJECTED' ? 'مثال: الأهداف غير قابلة للقياس، ويلزم تحديد الفئة المستهدفة.' : 'مثال: روجع الجدول الزمني مع المدربين.'} />
            </label>
            <div className="db-row" style={{ justifyContent: 'flex-end' }}>
              <button className="db-btn" onClick={() => setApModal(null)} disabled={apModal.busy}>إلغاء</button>
              <button className={`db-btn ${apModal.to === 'REJECTED' ? 'danger' : 'primary'}`} onClick={applyApproval} disabled={apModal.busy}>{apModal.busy ? 'جارٍ التنفيذ…' : AP_ACTION[apModal.to].cta}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== sidebar ===== */}
      <aside className={`db-side ${menuOpen ? 'open' : ''}`}>
        <div className="db-brand">
          <div className="db-logos">
            <img src="/logos/upm.png" alt="جامعة الأمير مقرن" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
            <img src="/logos/gate.png" alt="بوابة التميز" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <div className="db-brand-text"><b>منصة التقويم</b><small>مركز القيادة التنفيذي · جامعة الأمير مقرن</small></div>
        </div>
        <div className="db-user">
          <div className="db-avatar">{(profile.full_name || 'م').trim().charAt(0)}</div>
          <div><b>{profile.full_name || 'مدير المنصة'}</b><small>{ROLE_LABEL[profile.role] || profile.role}</small></div>
        </div>
        <nav className="db-nav">
          {NAV.map(n => (
            <button key={n.id} className={view === n.id ? 'on' : ''} onClick={() => { setView(n.id); setMenuOpen(false); window.history.replaceState(null, '', `?view=${n.id}`); }}>
              <Icon name={n.icon} size={20} /><span><b>{n.label}</b><small>{n.hint}</small></span>
            </button>
          ))}
          <div className="db-nav-sep">الإدارة</div>
          <Link href="/command-center" className="db-navlink"><Icon name="play" size={20} /><span><b>غرفة القيادة</b><small>شاشة عرض حية · تحديث تلقائي</small></span></Link>
          <Link href="/admin/management" className="db-navlink"><Icon name="admin" size={20} /><span><b>لوحة الإدارة</b><small>المدربون · القاعات · المستويات</small></span></Link>
          <Link href="/reports/center" className="db-navlink"><Icon name="chart" size={20} /><span><b>مركز التقارير</b><small>تنفيذية · تشغيلية · تحليلية</small></span></Link>
          <Link href="/reports/remote-survey" className="db-navlink"><Icon name="laptop" size={20} /><span><b>استطلاع التعلم عن بُعد</b><small>{raw?.remoteResponses || 0} استجابة</small></span></Link>
          <Link href="/admin/attendance" className="db-navlink"><Icon name="check" size={20} /><span><b>الحضور الرقمي</b><small>جلسات QR · نسب الحضور</small></span></Link>
          <Link href="/admin/followup" className="db-navlink"><Icon name="trend" size={20} /><span><b>نقل أثر التدريب</b><small>متابعة المشرف والمتدرب بعد 60–90 يومًا</small></span></Link>
          <Link href="/admin/certificates" className="db-navlink"><Icon name="certificate" size={20} /><span><b>الشهادات الإلكترونية</b><small>إصدار · تحقق QR · إرسال</small></span></Link>
          <Link href="/admin/awards" className="db-navlink"><Icon name="award" size={20} /><span><b>تكريم المدربين</b><small>لوحة الشرف الشهرية</small></span></Link>
          <Link href="/admin/impact" className="db-navlink"><Icon name="target" size={20} /><span><b>قياس أثر التدريب</b><small>قبلي / بعدي · الكسب المعياري</small></span></Link>
          <Link href="/admin/data-lifecycle" className="db-navlink"><Icon name="trash" size={20} /><span><b>دورة حياة البيانات</b><small>معاينة وتفريغ منضبط</small></span></Link>
        </nav>
        <button className="db-logout" onClick={logout}><Icon name="logout" size={18} /> تسجيل الخروج</button>
      </aside>

      {/* ===== main ===== */}
      <div className="db-main">
        <header className="db-top">
          <button className="db-burger" onClick={() => setMenuOpen(o => !o)} aria-label="القائمة">☰</button>
          <div className="db-top-title">
            <h1>{NAV.find(n => n.id === view)?.label}</h1>
            <div className="db-top-meta"><Icon name="calendar" size={14} /> {today} · Asia/Riyadh <span className="db-dot" /> <Icon name="clock" size={14} /> آخر استجابة: {freshness}{lastRefresh && <> <span className="db-dot" /> حُدّثت {lastRefresh.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</>}</div>
          </div>
          <div className="db-top-actions">
            {view === 'overview' && (
              <div className="db-seg">{(['7d', '14d', '30d', 'all'] as Range[]).map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{{ '7d': '7 أيام', '14d': '14 يومًا', '30d': '30 يومًا', all: 'الكل' }[r]}</button>)}</div>
            )}
            <button className="db-btn" onClick={load}><Icon name="refresh" size={16} /> تحديث</button>
          </div>
        </header>

        {loadError && <div className="db-loaderr" role="alert"><Icon name="alert" size={18} /> <span>تعذّر تحميل بعض البيانات من قاعدة البيانات: <bdi>{loadError}</bdi></span></div>}

        {/* ================= OVERVIEW ================= */}
        {view === 'overview' && (
          <div className="db-content">
            {/* status banner */}
            <section className="db-hero">
              <div className="db-hero-main">
                <div className="db-kicker">الحالة العامة · {rangeLabel}</div>
                <div className="db-hero-row">
                  <span className="db-hero-score" style={{ color: k.responses ? perf.color : '#94a3b8' }}>{k.responses ? k.mean.toFixed(2) : '—'}<small>/5</small></span>
                  <div>
                    <div className="db-hero-badges"><span className="db-badge" style={{ background: perf.bg, color: perf.color }}>{perf.ar}</span><span className="db-badge" style={{ background: risk.bg, color: risk.color }}>مخاطر: {risk.ar}</span>{cmp?.deltaMean !== null && cmp?.deltaMean !== undefined && <span className="db-badge" style={{ background: cmp.deltaMean >= 0 ? '#d1fae5' : '#fee2e2', color: cmp.deltaMean >= 0 ? '#047857' : '#b91c1c' }}>{cmp.deltaMean >= 0 ? '▲' : '▼'} {Math.abs(cmp.deltaMean).toFixed(2)} عن الفترة السابقة</span>}</div>
                    <p className="db-hero-text">{heroText(k, cmp)}</p>
                  </div>
                </div>
              </div>
              <div className="db-hero-side">
                <div><small>الهدف المرجعي</small><b>{TARGET}</b></div>
                <div><small>الفجوة</small><b style={{ color: k.gap > 0 ? '#fca5a5' : '#86efac' }}>{k.responses ? (k.gap > 0 ? '-' : '+') + Math.abs(k.gap).toFixed(2) : '—'}</b></div>
                <div><small>الاستجابات اليوم</small><b>{kToday.responses}</b></div>
                <div><small>إجمالي الاستجابات</small><b>{kAll.responses}</b></div>
              </div>
            </section>

            {/* KPIs */}
            <section className="db-kpis">
              <Kpi icon="evaluations" label="الاستجابات" value={k.responses} sub={`${k.daily} يومي · ${k.final} ختامي`} delta={cmp ? cmp.deltaResponses : null} />
              <Kpi icon="users" label="المشاركون (فريد)" value={k.participants} sub={`${k.perDay} استجابة/يوم`} />
              <Kpi icon="check" label="رضا مرتفع (4–5)" value={`${k.highPct.toFixed(0)}%`} sub="من القياسات" delta={cmp?.deltaHighPct ?? null} suffix="%" />
              <Kpi icon="alert" label="تقييمات منخفضة (1–2)" value={`${k.lowPct.toFixed(0)}%`} sub={k.lowPct >= 10 ? 'فوق حد الإنذار 10%' : 'ضمن الحد الآمن'} delta={cmp?.deltaLowPct ?? null} suffix="%" good="down" color={k.lowPct >= 10 ? '#b91c1c' : undefined} />
              <Kpi icon="school" label="التغطية" value={k.rooms} sub={`قاعة · ${k.trainers} مدرب · ${k.programs} برنامج`} />
              <Kpi icon="book" label="البرامج النشطة" value={programs.filter(p => p.status === 'ACTIVE').length} sub={`من ${programs.length} برنامج`} />
            </section>

            {/* decision + alerts */}
            <div className="db-g2">
              <section className="db-card db-decision">
                <div className="db-ct"><Icon name="target" size={18} color={TEAL} /> قرار اليوم</div>
                {decision ? (<>
                  <div className="db-decision-head"><span className="db-badge" style={{ background: decision.priority === 'HIGH' ? '#fee2e2' : '#fef3c7', color: decision.priority === 'HIGH' ? '#b91c1c' : '#b45309' }}>أولوية {decision.priority === 'HIGH' ? 'عالية' : 'متوسطة'}</span><b>{decision.label}</b></div>
                  <div className="db-decision-nums"><span>المتوسط: <bdi>{decision.mean.toFixed(2)}/5</bdi></span><span>تقييمات منخفضة: <bdi>{decision.lowPct.toFixed(0)}%</bdi></span><span>العينة: <bdi>n={decision.responses}</bdi></span><span>مؤشر الأثر: <bdi>{decision.impact}</bdi></span></div>
                  <p>{decision.recommendation}</p>
                  <div className="db-decision-meta"><span><Icon name="users" size={14} /> {decision.owner}</span><span><Icon name="clock" size={14} /> {decision.dueDays} يوم</span><span><Icon name="flag" size={14} /> الوصول إلى ≥ {TARGET}</span></div>
                  <div className="db-row">
                    <Link className="db-btn primary" href={`/reports/center?type=actions&preset=${range === 'all' ? 'all' : range}`}>خطة الإجراءات الكاملة ({actions.length}) <Icon name="arrow" size={14} /></Link>
                    {best && <span className="db-muted">🏅 الأعلى أداءً: <b>{best.label}</b> {best.mean.toFixed(2)}/5</span>}
                  </div>
                </>) : <div className="db-empty">{k.responses ? 'لا توجد إجراءات مطلوبة — الأداء ضمن النطاق المطمئن.' : 'لا توجد بيانات في الفترة المختارة.'}</div>}
              </section>

              <section className="db-card">
                <div className="db-ct"><Icon name="alert" size={18} color="#b45309" /> مركز التنبيهات <span className="db-count">{alerts.length}</span></div>
                {alerts.length ? <div className="db-alerts">{alerts.map((a, i) => (
                  <div key={i} className={`db-alert ${a.level}`}><span className="db-alert-dot" /><div style={{ flex: 1 }}>{a.text}</div>{a.href ? <Link href={a.href} className="db-alert-cta">{a.cta}</Link> : a.cta ? <button className="db-alert-cta" onClick={() => setView('programs')}>{a.cta}</button> : null}</div>
                ))}</div> : <div className="db-empty">لا توجد تنبيهات — كل شيء ضمن النطاق الطبيعي.</div>}
              </section>
            </div>

            {/* trend + axes */}
            <div className="db-g2">
              <section className="db-card">
                <div className="db-ct"><Icon name="trend" size={18} color={NAVY} /> اتجاه الرضا — آخر 14 يومًا</div>
                <Spark series={series} />
              </section>
              <section className="db-card">
                <div className="db-ct"><Icon name="compass" size={18} color={NAVY} /> المحاور مقابل الهدف · {rangeLabel}</div>
                {axes.length ? <div className="db-bars">{axes.map(a => <div key={a.key} className="db-bar"><span className="db-bar-l">{a.label}</span><div className="db-bar-t"><div style={{ width: `${a.mean / 5 * 100}%`, background: PERF_LABEL[a.perf].color }} /><i style={{ right: `${TARGET / 5 * 100}%` }} /></div><b style={{ color: PERF_LABEL[a.perf].color }}>{a.mean.toFixed(2)}</b></div>)}</div> : <div className="db-empty">لا توجد بيانات</div>}
              </section>
            </div>

            {/* traffic light board */}
            <div className="db-g2">
              <Board title="لوحة المدربين" icon="users" rows={trainers} href={`/reports/center?type=trainers&preset=${range === 'all' ? 'all' : range}`} />
              <Board title="لوحة القاعات والمجموعات" icon="school" rows={rooms.map(r => ({ ...r, label: `${r.label}${r.meta?.trainer_id ? ' — ' + labelFor('trainer', String(r.meta.trainer_id), lk, 'ar') : ''}` }))} href={`/reports/center?type=classrooms&preset=${range === 'all' ? 'all' : range}`} />
            </div>

            {/* quick access */}
            <section className="db-card">
              <div className="db-ct"><Icon name="chart" size={18} color={NAVY} /> الوصول السريع إلى التقارير</div>
              <div className="db-quick">
                {REPORTS.slice(0, 8).map(r => (
                  <Link key={r.id} href={`/reports/center?type=${r.id}&preset=${range === 'all' ? 'all' : range}`} className="db-quick-item">
                    <span className="db-quick-ico"><Icon name={REPORT_ICON[r.id] || 'reports'} size={20} color={NAVY} /></span>
                    <span><b>{r.title.ar}</b><small>{r.decision.ar}</small></span>
                  </Link>
                ))}
              </div>
              <div style={{ marginTop: 10 }}><Link href="/reports/center" className="db-link">كل التقارير ({REPORTS.length}) <Icon name="arrow" size={14} /></Link></div>
            </section>
          </div>
        )}

        {/* ================= PROGRAMS ================= */}
        {view === 'programs' && (
          <div className="db-content">
            <div className="db-row" style={{ justifyContent: 'space-between' }}>
              <div className="db-pills">
                {(['ACTIVE', 'DRAFT', 'COMPLETED', 'CANCELLED'] as Program['status'][]).map(s => <span key={s} className="db-badge" style={{ ['--dot' as string]: STATUS_STYLE[s].color }}>{STATUS_STYLE[s].label} <b style={{ color: STATUS_STYLE[s].color }}>{programs.filter(p => p.status === s).length}</b></span>)}
              </div>
              <button className="db-btn primary" onClick={openAdd}><Icon name="plus" size={16} /> برنامج جديد</button>
            </div>
            {pendingMine.length > 0 && (
              <div className="db-alert amber db-queue"><span className="db-alert-dot" />
                <div style={{ flex: 1 }}><b>بانتظار إجراءك: {pendingMine.length} برنامج</b><div className="db-muted">{pendingMine.map(p => `${p.name_ar} (${APPROVAL_STYLE[p.approval_status || 'DRAFT'].label})`).join(' · ')}</div></div>
              </div>
            )}
            {showForm && (
              <form className="db-card db-form" onSubmit={saveProgram}>
                <div className="db-ct"><Icon name={editing ? 'edit' : 'plus'} size={18} /> {editing ? 'تعديل البرنامج' : 'إضافة برنامج تدريبي'}</div>
                <div className="db-form-grid">
                  <label>اسم البرنامج بالعربية *<input value={form.name_ar} required onChange={e => setForm({ ...form, name_ar: e.target.value })} /></label>
                  <label>الاسم بالإنجليزية<input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} /></label>
                  <label>طريقة التنفيذ *<select value={form.delivery_mode} onChange={e => setForm({ ...form, delivery_mode: e.target.value as 'onsite' | 'remote' })}><option value="onsite">حضوري</option><option value="remote">عن بُعد (Teams)</option></select></label>
                  <label>تاريخ البداية<input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} /></label>
                  <label>تاريخ النهاية<input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} /></label>
                  <label className="wide">الوصف<textarea rows={3} value={form.description_ar} onChange={e => setForm({ ...form, description_ar: e.target.value })} /></label>
                  <details className="wide db-details" open={!!(form.intro_ar || form.objectives_ar || form.outcomes_ar)}>
                    <summary><Icon name="book" size={16} /> المحتوى المهني للتقرير (يظهر تلقائيًا في الموجز التنفيذي ومقارنة البرامج وبطاقة المدرب)</summary>
                    <div className="db-form-grid">
                      <label>مقدمة البرنامج (عربي)<textarea rows={3} value={form.intro_ar} onChange={e => setForm({ ...form, intro_ar: e.target.value })} /></label>
                      <label>Program overview (English)<textarea rows={3} dir="ltr" value={form.intro_en} onChange={e => setForm({ ...form, intro_en: e.target.value })} /></label>
                      <label>الأهداف — كل هدف في سطر<textarea rows={4} value={form.objectives_ar} onChange={e => setForm({ ...form, objectives_ar: e.target.value })} /></label>
                      <label>Objectives — one per line<textarea rows={4} dir="ltr" value={form.objectives_en} onChange={e => setForm({ ...form, objectives_en: e.target.value })} /></label>
                      <label>المخرجات المتوقعة — كل مخرج في سطر<textarea rows={4} value={form.outcomes_ar} onChange={e => setForm({ ...form, outcomes_ar: e.target.value })} /></label>
                      <label>Expected outcomes — one per line<textarea rows={4} dir="ltr" value={form.outcomes_en} onChange={e => setForm({ ...form, outcomes_en: e.target.value })} /></label>
                      <label>الفئة المستهدفة (عربي)<input value={form.audience_ar} onChange={e => setForm({ ...form, audience_ar: e.target.value })} /></label>
                      <label>Target audience (English)<input dir="ltr" value={form.audience_en} onChange={e => setForm({ ...form, audience_en: e.target.value })} /></label>
                    </div>
                  </details>
                </div>
                <div className="db-row"><button className="db-btn primary" disabled={saving}>{saving ? 'جارٍ الحفظ…' : editing ? 'حفظ التعديلات' : 'حفظ كمسودة'}</button><button type="button" className="db-btn" onClick={closeForm}>إلغاء</button></div>
              </form>
            )}
            <section className="db-card">
              <div className="db-ct"><Icon name="programs" size={18} /> البرامج التدريبية ({programs.length})</div>
              {programs.length ? <div className="db-tw"><table className="db-tbl"><thead><tr><th>البرنامج</th><th>التنفيذ</th><th>الفترة</th><th>القاعات</th><th>الاستجابات</th><th>المتوسط</th><th>الحالة</th><th>الاعتماد</th><th></th></tr></thead><tbody>
                {programs.map(p => {
                  const st = STATUS_STYLE[p.status];
                  const ap: ApprovalStatus = p.approval_status || 'DRAFT';
                  const aps = APPROVAL_STYLE[ap];
                  const pe = allEvals.filter(e => e.program_id === p.id);
                  const pk = computeKpis(pe, facts);
                  const nRooms = (raw?.classrooms || []).filter(c => c.program_id === p.id).length;
                  return (<Fragment key={p.id}>
                    <tr>
                      <td className="l"><b>{p.name_ar}</b>{p.name_en && <small className="db-muted">{p.name_en}</small>}</td>
                      <td><span className="db-badge" style={{ background: p.delivery_mode === 'remote' ? '#ede9fe' : '#e0f2fe', color: p.delivery_mode === 'remote' ? '#6d28d9' : '#0369a1' }}>{p.delivery_mode === 'remote' ? 'عن بُعد' : 'حضوري'}</span></td>
                      <td className="ltr">{p.start_date || '—'}{p.end_date ? ` → ${p.end_date}` : ''}</td>
                      <td>{nRooms}</td><td>{pk.responses}</td>
                      <td className="ltr" style={{ fontWeight: 900, color: pk.responses ? PERF_LABEL[pk.perf].color : '#94a3b8' }}>{pk.responses ? pk.mean.toFixed(2) : '—'}</td>
                      <td><span className="db-badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                      <td><button className="db-ap-pill" title={`${aps.hint}${p.approved_at ? ` · اعتُمد ${p.approved_at.slice(0, 10)}` : p.submitted_at ? ` · أُرسل ${p.submitted_at.slice(0, 10)}` : ''} — اضغط لعرض السجل`} style={{ background: aps.bg, color: aps.color }} onClick={() => loadHistory(p.id)}>{aps.label}{ap === 'REJECTED' && p.rejection_reason ? <small>{p.rejection_reason}</small> : null}</button></td>
                      <td className="db-acts"><div className="db-row" style={{ gap: 4, flexWrap: 'wrap', justifyContent: 'flex-start' }}>
                        <button className="db-ic" title="تعديل" onClick={() => openEdit(p)}><Icon name="edit" size={15} /></button>
                        {canSubmit && (ap === 'DRAFT' || ap === 'REJECTED') && p.status !== 'CANCELLED' && <button className="db-btn sm soft info" onClick={() => openApproval(p, 'PENDING_REVIEW')}><Icon name="arrow" size={12} /> {ap === 'REJECTED' ? 'إعادة الإرسال' : 'إرسال للمراجعة'}</button>}
                        {canSubmit && ap === 'PENDING_REVIEW' && <button className="db-btn sm soft info" onClick={() => openApproval(p, 'REVIEWED')}><Icon name="check" size={12} /> تمت المراجعة</button>}
                        {canApprove && (ap === 'PENDING_REVIEW' || ap === 'REVIEWED') && <button className="db-btn sm soft ok" onClick={() => openApproval(p, 'APPROVED')}><Icon name="shield" size={12} /> اعتماد</button>}
                        {canApprove && (ap === 'PENDING_REVIEW' || ap === 'REVIEWED') && <button className="db-btn sm soft warn" onClick={() => openApproval(p, 'REJECTED')}><Icon name="x" size={12} /> رفض</button>}
                        {canApprove && ap === 'APPROVED' && p.status === 'DRAFT' && <button className="db-btn sm soft" title="إلغاء الاعتماد" onClick={() => openApproval(p, 'DRAFT')}><Icon name="refresh" size={12} /> إلغاء الاعتماد</button>}
                        {p.status === 'DRAFT' && ap === 'APPROVED' && <button className="db-btn sm soft ok" onClick={() => setStatus(p.id, 'ACTIVE')}><Icon name="play" size={12} /> تفعيل</button>}
                        {p.status === 'ACTIVE' && <button className="db-btn sm soft info" onClick={() => setStatus(p.id, 'COMPLETED')}><Icon name="check" size={12} /> إنهاء</button>}
                        {p.status !== 'CANCELLED' && <button className="db-btn sm soft warn" onClick={() => setStatus(p.id, 'CANCELLED')}><Icon name="pause" size={12} /> تعطيل</button>}
                        <Link className="db-ic" title="تقرير البرنامج" href={`/reports/center?type=executive&program=${p.id}`}><Icon name="reports" size={15} /></Link>
                        <button className="db-ic danger" title="حذف" onClick={() => deleteProgram(p)}><Icon name="trash" size={15} /></button>
                      </div></td>
                    </tr>
                    {historyFor === p.id && (
                      <tr key={p.id + '-h'} className="db-hist-row"><td colSpan={9}>
                        <div className="db-hist">
                          <div className="db-hist-head"><Icon name="clock" size={15} /> سجل اعتماد «{p.name_ar}»<button className="db-link" onClick={() => setHistoryFor(null)}>إغلاق</button></div>
                          {history.length === 0 ? <div className="db-muted">لا توجد انتقالات مسجّلة بعد — سيبدأ السجل مع أول إرسال للمراجعة.</div> : (
                            <ol className="db-timeline">
                              {history.map(h => <li key={h.id}><span className="db-tl-dot" style={{ background: APPROVAL_STYLE[h.to_status]?.color || '#94a3b8' }} /><div><b>{APPROVAL_STYLE[h.to_status]?.label || h.to_status}</b>{h.from_status && <span className="db-muted"> ← {APPROVAL_STYLE[h.from_status as ApprovalStatus]?.label || h.from_status}</span>}<div className="db-muted">{h.actor_name || '—'}{h.actor_role ? ` · ${ROLE_LABEL[h.actor_role] || h.actor_role}` : ''} · <bdi>{new Date(h.created_at).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</bdi></div>{h.comment && <div className="db-hist-note">{h.comment}</div>}</div></li>)}
                            </ol>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </Fragment>);
                })}
              </tbody></table></div> : <div className="db-empty">لا توجد برامج. أضف برنامجًا جديدًا.</div>}
            </section>
          </div>
        )}

        {/* ================= EVALUATIONS ================= */}
        {view === 'evaluations' && (
          <div className="db-content">
            <section className="db-kpis four">
              <Kpi icon="evaluations" label="تقييمات يومية" value={kAll.daily} sub="إجمالي" />
              <Kpi icon="flag" label="تقييمات ختامية" value={kAll.final} sub="إجمالي" />
              <Kpi icon="laptop" label="استطلاع التعلم عن بُعد" value={raw?.remoteResponses || 0} sub="استجابة" />
              <Kpi icon="star" label="المتوسط العام" value={kAll.responses ? kAll.mean.toFixed(2) : '—'} sub={`الهدف ${TARGET}`} />
            </section>
            <div className="db-g3">
              <FormCard icon="evaluations" title="الاستبيان اليومي" desc="يُعبأ بعد كل حصة تدريبية — يرتبط بالقاعة والمدرب تلقائيًا." href="/evaluate/daily" />
              <FormCard icon="flag" title="الاستبيان الختامي" desc="يُعبأ مرة واحدة في نهاية البرنامج ويشمل الخدمات والإقامة." href="/evaluate/final" />
              <FormCard icon="laptop" title="استطلاع التعلم عن بُعد" desc="للطلاب عبر Teams — مجهول الهوية، ثنائي اللغة، بروابط لكل مجموعة/موعد." href="/survey/remote-learning" admin="/admin/management?tab=rooms" />
            </div>
          </div>
        )}

        {/* ================= REPORTS ================= */}
        {view === 'reports' && (
          <div className="db-content">
            {REPORT_GROUPS.map(g => (
              <section key={g.id} className="db-card">
                <div className="db-ct">{g.ar}</div>
                <div className="db-quick">
                  {REPORTS.filter(r => r.group === g.id).map(r => (
                    <Link key={r.id} href={`/reports/center?type=${r.id}`} className="db-quick-item">
                      <span className="db-quick-ico"><Icon name={REPORT_ICON[r.id] || 'reports'} size={20} color={NAVY} /></span>
                      <span><b>{r.title.ar}</b><small>{r.decision.ar}</small><small className="db-muted">{r.audience.ar}</small></span>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
            <div className="db-row">
              <Link href="/reports" className="db-btn">اللوحة التحليلية التفصيلية</Link>
              <Link href="/reports/remote-survey" className="db-btn">نتائج استطلاع التعلم عن بُعد</Link>
              <Link href="/reports/impact" className="db-btn">تقرير أثر التدريب (قبلي/بعدي)</Link>
            </div>
          </div>
        )}

        {/* ================= SETTINGS ================= */}
        {view === 'settings' && (
          <div className="db-content">
            <form className="db-card db-form" onSubmit={updateProfile} style={{ maxWidth: 640 }}>
              <div className="db-ct"><Icon name="settings" size={18} /> الملف الشخصي</div>
              <div className="db-form-grid">
                <label>الاسم الكامل<input name="full_name" defaultValue={profile.full_name} required /></label>
                <label>رقم الجوال<input name="phone" defaultValue={profile.phone || ''} /></label>
                <label>الصلاحية<input disabled value={ROLE_LABEL[profile.role] || profile.role} /></label>
              </div>
              <button className="db-btn primary">حفظ التعديلات</button>
            </form>

            <form className="db-card db-form" onSubmit={changePassword} style={{ maxWidth: 640 }} autoComplete="off">
              <div className="db-ct"><Icon name="shield" size={18} /> تغيير كلمة المرور</div>
              <div className="db-form-grid">
                <label className="wide">كلمة المرور الحالية<input type="password" name="current_password" required autoComplete="current-password" /></label>
                <label>كلمة المرور الجديدة<input type="password" name="new_password" required minLength={8} autoComplete="new-password" /></label>
                <label>تأكيد كلمة المرور الجديدة<input type="password" name="confirm_password" required minLength={8} autoComplete="new-password" /></label>
              </div>
              <p className="db-muted">8 أحرف على الأقل وتتضمن حروفًا وأرقامًا. سيُطلب منك التحقق بكلمة المرور الحالية أولًا.</p>
              {pwMsg && <div className={`db-pwmsg ${pwMsg.ok ? 'ok' : 'err'}`} role="status"><Icon name={pwMsg.ok ? 'check' : 'alert'} size={16} /> {pwMsg.text}</div>}
              <button className="db-btn primary" disabled={pwBusy}>{pwBusy ? 'جارٍ التغيير…' : 'تغيير كلمة المرور'}</button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================ pieces */
function heroText(k: Kpis, cmp: ReturnType<typeof periodComparison>): string {
  if (!k.responses) return 'لا توجد استجابات في الفترة المختارة. وسّع النطاق الزمني أو تأكد من مشاركة روابط التقييم.';
  const base = `${k.responses} استجابة من ${k.participants} مشاركًا عبر ${k.rooms} قاعة و${k.trainers} مدرب. نسبة الرضا المرتفع ${k.highPct.toFixed(0)}% والمنخفض ${k.lowPct.toFixed(0)}%.`;
  const verdict = k.responses < THRESHOLDS.minSample ? ' العينة صغيرة — المؤشرات أولية.' : k.perf === 'EXCELLENT' ? ' الأداء يتجاوز الهدف؛ وثّق الممارسات الناجحة وعمّمها.' : k.perf === 'GOOD' ? ` أداء جيد والفجوة إلى الامتياز ${k.gap.toFixed(2)} درجة.` : k.perf === 'WATCH' ? ` الأداء دون الهدف بفجوة ${k.gap.toFixed(2)} — تلزم خطة تحسين خلال أسبوعين.` : ' مستوى خطر يستدعي تدخلًا عاجلًا.';
  const trend = cmp && cmp.deltaMean !== null ? ` ${cmp.deltaMean >= 0 ? 'تحسّن' : 'تراجع'} بمقدار ${Math.abs(cmp.deltaMean).toFixed(2)} مقارنة بالفترة السابقة.` : '';
  return base + verdict + trend;
}
function timeAgo(iso: string): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
  if (m < 1) return 'الآن'; if (m < 60) return `قبل ${m} دقيقة`; if (h < 24) return `قبل ${h} ساعة`; return `قبل ${d} يوم`;
}
function Kpi({ icon, label, value, sub, delta, suffix = '', good = 'up', color }: { icon: IconName; label: string; value: string | number; sub?: string; delta?: number | null; suffix?: string; good?: 'up' | 'down'; color?: string }) {
  const pos = delta === null || delta === undefined ? null : good === 'up' ? delta >= 0 : delta <= 0;
  return (
    <div className="db-kpi">
      <div className="db-kpi-ico"><Icon name={icon} size={20} color={NAVY} /></div>
      <div className="db-kpi-body">
        <small>{label}</small>
        <b style={{ color: color || NAVY }}>{value}</b>
        <span>{sub}</span>
        {delta !== null && delta !== undefined && <em style={{ color: delta === 0 ? '#64748b' : pos ? '#047857' : '#b91c1c' }}>{delta > 0 ? '▲' : delta < 0 ? '▼' : '•'} {Number.isInteger(delta) ? Math.abs(delta) : Math.abs(delta).toFixed(suffix ? 1 : 2)}{suffix} <i>عن الفترة السابقة</i></em>}
      </div>
    </div>
  );
}
function Spark({ series }: { series: { key: string; label: string; mean: number | null; ma: number | null; responses: number }[] }) {
  const pts = series.filter(s => s.mean !== null);
  if (pts.length < 2) return <div className="db-empty">يلزم يومان على الأقل من البيانات لرسم الاتجاه.</div>;
  const W = 600, H = 170, P = 28;
  const x = (i: number) => P + i * (W - 2 * P) / Math.max(1, pts.length - 1);
  const y = (v: number) => H - P - (v - 1) / 4 * (H - 2 * P);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.mean as number)}`).join(' ');
  const area = `${d} L${x(pts.length - 1)},${H - P} L${x(0)},${H - P} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="db-svg">
      <defs><linearGradient id="dbg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={TEAL} stopOpacity=".25" /><stop offset="1" stopColor={TEAL} stopOpacity="0" /></linearGradient></defs>
      {[1, 2, 3, 4, 5].map(v => <g key={v}><line x1={P} x2={W - P} y1={y(v)} y2={y(v)} stroke="#eef2f7" /><text x={P - 6} y={y(v) + 3} fontSize="9" textAnchor="end" fill="#94a3b8">{v}</text></g>)}
      <line x1={P} x2={W - P} y1={y(TARGET)} y2={y(TARGET)} stroke={GOLD} strokeDasharray="5 4" strokeWidth="1.5" />
      <path d={area} fill="url(#dbg)" /><path d={d} fill="none" stroke={NAVY} strokeWidth="2.5" />
      {pts.map((p, i) => <g key={p.key}><circle cx={x(i)} cy={y(p.mean as number)} r="3.5" fill={(p.mean as number) >= TARGET ? '#059669' : (p.mean as number) >= THRESHOLDS.good ? NAVY : '#dc2626'}><title>{p.label}: {p.mean} (n={p.responses})</title></circle><text x={x(i)} y={H - P + 12} fontSize="8" textAnchor="middle" fill="#94a3b8">{p.label.slice(5)}</text></g>)}
    </svg>
  );
}
function Board({ title, icon, rows, href }: { title: string; icon: IconName; rows: GroupRow[]; href: string }) {
  return (
    <section className="db-card">
      <div className="db-ct"><Icon name={icon} size={18} color={NAVY} /> {title} <Link href={href} className="db-link" style={{ marginInlineStart: 'auto' }}>التقرير الكامل <Icon name="arrow" size={13} /></Link></div>
      {rows.length ? <div className="db-board">{rows.slice(0, 8).map(r => { const m = PERF_LABEL[r.perf]; return (
        <div key={r.key} className="db-board-row">
          <span className="db-light" style={{ background: m.color }} />
          <span className="db-board-l">{r.label}</span>
          <span className="db-muted">n={r.responses}</span>
          {r.delta !== null && <span style={{ color: (r.delta as number) >= 0 ? '#047857' : '#b91c1c', fontSize: 11, fontWeight: 900 }}>{(r.delta as number) >= 0 ? '▲' : '▼'} {Math.abs(r.delta as number).toFixed(2)}</span>}
          <b className="ltr" style={{ color: m.color }}>{r.mean.toFixed(2)}</b>
          <span className="db-badge" style={{ background: m.bg, color: m.color }}>{m.ar}</span>
        </div>); })}</div> : <div className="db-empty">لا توجد بيانات في الفترة المختارة</div>}
    </section>
  );
}
function FormCard({ icon, title, desc, href, admin }: { icon: IconName; title: string; desc: string; href: string; admin?: string }) {
  const [copied, setCopied] = useState(false);
  const full = typeof window !== 'undefined' ? `${window.location.origin}${href}` : href;
  const copy = async () => { try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { window.prompt('انسخ الرابط:', full); } };
  return (
    <section className="db-card db-formcard">
      <div className="db-quick-ico big"><Icon name={icon} size={24} color={NAVY} /></div>
      <h3>{title}</h3><p className="db-muted">{desc}</p>
      <div className="db-row">
        <a className="db-btn primary" href={href} target="_blank" rel="noreferrer">فتح النموذج</a>
        <button className="db-btn" onClick={copy}><Icon name="link" size={14} /> {copied ? 'تم النسخ' : 'نسخ الرابط'}</button>
        <a className="db-btn" href={`https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(full)}`} target="_blank" rel="noreferrer">QR</a>
        {admin && <Link className="db-link" href={admin}>روابط المجموعات</Link>}
      </div>
    </section>
  );
}

/* ============================================================ styles */
const CSS = `
.db{display:grid;grid-template-columns:276px 1fr;min-height:100vh;color:var(--ink);background:linear-gradient(to left,#0b2240 276px,var(--bg) 276px)}
.db-loading{min-height:100vh;display:grid;place-items:center;background:var(--navy)}
@keyframes dbspin{to{transform:rotate(360deg)}}
.db-spin{width:52px;height:52px;border:5px solid rgba(255,255,255,.14);border-top-color:var(--teal-2);border-radius:50%;animation:dbspin .9s linear infinite}
.db-muted{color:var(--muted);font-size:12px;font-weight:700}
.db-toast{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:60;background:var(--navy);color:#fff;padding:10px 18px;border-radius:var(--r);font-weight:800;box-shadow:var(--shadow);border-inline-start:4px solid var(--teal-2)}
/* ---------- sidebar ---------- */
.db-side{background:linear-gradient(180deg,var(--navy) 0%,#0b2240 100%);color:#fff;padding:16px 14px;display:flex;flex-direction:column;gap:14px;position:sticky;top:0;height:100vh;overflow:auto;align-self:start;border-inline-start:1px solid rgba(255,255,255,.06)}
.db-brand{display:flex;flex-direction:column;gap:10px}.db-brand-text{text-align:center}
.db-logos{background:#fff;border-radius:var(--r);padding:9px 10px;display:flex;align-items:center;justify-content:center;gap:12px;border:1px solid rgba(255,255,255,.4);box-shadow:inset 0 0 0 2px var(--gold-soft)}
.db-logos img{height:46px;width:auto;max-width:128px;object-fit:contain;display:block}
.db-brand b{display:block;font-size:16px;letter-spacing:.2px}.db-brand small,.db-user small{display:block;color:#a9c4d8;font-size:11px;font-weight:700}
.db-user{display:flex;gap:10px;align-items:center;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:var(--r);padding:10px}
.db-avatar{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,var(--gold),#e6c979);color:var(--navy);font-weight:900;display:grid;place-items:center;font-size:17px}
.db-user b{display:block;font-size:14px}
.db-nav{display:flex;flex-direction:column;gap:3px;flex:1}
.db-nav button,.db-navlink{display:flex;gap:10px;align-items:center;width:100%;background:transparent;border:1px solid transparent;color:#d7e3ee;border-radius:10px;padding:9px 10px;cursor:pointer;text-align:start;text-decoration:none;position:relative;transition:.15s}
.db-nav button svg,.db-navlink svg{opacity:.85;flex-shrink:0}
.db-nav button:hover,.db-navlink:hover{background:rgba(255,255,255,.07);color:#fff}
.db-nav button.on{background:rgba(255,255,255,.1);color:#fff}
.db-nav button.on::before{content:'';position:absolute;inset-inline-start:-14px;top:9px;bottom:9px;width:4px;border-radius:0 3px 3px 0;background:var(--gold)}
.db-nav button.on svg{opacity:1;color:#f1dfa6}
.db-nav span{display:flex;flex-direction:column;min-width:0}.db-nav b{font-size:14px}.db-nav small{font-size:11px;color:#a9c4d8;font-weight:700}
.db-nav-sep{font-size:10.5px;font-weight:800;color:#8fb0c9;letter-spacing:.6px;padding:12px 10px 4px;border-top:1px solid rgba(255,255,255,.08);margin-top:6px;text-transform:uppercase}
.db-logout{display:flex;gap:8px;align-items:center;justify-content:center;background:transparent;border:1px solid rgba(255,255,255,.18);color:#fbd5d5;border-radius:10px;padding:10px;cursor:pointer;font-weight:800;transition:.15s}
.db-logout:hover{background:rgba(220,38,38,.18);border-color:rgba(252,165,165,.4);color:#fff}
/* ---------- main ---------- */
.db-main{min-width:0}
.db-loaderr{margin:14px 24px -6px;background:var(--bad-soft);border:1px solid var(--bad-line);color:var(--bad);border-radius:var(--r);padding:10px 14px;display:flex;gap:8px;align-items:center;font-weight:800;font-size:13px}
.db-top{display:flex;align-items:center;gap:14px;padding:14px 24px;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20;flex-wrap:wrap}
.db-burger{display:none;background:var(--surface-2);border:1px solid var(--line);border-radius:var(--r-sm);padding:6px 10px;font-size:18px;cursor:pointer}
.db-top-title{flex:1;min-width:220px}
.db-top h1{margin:0;font-size:21px;color:var(--navy);font-weight:800;letter-spacing:-.1px}
.db-top-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);font-weight:700;margin-top:2px;flex-wrap:wrap}
.db-dot{width:4px;height:4px;border-radius:50%;background:var(--line-2);display:inline-block;margin:0 4px}
.db-top-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.db-seg{display:flex;gap:2px;background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:3px}
.db-seg button{border:0;background:transparent;border-radius:8px;padding:6px 12px;font-weight:800;font-size:12px;color:var(--muted);cursor:pointer;transition:.15s}
.db-seg button:hover{color:var(--navy)}
.db-seg button.on{background:var(--navy);color:#fff;box-shadow:var(--shadow-sm)}
/* buttons */
.db-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink-2);border-radius:10px;padding:9px 14px;font-weight:800;font-size:13px;cursor:pointer;text-decoration:none;transition:.15s;line-height:1.3}
.db-btn:hover{background:var(--surface-2);border-color:#b9c7d8;color:var(--navy)}
.db-btn.primary{background:var(--navy);color:#fff;border-color:var(--navy);box-shadow:0 4px 12px rgba(15,42,78,.18)}
.db-btn.primary:hover{background:var(--navy-2);border-color:var(--navy-2);color:#fff}
.db-btn.teal{background:var(--teal);color:#fff;border-color:var(--teal)}.db-btn.teal:hover{background:var(--teal-2);color:#fff}
.db-btn:disabled{opacity:.6;cursor:not-allowed}
.db-btn.sm{padding:5px 10px;font-size:12px;border-radius:8px}
.db-btn.soft{background:var(--surface-2);border-color:var(--line);color:var(--ink-2)}
.db-btn.soft.ok{background:var(--ok-soft);border-color:var(--ok-line);color:var(--ok)}
.db-btn.soft.info{background:var(--info-soft);border-color:var(--info-line);color:var(--info)}
.db-btn.soft.warn{background:var(--warn-soft);border-color:var(--warn-line);color:var(--warn)}
.db-btn.soft:hover{filter:brightness(.97)}
.db-ic{display:inline-grid;place-items:center;width:30px;height:30px;border:1px solid var(--line);background:var(--surface);border-radius:8px;cursor:pointer;color:var(--ink-2);text-decoration:none;transition:.15s}
.db-ic:hover{background:var(--navy-soft);border-color:#b9c7d8;color:var(--navy)}
.db-ic.danger{color:var(--bad)}.db-ic.danger:hover{background:var(--bad-soft);border-color:var(--bad-line)}
.db-link{display:inline-flex;align-items:center;gap:4px;color:var(--teal);font-weight:800;text-decoration:none;font-size:13px;background:transparent;border:0;cursor:pointer}
.db-link:hover{text-decoration:underline}
.db-content{padding:20px 24px 32px;display:flex;flex-direction:column;gap:16px;max-width:1500px}
.db-card{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:18px 20px;box-shadow:var(--shadow-sm)}
.db-ct{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:800;color:var(--navy);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--line)}
.db-ct::before{content:'';width:4px;height:18px;border-radius:3px;background:var(--teal)}
.db-ct svg{color:var(--teal)}
.db-count{background:var(--bad-soft);color:var(--bad);border:1px solid var(--bad-line);border-radius:999px;padding:0 8px;font-size:11px;line-height:18px}
.db-badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;font-size:11.5px;font-weight:800;white-space:nowrap;line-height:1.5}
.db-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.db-empty{color:var(--muted);font-weight:800;padding:26px 14px;text-align:center;background:var(--surface-2);border:1px dashed var(--line-2);border-radius:var(--r);font-size:13px}
.db-g2{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.db-g3{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
/* status summary chips (programs view) */
.db-pills{display:flex;gap:8px;flex-wrap:wrap}
.db-pills .db-badge{background:var(--surface)!important;border:1px solid var(--line);color:var(--ink-2)!important;padding:5px 12px;font-size:12px;box-shadow:var(--shadow-sm)}
.db-pills .db-badge::before{content:'';width:8px;height:8px;border-radius:50%;background:var(--dot,var(--muted-2))}
/* hero */
.db-hero{display:grid;grid-template-columns:1fr 300px;gap:16px;background:linear-gradient(135deg,var(--navy) 0%,#0b2240 100%);color:#fff;border-radius:var(--r-xl);padding:22px 24px;border:1px solid rgba(201,162,75,.35);position:relative;overflow:hidden;box-shadow:var(--shadow)}
.db-hero::after{content:'';position:absolute;inset-inline-end:-80px;top:-80px;width:260px;height:260px;border-radius:50%;background:radial-gradient(circle,rgba(11,138,131,.35),transparent 70%);pointer-events:none}
.db-kicker{font-size:11px;font-weight:800;color:#a9c4d8;letter-spacing:.5px;margin-bottom:8px;text-transform:uppercase}
.db-hero-row{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.db-hero-score{font-size:58px;font-weight:900;line-height:1;direction:ltr;unicode-bidi:plaintext;font-variant-numeric:tabular-nums}
.db-hero-score small{font-size:18px;color:#a9c4d8;font-weight:700}
.db-hero-badges{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.db-hero-text{margin:0;font-size:14px;line-height:1.9;color:#e2e8f0;max-width:720px}
.db-hero-side{display:grid;grid-template-columns:1fr 1fr;gap:8px;position:relative}
.db-hero-side div{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:var(--r);padding:10px;text-align:center}
.db-hero-side small{display:block;font-size:11px;color:#a9c4d8;font-weight:800}
.db-hero-side b{font-size:22px;direction:ltr;unicode-bidi:plaintext;font-variant-numeric:tabular-nums}
/* kpis */
.db-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}.db-kpis.four{grid-template-columns:repeat(4,minmax(0,1fr))}@media(max-width:1500px){.db-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.db-kpis.four{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:700px){.db-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.db-kpi{display:flex;gap:12px;background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);padding:14px;box-shadow:var(--shadow-sm);transition:.15s}
.db-kpi:hover{box-shadow:var(--shadow);transform:translateY(-1px)}
.db-kpi-ico{width:42px;height:42px;border-radius:12px;background:var(--navy-soft);color:var(--navy);display:grid;place-items:center;flex-shrink:0}
.db-kpi-body{display:flex;flex-direction:column;min-width:0}
.db-kpi-body small{font-size:11px;font-weight:800;color:var(--muted)}
.db-kpi-body b{font-size:26px;line-height:1.2;direction:ltr;unicode-bidi:plaintext;text-align:start;color:var(--navy);font-variant-numeric:tabular-nums}
.db-kpi-body span{font-size:11px;color:var(--muted);font-weight:700}
.db-kpi-body em{font-style:normal;font-size:11px;font-weight:800;margin-top:2px}
.db-kpi-body em i{font-style:normal;color:var(--muted-2);font-weight:700}
/* decision */
.db-decision{border-inline-start:5px solid var(--teal)}
.db-decision-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap;font-size:16px;margin-bottom:6px}
.db-decision-nums{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:6px}.db-decision-nums bdi{color:var(--navy);font-size:13px}
.db-decision p{margin:0 0 8px;line-height:1.9;font-size:14px;color:var(--ink-2)}
.db-decision-meta{display:flex;gap:14px;flex-wrap:wrap;font-size:12px;color:var(--muted);font-weight:800;margin-bottom:10px}
.db-decision-meta span{display:inline-flex;gap:4px;align-items:center}
/* alerts */
.db-alerts{display:flex;flex-direction:column;gap:8px;max-height:360px;overflow:auto}
.db-alert{display:flex;gap:10px;align-items:center;border:1px solid var(--line);border-radius:var(--r);padding:10px 12px;font-size:13px;font-weight:700;background:var(--surface-2)}
.db-alert-dot{width:10px;height:10px;border-radius:50%;flex-shrink:0;box-shadow:0 0 0 3px rgba(0,0,0,.04)}
.db-alert.red{border-color:var(--bad-line);background:var(--bad-soft)}.db-alert.red .db-alert-dot{background:#dc2626}
.db-alert.amber{border-color:var(--warn-line);background:var(--warn-soft)}.db-alert.amber .db-alert-dot{background:#f59e0b}
.db-alert.blue{border-color:var(--info-line);background:var(--info-soft)}.db-alert.blue .db-alert-dot{background:#3b82f6}
.db-alert-cta{white-space:nowrap;background:var(--surface);border:1px solid var(--line-2);border-radius:8px;padding:5px 10px;font-size:12px;font-weight:800;color:var(--navy);text-decoration:none;cursor:pointer}
.db-alert-cta:hover{border-color:var(--navy)}
/* bars / spark / board */
.db-bars{display:flex;flex-direction:column;gap:8px}
.db-bar{display:grid;grid-template-columns:minmax(110px,180px) 1fr 46px;gap:10px;align-items:center;font-size:13px}
.db-bar-l{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-bar-t{position:relative;height:10px;background:var(--surface-2);border:1px solid var(--line);border-radius:999px}
.db-bar-t div{height:100%;border-radius:999px;margin:-1px 0}
.db-bar-t i{position:absolute;top:-4px;bottom:-4px;border-inline-start:2px dotted var(--gold)}
.db-bar b{direction:ltr;text-align:end;font-variant-numeric:tabular-nums}
.db-svg{width:100%;height:auto;display:block}
.db-board{display:flex;flex-direction:column;gap:2px}
.db-board-row{display:grid;grid-template-columns:12px 1fr auto auto 48px auto;gap:10px;align-items:center;padding:8px 6px;border-bottom:1px solid var(--line);font-size:13px;border-radius:6px}
.db-board-row:hover{background:var(--surface-2)}
.db-light{width:12px;height:12px;border-radius:50%}
.db-board-l{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-board b{text-align:end;font-variant-numeric:tabular-nums}
/* quick */
.db-quick{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px}
.db-quick-item{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--line);border-radius:var(--r);padding:12px;text-decoration:none;color:var(--ink);background:var(--surface);transition:.15s}
.db-quick-item:hover{border-color:var(--teal-line);background:var(--teal-soft);transform:translateY(-1px);box-shadow:var(--shadow-sm)}
.db-quick-item span{display:flex;flex-direction:column;gap:2px}
.db-quick-item b{font-size:14px;color:var(--navy)}.db-quick-item small{font-size:11px;color:var(--muted);font-weight:700;line-height:1.4}
.db-quick-ico{width:40px;height:40px;border-radius:10px;background:var(--navy-soft);color:var(--navy);display:grid;place-items:center;flex-shrink:0}
.db-quick-ico.big{width:50px;height:50px;margin-bottom:8px}
.db-formcard h3{margin:0 0 4px;font-size:16px;color:var(--navy)}
.db-formcard p{margin:0 0 12px;line-height:1.7}
/* approval workflow */
.db-tbl td.l{min-width:200px}.db-tbl td.db-acts{min-width:210px;max-width:260px}
.db-queue{align-items:flex-start}
.db-ap-pill{display:inline-flex;flex-direction:column;align-items:flex-start;gap:1px;border:0;border-radius:10px;padding:4px 10px;font:inherit;font-size:11.5px;font-weight:800;cursor:pointer;white-space:nowrap;line-height:1.5;text-align:start}
.db-ap-pill small{font-weight:700;font-size:10.5px;opacity:.85;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db-ap-pill:hover{filter:brightness(.96)}
.db-btn.danger{background:var(--bad);border-color:var(--bad);color:#fff}.db-btn.danger:hover{background:#991b1b;color:#fff}
.db-hist-row td{background:var(--surface-2)!important;text-align:start!important;padding:12px 16px!important}
.db-hist-head{display:flex;align-items:center;gap:8px;font-weight:800;color:var(--navy);margin-bottom:8px}.db-hist-head .db-link{margin-inline-start:auto}
.db-timeline{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:10px}
.db-timeline li{display:flex;gap:10px;align-items:flex-start;font-size:13px}
.db-tl-dot{width:10px;height:10px;border-radius:50%;margin-top:5px;flex-shrink:0;box-shadow:0 0 0 3px rgba(15,23,42,.05)}
.db-hist-note{margin-top:3px;background:#fff;border:1px solid var(--line);border-radius:8px;padding:6px 10px;font-weight:700;color:var(--ink-2)}
.db-modal{position:fixed;inset:0;background:rgba(15,23,42,.45);backdrop-filter:blur(2px);display:grid;place-items:center;z-index:120;padding:16px}
.db-modal-box{width:min(540px,100%);background:var(--surface);border-radius:var(--r-lg);padding:20px 22px;box-shadow:0 24px 60px rgba(15,23,42,.3)}
.db-modal-p{margin:0 0 4px;font-size:15px}.db-modal-help{margin:0 0 12px;font-size:12.5px;color:var(--muted);font-weight:700;line-height:1.7}
.db-modal-field{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:var(--ink-2);margin-bottom:12px}
.db-modal-field textarea{border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;font-weight:700;font-size:13px;line-height:1.7;resize:vertical}
.db-modal-field textarea:focus{outline:0;border-color:var(--teal);box-shadow:var(--ring)}
/* table / form */
.db-tw{overflow-x:auto;border:1px solid var(--line);border-radius:var(--r);background:var(--surface)}
.db-tbl{width:100%;border-collapse:separate;border-spacing:0;font-size:13px}
.db-tbl th{background:var(--surface-2);color:var(--muted);font-weight:800;padding:11px 10px;border-bottom:1px solid var(--line);text-align:center;font-size:11.5px;white-space:nowrap;letter-spacing:.2px;position:sticky;top:0}
.db-tbl th:first-child{text-align:start}
.db-tbl td{padding:10px;border-bottom:1px solid var(--line);text-align:center;font-weight:700;vertical-align:middle;font-variant-numeric:tabular-nums}
.db-tbl tbody tr:last-child td{border-bottom:0}
.db-tbl tbody tr:hover td{background:#fbfcfe}
.db-tbl td.l{text-align:start}.db-tbl td.ltr{white-space:nowrap}
.db-tbl td.l b{color:var(--navy);display:block;font-size:13.5px}
.db-tbl td.l small{display:block;margin-top:1px;direction:ltr;text-align:start;font-weight:600}
.db-tbl .db-row{justify-content:flex-start}
.db-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
.db-pwmsg{display:flex;gap:8px;align-items:center;border-radius:10px;padding:10px 12px;font-size:13px;font-weight:800;margin-bottom:12px}
.db-pwmsg.ok{background:var(--ok-soft);color:var(--ok);border:1px solid var(--ok-line)}.db-pwmsg.err{background:var(--bad-soft);color:var(--bad);border:1px solid var(--bad-line)}
.db-form label{display:flex;flex-direction:column;gap:5px;font-size:12px;font-weight:800;color:var(--ink-2)}
.db-form label.wide{grid-column:1/-1}
.db-details{grid-column:1/-1;border:1px dashed var(--line-2);border-radius:var(--r);padding:10px 12px;background:var(--surface-2)}
.db-details summary{cursor:pointer;font-weight:800;font-size:13px;color:var(--navy);display:flex;gap:8px;align-items:center;list-style:none}
.db-details summary::-webkit-details-marker{display:none}.db-details[open] summary{margin-bottom:10px}
.db-form input,.db-form select,.db-form textarea{border:1px solid var(--line-2);border-radius:10px;padding:10px 12px;font-weight:700;font-size:13px;color:var(--ink);background:var(--surface);transition:.15s;min-height:40px}
.db-form textarea{min-height:auto;line-height:1.7}
.db-form input:focus,.db-form select:focus,.db-form textarea:focus{outline:0;border-color:var(--teal);box-shadow:var(--ring)}
@media(max-width:1100px){.db-g3{grid-template-columns:1fr}.db-hero{grid-template-columns:1fr}}
@media(max-width:900px){.db{grid-template-columns:1fr;background:var(--bg)}.db-side{display:none;position:fixed;inset:0;z-index:50;height:auto}.db-side.open{display:flex}.db-burger{display:block}.db-g2{grid-template-columns:1fr}.db-form-grid{grid-template-columns:1fr}.db-hero-score{font-size:42px}.db-content{padding:14px}}
`;
