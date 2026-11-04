'use client';
/**
 * P49 «مولّد الروابط» — الرابط الذي لا يُخطئ
 *  - يولّد رابطًا قصيرًا /e/<رمز> + QR لكل برنامج/شعبة/مستوى/فترة، لأيّ من الاستبيانات الثلاثة (يومي/ختامي/نهاية البرنامج).
 *  - العنوان يُسمّى باسم المجموعة أو البرنامج أو الفترة (قوالب) أو يُكتب يدويًّا.
 *  - «ورقة الطباعة»: A4 ببطاقات QR لكل الروابط المختارة — تُلصق على باب القاعة.
 *  - القائمة: الحالة (مفتوح/لم يُفتح/أُغلق/موقوف)، عدد الفتحات، إيقاف/تشغيل، حذف، نسخ.
 *  يعتمد على /api/evaluation-links (Bearer) و lib/evaluation/links و lib/certificates/qr (بلا حزم جديدة).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import { qrSvg } from '../../lib/certificates/qr';
import {
  KIND_AR, KIND_PATH, LINK_KINDS, TITLE_PRESETS, TITLE_PRESET_AR, classroomLabel, fmtWhen, linkStateText, linkTitle, scopeText, shortUrl, titlePreset,
  type EvalLink, type LinkKind, type LinkState, type TitlePreset,
} from '../../lib/evaluation/links';

type ProgramLite = { id: string; name_ar: string; name_en?: string | null; status?: string | null };
type RoomLite = { id: string; program_id: string; code?: string | null; section_name?: string | null; level?: string | null };
type LinkRow = EvalLink & { state: LinkState };

const STATE_AR: Record<LinkState, { t: string; c: string }> = { open: { t: 'مفتوح', c: 'ok' }, before: { t: 'لم يُفتح بعد', c: 'wait' }, after: { t: 'أُغلق', c: 'off' }, off: { t: 'موقوف', c: 'off' } };

export default function EvalLinks({ programs, classrooms, defaultProgram }: { programs: ProgramLite[]; classrooms: RoomLite[]; defaultProgram?: string }) {
  const [token, setToken] = useState('');
  const [origin, setOrigin] = useState('');
  const [list, setList] = useState<LinkRow[]>([]);
  const [names, setNames] = useState<{ programs: ProgramLite[]; classrooms: RoomLite[] }>({ programs: [], classrooms: [] });
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [filterProgram, setFilterProgram] = useState(defaultProgram || '');
  /* نموذج التوليد */
  const [kind, setKind] = useState<LinkKind>('END');
  const [programId, setProgramId] = useState(defaultProgram || '');
  const [scope, setScope] = useState<'all' | 'room' | 'level' | 'bulk'>('all');
  const [classroomId, setClassroomId] = useState(''); const [level, setLevel] = useState('');
  const [preset, setPreset] = useState<TitlePreset>('group'); const [label, setLabel] = useState(''); const [labelTouched, setLabelTouched] = useState(false);
  const [slot, setSlot] = useState(''); const [opensAt, setOpensAt] = useState(''); const [closesAt, setClosesAt] = useState('');
  const [created, setCreated] = useState<LinkRow[]>([]);

  useEffect(() => { try { setOrigin(window.location.origin); } catch { /* ignore */ } void supabase().auth.getSession().then(({ data }) => setToken(data.session?.access_token || '')); }, []);
  const rooms = useMemo(() => classrooms.filter(c => c.program_id === programId), [classrooms, programId]);
  const levels = useMemo(() => Array.from(new Set(rooms.map(r => String(r.level || '').trim()).filter(Boolean))), [rooms]);
  const program = programs.find(p => p.id === programId) || null;
  const roomOf = useCallback((id: string | null) => (id ? (classrooms.find(c => c.id === id) || names.classrooms.find(c => c.id === id) || null) : null), [classrooms, names]);
  const programOf = useCallback((id: string) => programs.find(p => p.id === id) || names.programs.find(p => p.id === id) || null, [programs, names]);

  /* العنوان المقترح يتبع القالب ما لم يلمسه المستخدم */
  const suggested = useMemo(() => {
    if (!program) return '';
    const room = scope === 'room' ? roomOf(classroomId) : null;
    return titlePreset(preset, { program_ar: program.name_ar, classroom: room, level: scope === 'level' ? level : null, slot_ar: slot, opens_at: opensAt || null, closes_at: closesAt || null });
  }, [program, scope, classroomId, level, preset, slot, opensAt, closesAt, roomOf]);
  useEffect(() => { if (!labelTouched) setLabel(suggested); }, [suggested, labelTouched]);

  const load = useCallback(async () => {
    if (!token) return;
    const r = await fetch(`/api/evaluation-links?list=1${filterProgram ? `&program=${encodeURIComponent(filterProgram)}` : ''}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const j = await r.json().catch(() => ({}));
    if (j?.success) { setList(j.links || []); setNames({ programs: j.programs || [], classrooms: j.classrooms || [] }); }
  }, [token, filterProgram]);
  useEffect(() => { void load(); }, [load]);

  async function post(body: any) {
    const r = await fetch('/api/evaluation-links', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({})); if (!r.ok || !j?.success) throw new Error(j?.error || `HTTP ${r.status}`); return j;
  }
  async function create() {
    if (!programId) { setMsg({ ok: false, t: 'اختر البرنامج أولًا' }); return; }
    setBusy(true); setMsg(null);
    try {
      const base = { kind, program_id: programId, label_ar: scope === 'bulk' ? '' : label, slot_ar: slot, opens_at: opensAt || null, closes_at: closesAt || null };
      const j = scope === 'bulk' ? await post({ action: 'bulk', ...base, level: level || null }) : await post({ action: 'create', ...base, classroom_id: scope === 'room' ? classroomId || null : null, level: scope === 'level' ? level || null : null });
      const made: LinkRow[] = j.links || (j.link ? [j.link] : []);
      await load(); setCreated(made); setSel(new Set(made.map(l => l.id)));
      setMsg({ ok: true, t: made.length === 1 ? `أُنشئ الرابط ${made[0].code} ✓` : `أُنشئ ${made.length} رابطًا — واحد لكل شعبة ✓` });
    } catch (e: any) { setMsg({ ok: false, t: e?.message || 'تعذّر الإنشاء' }); }
    setBusy(false);
  }
  async function toggle(l: LinkRow) { setBusy(true); try { await post({ action: 'toggle', id: l.id, active: !l.active }); await load(); setMsg({ ok: true, t: l.active ? 'أُوقف الرابط' : 'أُعيد تشغيل الرابط' }); } catch (e: any) { setMsg({ ok: false, t: e?.message }); } setBusy(false); }
  async function remove(l: LinkRow) {
    if (!confirm(`حذف الرابط ${l.code}؟ الاستجابات المحفوظة تبقى، لكن الرابط يتوقّف فورًا.`)) return;
    setBusy(true); try { await post({ action: 'delete', id: l.id }); await load(); setSel(s => { const n = new Set(s); n.delete(l.id); return n; }); setMsg({ ok: true, t: 'حُذف الرابط' }); } catch (e: any) { setMsg({ ok: false, t: e?.message }); } setBusy(false);
  }
  async function copy(text: string) { try { await navigator.clipboard.writeText(text); setMsg({ ok: true, t: 'نُسخ الرابط' }); } catch { setMsg({ ok: false, t: 'تعذّر النسخ — انسخه يدويًّا' }); } }
  function title(l: EvalLink) { return linkTitle(l, programOf(l.program_id)?.name_ar || '', roomOf(l.classroom_id)); }

  /* «ورقة الطباعة»: A4 بطاقات QR للروابط المحدّدة */
  function printSheet(rows: LinkRow[]) {
    if (!rows.length) { setMsg({ ok: false, t: 'حدّد رابطًا واحدًا على الأقل' }); return; }
    const cards = rows.map(l => {
      const u = shortUrl(origin, l.code); const p = programOf(l.program_id);
      return `<article class="c"><div class="k">${esc(KIND_AR[l.kind])}</div><h2>${esc(title(l))}</h2><div class="p">${esc(p?.name_ar || '')}${l.classroom_id || l.level ? ' · ' + esc(scopeText(l, roomOf(l.classroom_id))) : ''}${l.slot_ar ? ' · ' + esc(l.slot_ar) : ''}</div>${qrSvg(u, 190)}<div class="u">${esc(u)}</div><div class="w">${esc(linkStateText(l.state, l))}</div><div class="h">امسح الرمز بكاميرا الجوال — البرنامج والشعبة محدّدان مسبقًا، لا تختر شيئًا.</div></article>`;
    }).join('');
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ورقة الطباعة — روابط التقويم</title><style>
      @page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;color:#0f2a4e;margin:0}.g{display:grid;grid-template-columns:repeat(2,1fr);gap:10mm}
      .c{border:1.5px solid #c9a24b;border-radius:14px;padding:8mm 6mm;text-align:center;break-inside:avoid;display:grid;gap:4px;justify-items:center}.k{font-size:11px;font-weight:900;color:#8a6a1f;letter-spacing:.3px}
      h2{font-size:17px;margin:0;font-weight:900}.p{font-size:12px;color:#334155;font-weight:700}.u{font-family:monospace;font-size:13px;font-weight:900;direction:ltr}.w{font-size:11px;color:#0b8a83;font-weight:800}.h{font-size:10.5px;color:#64748b;max-width:62mm}
      .top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6mm;font-size:12px;color:#64748b}@media print{.np{display:none}}
    </style></head><body><div class="top"><b>أَثَر · روابط التقويم</b><span>${rows.length} بطاقة · ${esc(new Date().toLocaleDateString('ar-SA'))}</span><button class="np" onclick="print()">طباعة</button></div><div class="g">${cards}</div></body></html>`;
    const w = window.open('', '_blank'); if (!w) { setMsg({ ok: false, t: 'المتصفح منع النافذة — اسمح بالنوافذ المنبثقة' }); return; }
    w.document.open(); w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch { /* ignore */ } }, 400);
  }

  const selected = list.filter(l => sel.has(l.id));
  return (
    <section className="el" data-testid="eval-links">
      <style>{CSS}</style>
      <header className="el-h">
        <div><div className="el-k"><Icon name="link" size={14} /> مولّد الروابط</div><h2>الرابط الذي لا يُخطئ</h2><p>رابط قصير + QR لكل برنامج أو شعبة أو فترة — يفتح الاستبيان الصحيح والبرنامج محدّد مسبقًا، فلا يختار المتدرّب شيئًا ولا يُخطئ.</p></div>
      </header>
      {msg && <div className={`el-msg ${msg.ok ? 'ok' : 'bad'}`} role="status">{msg.t}</div>}

      <div className="el-grid">
        {/* ─── النموذج ─── */}
        <form className="el-form" onSubmit={e => { e.preventDefault(); void create(); }} data-testid="el-form">
          <div className="el-row">
            <label>الاستبيان<div className="el-seg">{LINK_KINDS.map(k => <button key={k} type="button" className={kind === k ? 'on' : ''} onClick={() => setKind(k)} data-testid={`el-kind-${k}`}>{KIND_AR[k]}</button>)}</div></label>
          </div>
          <div className="el-row two">
            <label>البرنامج<select value={programId} onChange={e => { setProgramId(e.target.value); setClassroomId(''); setLevel(''); setLabelTouched(false); }} data-testid="el-program"><option value="">— اختر —</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select></label>
            <label>النطاق<select value={scope} onChange={e => { setScope(e.target.value as any); setLabelTouched(false); }} data-testid="el-scope">
              <option value="all">كل الشعب (المتدرّب يختار شعبته)</option>
              <option value="room" disabled={!rooms.length}>شعبة واحدة</option>
              <option value="level" disabled={!levels.length}>مستوى واحد (كل شعبه)</option>
              <option value="bulk" disabled={!rooms.length}>رابط لكل شعبة دفعة واحدة</option>
            </select></label>
          </div>
          {scope === 'room' && <div className="el-row"><label>الشعبة<select value={classroomId} onChange={e => { setClassroomId(e.target.value); setLabelTouched(false); }} data-testid="el-room" required><option value="">— اختر —</option>{rooms.map(r => <option key={r.id} value={r.id}>{classroomLabel(r) || r.code}</option>)}</select></label></div>}
          {(scope === 'level' || scope === 'bulk') && levels.length > 0 && <div className="el-row"><label>المستوى{scope === 'bulk' ? ' (اختياري — لتقييد الدفعة)' : ''}<select value={level} onChange={e => { setLevel(e.target.value); setLabelTouched(false); }} data-testid="el-level" required={scope === 'level'}><option value="">{scope === 'bulk' ? 'كل المستويات' : '— اختر —'}</option>{levels.map(l => <option key={l} value={l}>{l}</option>)}</select></label></div>}
          <div className="el-row two">
            <label>تسمية العنوان<select value={preset} onChange={e => { setPreset(e.target.value as TitlePreset); setLabelTouched(false); }} data-testid="el-preset">{TITLE_PRESETS.map(p => <option key={p} value={p}>{TITLE_PRESET_AR[p]}</option>)}</select></label>
            <label>الفترة/الموعد (اختياري)<input value={slot} onChange={e => setSlot(e.target.value)} placeholder="مثال: الأسبوع الثالث · مساءً" maxLength={80} data-testid="el-slot" /></label>
          </div>
          {scope !== 'bulk' && <div className="el-row"><label>العنوان الظاهر للمتدرّب<input value={label} onChange={e => { setLabel(e.target.value); setLabelTouched(true); }} maxLength={120} data-testid="el-label" /><small>يتولّد من القالب تلقائيًّا، ويمكنك تعديله — {labelTouched && <button type="button" className="el-lnk" onClick={() => setLabelTouched(false)}>أعد الاقتراح</button>}</small></label></div>}
          <div className="el-row two">
            <label>يُفتح من (اختياري)<input type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)} data-testid="el-opens" /></label>
            <label>يُغلق في (اختياري)<input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} data-testid="el-closes" /></label>
          </div>
          <div className="el-actions"><button type="submit" className="el-btn" disabled={busy || !programId || (scope === 'room' && !classroomId) || (scope === 'level' && !level)} data-testid="el-create"><Icon name="plus" size={14} /> {scope === 'bulk' ? `أنشئ ${level ? rooms.filter(r => String(r.level || '').trim() === level).length : rooms.length} رابطًا` : 'أنشئ الرابط'}</button></div>
        </form>

        {/* ─── آخر ما أُنشئ ─── */}
        <aside className="el-new" data-testid="el-created">
          {created.length === 0 ? <div className="el-empty"><Icon name="qr" size={28} /><p>سيظهر هنا الرابط ورمز QR فور الإنشاء — انسخه أو اطبعه أو أرسله.</p></div> : (
            <>
              <div className="el-k">آخر ما أُنشئ ({created.length})</div>
              <div className="el-cards">{created.slice(0, 6).map(l => { const u = shortUrl(origin, l.code); return (
                <div key={l.id} className="el-card">
                  <div className="el-qr" dangerouslySetInnerHTML={{ __html: qrSvg(u, 120) }} aria-hidden />
                  <b>{title(l)}</b><code dir="ltr">{u}</code>
                  <div className="el-mini"><button type="button" onClick={() => void copy(u)}><Icon name="copy" size={12} /> نسخ</button><a href={u} target="_blank" rel="noreferrer"><Icon name="arrow" size={12} /> افتح</a></div>
                </div>); })}</div>
              <button type="button" className="el-btn ghost" onClick={() => printSheet(created)} data-testid="el-print-created"><Icon name="print" size={14} /> ورقة الطباعة لهذه الروابط</button>
            </>)}
        </aside>
      </div>

      {/* ─── القائمة ─── */}
      <div className="el-list" data-testid="el-list">
        <div className="el-lh">
          <h3>الروابط ({list.length})</h3>
          <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} aria-label="تصفية بالبرنامج"><option value="">كل البرامج</option>{programs.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
          <div className="el-lh-a">
            <button type="button" className="el-btn ghost small" onClick={() => setSel(sel.size === list.length ? new Set() : new Set(list.map(l => l.id)))}>{sel.size === list.length && list.length ? 'إلغاء التحديد' : 'تحديد الكل'}</button>
            <button type="button" className="el-btn small" disabled={!selected.length} onClick={() => printSheet(selected)} data-testid="el-print"><Icon name="print" size={13} /> ورقة الطباعة ({selected.length})</button>
          </div>
        </div>
        {list.length === 0 ? <p className="el-muted">لا روابط بعد — أنشئ الأوّل من النموذج أعلاه.</p> : (
          <div className="el-tbl" role="table">
            {list.map(l => { const u = shortUrl(origin, l.code); const st = STATE_AR[l.state]; return (
              <div key={l.id} className={`el-r ${l.active ? '' : 'dim'}`} role="row" data-testid="el-row" data-code={l.code}>
                <label className="el-chk"><input type="checkbox" checked={sel.has(l.id)} onChange={e => setSel(s => { const n = new Set(s); if (e.target.checked) n.add(l.id); else n.delete(l.id); return n; })} aria-label={`تحديد ${l.code}`} /></label>
                <div className="el-rt"><b>{title(l)}</b><small>{programOf(l.program_id)?.name_ar || '—'} · {KIND_AR[l.kind]} · {scopeText(l, roomOf(l.classroom_id))}{l.slot_ar ? ` · ${l.slot_ar}` : ''}</small><small className="el-when">{l.opens_at || l.closes_at ? `${l.opens_at ? `من ${fmtWhen(l.opens_at)}` : ''} ${l.closes_at ? `إلى ${fmtWhen(l.closes_at)}` : ''}` : 'بلا نافذة زمنية'} · فُتح {l.hits || 0} مرّة</small></div>
                <code dir="ltr" className="el-code">/e/{l.code}</code>
                <span className={`el-st ${st.c}`}>{st.t}</span>
                <div className="el-ra">
                  <button type="button" title="نسخ" onClick={() => void copy(u)}><Icon name="copy" size={13} /></button>
                  <a href={`/evaluate/${KIND_PATH[l.kind]}?link=${l.code}`} target="_blank" rel="noreferrer" title="معاينة"><Icon name="arrow" size={13} /></a>
                  <button type="button" title={l.active ? 'إيقاف' : 'تشغيل'} onClick={() => void toggle(l)} disabled={busy} data-testid="el-toggle">{l.active ? <Icon name="pause" size={13} /> : <Icon name="play" size={13} />}</button>
                  <button type="button" title="حذف" className="danger" onClick={() => void remove(l)} disabled={busy} data-testid="el-delete"><Icon name="trash" size={13} /></button>
                </div>
              </div>); })}
          </div>)}
      </div>
    </section>
  );
}

function esc(s: string) { return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)); }

const CSS = `
.el{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:18px;display:grid;gap:14px;margin-top:14px}
.el-h h2{margin:2px 0 4px;font-size:20px;color:#0f2a4e}.el-h p{margin:0;color:#475569;font-size:13.5px;max-width:70ch}.el-k{font-size:12px;font-weight:900;color:#8a6a1f;display:inline-flex;gap:6px;align-items:center}
.el-msg{border-radius:10px;padding:9px 12px;font-weight:800;font-size:13.5px}.el-msg.ok{background:#ecfdf5;color:#047857}.el-msg.bad{background:#fef2f2;color:#b91c1c}
.el-grid{display:grid;grid-template-columns:1.4fr 1fr;gap:14px}@media(max-width:860px){.el-grid{grid-template-columns:1fr}}
.el-form{display:grid;gap:10px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:14px;min-width:0}.el-row{display:grid;gap:10px}.el-row.two{grid-template-columns:1fr 1fr}@media(max-width:560px){.el-row.two{grid-template-columns:1fr}}
.el-form label{display:grid;gap:4px;font-size:12.5px;font-weight:800;color:#334155;min-width:0}.el-form input,.el-form select{font:inherit;font-size:14px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;min-width:0;width:100%}.el-form small{font-weight:600;color:#64748b;font-size:11.5px}
.el-seg{display:flex;gap:6px;flex-wrap:wrap}.el-seg button{font:inherit;font-size:13px;font-weight:800;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:7px 12px;cursor:pointer;color:#0f2a4e}.el-seg button.on{background:#0f2a4e;color:#fff;border-color:#0f2a4e}
.el-btn{display:inline-flex;align-items:center;gap:6px;font:inherit;font-weight:900;font-size:13.5px;background:#0f2a4e;color:#fff;border:1px solid #0f2a4e;border-radius:10px;padding:10px 16px;cursor:pointer}.el-btn:disabled{opacity:.5;cursor:not-allowed}.el-btn.ghost{background:#fff;color:#0f2a4e}.el-btn.small{padding:7px 11px;font-size:12.5px}.el-lnk{border:0;background:none;color:#0b8a83;font:inherit;font-weight:800;cursor:pointer;padding:0;text-decoration:underline}
.el-new{border:1.5px dashed #c9a24b;border-radius:12px;padding:14px;display:grid;gap:10px;align-content:start;min-width:0}.el-empty{text-align:center;color:#64748b;display:grid;gap:8px;justify-items:center;padding:20px 8px;font-size:13px}
.el-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.el-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;display:grid;gap:4px;justify-items:center;text-align:center;font-size:12px;min-width:0}.el-qr svg{width:120px;height:120px;display:block}.el-card b{color:#0f2a4e;font-size:12.5px}.el-card code{font-size:11px;word-break:break-all;color:#334155}
.el-mini{display:flex;gap:6px}.el-mini button,.el-mini a{font:inherit;font-size:11.5px;font-weight:800;border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 9px;cursor:pointer;color:#0f2a4e;text-decoration:none;display:inline-flex;gap:4px;align-items:center}
.el-list{display:grid;gap:10px}.el-lh{display:flex;gap:10px;align-items:center;flex-wrap:wrap}.el-lh h3{margin:0;font-size:16px;color:#0f2a4e}.el-lh select{font:inherit;font-size:13px;padding:7px 9px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.el-lh-a{margin-inline-start:auto;display:flex;gap:6px}
.el-tbl{display:grid;gap:6px}.el-r{display:grid;grid-template-columns:auto 1fr auto auto auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:10px;padding:8px 10px;min-width:0}.el-r.dim{opacity:.6}.el-rt{display:grid;gap:1px;min-width:0}.el-rt b{color:#0f2a4e;font-size:13.5px}.el-rt small{color:#475569;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.el-when{color:#64748b!important}
.el-code{font-size:13px;font-weight:900;color:#0f2a4e;background:#f1f5f9;border-radius:6px;padding:3px 7px}.el-st{font-size:11.5px;font-weight:900;border-radius:999px;padding:4px 9px}.el-st.ok{background:#ecfdf5;color:#047857}.el-st.wait{background:#fffbeb;color:#92400e}.el-st.off{background:#f1f5f9;color:#475569}
.el-ra{display:flex;gap:4px}.el-ra button,.el-ra a{width:30px;height:30px;display:grid;place-items:center;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;color:#0f2a4e}.el-ra .danger{color:#b91c1c;border-color:#fecaca}.el-ra button:disabled{opacity:.5}
.el-muted{color:#64748b;font-size:13px;margin:0}.el-chk input{width:16px;height:16px}
@media(max-width:700px){.el-r{grid-template-columns:auto 1fr;grid-auto-rows:auto}.el-code,.el-st,.el-ra{grid-column:2}}
`;
