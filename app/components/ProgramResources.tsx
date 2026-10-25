'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// قائمة حقائب البرنامج — تُعرض في صفحة البرنامج العامة وفي بوابة المتدرب (/me)
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase } from '../../lib/supabase/client';
import { Icon } from '../../lib/ui/icons';
import type { IconName } from '../../lib/ui/icons';
import type { Lang } from '../../lib/portal/content';
import { typeLabel, typeIcon, levelLabel, accessLabel, resTitle } from '../../lib/portal/resources';
import type { Resource } from '../../lib/portal/resources';

export default function ProgramResources({ programId, lang = 'ar', compact = false }: { programId: string; lang?: Lang; compact?: boolean }) {
  const db = useMemo(() => supabase(), []); const [rows, setRows] = useState<Resource[] | null>(null);
  useEffect(() => { (async () => { try { const { data } = await db.from('portal_resources').select('id,title_ar,title_en,type,level,access,ai_ready,version,downloads').eq('program_id', programId).eq('status', 'published').order('published_at', { ascending: false }); setRows((data || []) as Resource[]); } catch { setRows([]); } })(); }, [db, programId]);
  if (!rows || rows.length === 0) return null;
  return (
    <div className={compact ? 'prx compact' : 'pt-box prx'}>
      <h3><Icon name="folder" size={18} /> {lang === 'ar' ? 'حقائب ومواد البرنامج' : 'Program resources'} <small>({rows.length})</small></h3>
      <div className="prx-list">{rows.map(r => <Link key={r.id} href={`/resources/${r.id}`} className="prx-item"><span className="prx-ic"><Icon name={typeIcon(r.type) as IconName} size={16} /></span><span className="prx-t"><b>{resTitle(r, lang)}</b><small>{typeLabel(r.type, lang)} · {levelLabel(r.level, lang)} · <span className={`prx-acc ${r.access}`}>{accessLabel(r.access, lang)}</span></small></span><Icon name="arrow" size={14} /></Link>)}</div>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </div>
  );
}

const CSS = `
.prx h3{display:flex;gap:8px;align-items:center;margin:0 0 10px;font-size:16px;color:#0f2a4e}.prx h3 small{color:#64748b;font-weight:600}
.prx.compact{margin-top:10px;padding-top:10px;border-top:1px dashed #e2e8f0}.prx.compact h3{font-size:14px}
.prx-list{display:grid;gap:6px}.prx-item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;border:1px solid #e2e8f0;border-radius:12px;padding:8px 12px;text-decoration:none;color:#0f2a4e;background:#fff}.prx-item:hover{border-color:#0b8a83}
.prx-ic{width:32px;height:32px;border-radius:9px;background:#e6f4f3;color:#0b8a83;display:inline-grid;place-items:center}.prx-t{display:grid;gap:1px;min-width:0}.prx-t b{font-size:13.5px;color:#0f172a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.prx-t small{color:#64748b;font-size:11.5px}
.prx-acc{font-weight:800;color:#065f46}.prx-acc.registered{color:#1e40af}.prx-acc.program{color:#9a3412}.prx-acc.org{color:#5b21b6}.prx-acc.staff{color:#334155}
`;
