// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** «سرعة مِعيار» — ساعة مراحل خفيفة: تُعلِّم كل مرحلة بمدتها، وتُخرج ترويسة Server-Timing القياسية (تظهر في أدوات المتصفح)
 *  وتسجّل في سجلّ الخادم إن تجاوز الطلب حدًّا — بلا أي بيانات شخصية. */
export type Phase = { name: string; ms: number };
export type Stopwatch = { mark: (name: string) => void; phases: () => Phase[]; total: () => number; header: () => string };
export function stopwatch(): Stopwatch {
  const start = Date.now(); let last = start; const phases: Phase[] = [];
  return {
    mark: (name) => { const now = Date.now(); phases.push({ name, ms: now - last }); last = now; },
    phases: () => phases.slice(),
    total: () => Date.now() - start,
    header: () => phases.map((p) => `${p.name};dur=${p.ms}`).join(', '),
  };
}
/** سطر سجلّ عند البطء: [miaar] slow <action> total=…ms phases=a:12 b:340 … */
export function slowLine(action: string, sw: Stopwatch, thresholdMs = 2500): string | null {
  const total = sw.total(); if (total < thresholdMs) return null;
  return `[miaar] slow ${action} total=${total}ms ${sw.phases().map((p) => `${p.name}:${p.ms}`).join(' ')}`;
}
