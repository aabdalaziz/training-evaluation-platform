// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** sitemap.xml — الصفحات العامّة الثابتة فقط (لا روابط برموز ولا صفحات متعلّمين). */
import type { MetadataRoute } from 'next';
import { normalizeSite } from '../lib/portal/open';

export const PUBLIC_PATHS: { path: string; priority: number }[] = [
  { path: '/', priority: 1 }, { path: '/programs', priority: 0.9 }, { path: '/miaar', priority: 0.9 }, { path: '/about', priority: 0.7 },
  { path: '/live', priority: 0.7 }, { path: '/observatory', priority: 0.6 }, { path: '/on-air', priority: 0.6 }, { path: '/2062', priority: 0.5 },
  { path: '/agents', priority: 0.5 }, { path: '/security', priority: 0.4 }, { path: '/privacy', priority: 0.4 }, { path: '/contact', priority: 0.4 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const site = normalizeSite(process.env.NEXT_PUBLIC_SITE_URL);
  const lastModified = new Date();
  return PUBLIC_PATHS.map(p => ({ url: `${site}${p.path}`, lastModified, changeFrequency: p.path === '/' ? 'daily' : 'weekly', priority: p.priority }));
}
