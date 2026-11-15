// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/**
 * robots.txt (النطاق الرسمي athar-portal.com — 2026-11-15)
 *  يُفهرَس العامّ فقط؛ ومساحات المتعلّم والإدارة والواجهات البرمجية والتحقّق خارج الفهرسة
 *  (روابط التحقّق تُفتح برمزها ولا تُكتشف من محرّك بحث — خصوصية حاملها).
 */
import type { MetadataRoute } from 'next';
import { normalizeSite } from '../lib/portal/open';

export default function robots(): MetadataRoute.Robots {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/api/', '/admin/', '/me/', '/org/', '/dashboard', '/reports/', '/command-center', '/verify/', '/e/', '/m/', '/p/', '/oauth/', '/mcp', '/miaar/result/', '/miaar/d/', '/miaar/client/', '/miaar/certificate/', '/miaar/growth/', '/miaar/practice/'] }],
    sitemap: `${site}/sitemap.xml`,
    host: site,
  };
}
