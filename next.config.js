// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * درع أَثَر (P21) — «الجدار»: ترويسات الأمان على كل استجابة، بلا وسيط (middleware) وبلا تبعيات.
 *  - HSTS سنتان + preload · nosniff · Referrer strict-origin-when-cross-origin · Permissions-Policy (كاميرا/ميكروفون للموقع نفسه فقط — الغرف الحية).
 *  - frame-ancestors 'none' افتراضًا، و * على /verify/* و /m/* (صفحات التحقق/التأكيد تُضمَّن في بوابات الجهات عمدًا).
 *  - CSP كاملة في وضع Report-Only أولًا (التقارير إلى /api/shield/csp) — تُشدَّد إلى إلزامية بعد أسبوع نظيف (انظر /admin/shield).
 *  - مسارات API: Cache-Control no-store افتراضيًا للخصوصية (المسارات العامة تضبط ترويساتها بنفسها).
 */
const SELF = "'self'";
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://*.supabase.co').replace(/\/+$/, '');
const SUPABASE_WS = SUPABASE.replace(/^http/, 'ws');
const AI_BASE = (process.env.AI_BASE_URL || '').replace(/\/+$/, '');

const CSP_REPORT_ONLY = [
  `default-src ${SELF}`,
  `script-src ${SELF} 'unsafe-inline' https://cdn.moyasar.com`, // Next inline runtime + نموذج الدفع
  `style-src ${SELF} 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src ${SELF} data: https://fonts.gstatic.com`,
  `img-src ${SELF} data: blob: https:`,
  `media-src ${SELF} blob: data:`,
  `connect-src ${SELF} ${SUPABASE} ${SUPABASE_WS} https://api.moyasar.com https://miaar-placement-test.vercel.app https://api.qrserver.com${AI_BASE ? ' ' + AI_BASE : ''}`,
  `frame-src ${SELF} https://meet.jit.si https://*.jit.si https://www.youtube.com https://youtube.com https://api.moyasar.com https://miaar-placement-test.vercel.app`,
  `worker-src ${SELF} blob:`,
  `manifest-src ${SELF}`,
  `object-src 'none'`,
  `base-uri ${SELF}`,
  `form-action ${SELF} https://api.moyasar.com`,
  `upgrade-insecure-requests`,
  `report-uri /api/shield/csp`,
].join('; ');

const BASE = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(self "https://api.moyasar.com"), usb=(), browsing-topics=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
  { key: 'X-Shield', value: 'athar-p21' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      // صفحات قابلة للتضمين (التحقق من الشهادات + تأكيد الرسائل) — قبل القاعدة العامة
      { source: '/verify/:path*', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors *" }, { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }] },
      { source: '/m/:path*', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors *" }, { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }] },
      // API: لا تخزين افتراضيًا (المسارات العامة تضيف s-maxage بنفسها فتتغلب)
      { source: '/api/:path*', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
      { source: '/mcp/:path*', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
      { source: '/mcp', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
      { source: '/oauth/:path*', headers: [...BASE, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }] },
      // القاعدة العامة لكل الصفحات (باستثناء المسارات أعلاه — Next يطبّق كل القواعد المطابقة والأخيرة تغلب، لذا نستثني صراحة)
      { source: '/((?!verify(?:/|$)|m(?:/|$)|api/|mcp(?:/|$)|oauth/).*)', headers: [...BASE, { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" }, { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY }] },
    ];
  },
};

module.exports = nextConfig;
