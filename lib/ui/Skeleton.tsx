// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* م17-أ: هيكل انتظار خفيف (خادم، بلا حالة) — يظهر فورًا أثناء جلب الصفحة بدل بياض الشاشة */
export default function Skeleton({ title = 'جارٍ التحميل…', rows = 4, wide = false }: { title?: string; rows?: number; wide?: boolean }) {
  const css = '.sk{max-width:' + (wide ? '1180px' : '820px') + ';margin:24px auto;padding:0 16px;direction:rtl}.sk-t{height:22px;width:42%;border-radius:8px}.sk-r{height:14px;border-radius:7px;margin-top:14px}.sk-c{margin-top:18px;border:1px solid #e3e8ef;border-radius:16px;padding:18px;background:#fff}.sk .b{background:linear-gradient(90deg,#F3E6DC 25%,#f7f9fc 37%,#F3E6DC 63%);background-size:400% 100%;animation:skp 1.3s ease infinite}@keyframes skp{0%{background-position:100% 0}100%{background-position:0 0}}.sk-lbl{font-size:.85rem;color:#718096;margin-top:14px}';
  return (
    <div className="sk" role="status" aria-live="polite" aria-busy="true" data-testid="skeleton">
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div className="sk-t b" />
      <div className="sk-c">{Array.from({ length: rows }, (_, i) => <div key={i} className="sk-r b" style={{ width: `${92 - (i % 3) * 18}%` }} />)}</div>
      <div className="sk-lbl">{title}</div>
    </div>
  );
}
