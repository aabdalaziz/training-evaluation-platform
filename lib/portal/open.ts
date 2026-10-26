// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
// بوابة أَثَر — الكتالوج المفتوح (P8-ج): تشكيل بيانات الكتالوج العام، JSON-LD (Course/Event/Organization/Person)، ملف المُصدِر (/.well-known/athar.json)
// دوال نقية بلا اعتماديات — تُستخدم في /api/catalog وصفحات البرنامج والجلسة والملف العام.
import { BRAND, CONTACT } from './content';
import type { CatalogProgram } from './catalog';
import { regState } from './catalog';

export const CATALOG_VERSION = '1.0';
export const DEFAULT_SITE = 'https://athar-portal.vercel.app';
/** يوحّد عنوان الموقع (بلا شرطة أخيرة) ويقبل قيمة بيئة أو أصل طلب */
export function normalizeSite(raw?: string | null): string { const s = String(raw || '').trim().replace(/\/+$/, ''); return /^https?:\/\/[^\s/]+$/i.test(s) ? s : DEFAULT_SITE; }
export function iso(d?: string | null): string | undefined { if (!d) return undefined; const x = new Date(d); return Number.isNaN(x.getTime()) ? undefined : x.toISOString(); }
export const stripNil = <T extends Record<string, unknown>>(o: T): T => { for (const k of Object.keys(o)) { const v = (o as any)[k]; if (v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)) delete (o as any)[k]; } return o; };

// ---------- المُصدِر / المنظمة ----------
export function organizationJsonLd(site: string) {
  return stripNil({
    '@context': 'https://schema.org', '@type': 'EducationalOrganization', '@id': `${site}/#organization`,
    name: BRAND.full.en, alternateName: [BRAND.full.ar, BRAND.name.ar, 'Athar', 'TRACE'], url: site, logo: `${site}/logos/gate.png`,
    description: BRAND.promise.en, slogan: BRAND.tagline.en, inLanguage: ['ar', 'en'],
    founder: { '@type': 'Person', name: BRAND.owner.en, alternateName: BRAND.owner.ar },
    address: { '@type': 'PostalAddress', addressLocality: 'Madinah', addressCountry: 'SA' },
    contactPoint: { '@type': 'ContactPoint', contactType: 'customer support', email: CONTACT.email, telephone: CONTACT.phone.replace(/\s+/g, ''), availableLanguage: ['Arabic', 'English'] },
    sameAs: CONTACT.social.map(s => s.href).filter(h => !/^https?:\/\/[^/]+\/?$/.test(h)),
    potentialAction: { '@type': 'SearchAction', target: `${site}/programs?q={search_term_string}`, 'query-input': 'required name=search_term_string' },
  });
}
/** ملف المُصدِر (Open Badges 3.0 Profile) المشار إليه في كل شهادة رقمية */
export function issuerProfile(site: string) {
  return {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json'],
    id: `${site}/.well-known/athar.json`, type: ['Profile'],
    name: BRAND.full.en, alternateName: BRAND.full.ar, url: site, email: CONTACT.email, image: `${site}/logos/gate.png`,
    description: 'Athar · TRACE issues verifiable digital credentials and skills profiles mapped to SAQF, SDAIA and CEFR. Verify any credential at /credential/<code>.',
    address: { type: ['Address'], addressCountry: 'SA', addressLocality: 'Madinah' },
    official: BRAND.owner.en, otherIdentifier: [{ type: ['IdentifierEntry'], identifier: 'athar-portal', identifierType: 'name' }],
    endorsement: [], _athar: { owner: BRAND.owner, operator: BRAND.legal, copyright: `© ${BRAND.copyrightYear} ${BRAND.owner.en}`, verify_url: `${site}/credential/{code}`, catalog: `${site}/api/catalog`, catalog_version: CATALOG_VERSION },
  };
}

// ---------- البرامج ----------
export type SkillLite = { id: string; code: string; name_ar: string; name_en: string; domain?: string; saqf_level?: number | null; cefr_level?: string | null; sdaia_code?: string | null };
export type SectorLite = { code: string; name_ar: string; name_en: string };
export type ProgramWithSector = CatalogProgram & { sector?: string | null };
export function courseMode(mode?: string | null): 'online' | 'onsite' | 'blended' { const m = String(mode || '').toLowerCase(); if (m.includes('remote') || m.includes('online')) return 'online'; if (m.includes('hybrid') || m.includes('blend')) return 'blended'; return 'onsite'; }
export function availability(state: string): string { return state === 'open' ? 'https://schema.org/InStock' : state === 'waitlist' ? 'https://schema.org/LimitedAvailability' : state === 'full' ? 'https://schema.org/SoldOut' : 'https://schema.org/Discontinued'; }
export function hoursDuration(h?: number | null): string | undefined { const n = Number(h); return n > 0 ? `PT${Math.round(n)}H` : undefined; }
const firstLine = (s?: string | null) => String(s || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean)[0] || '';
const linesOf = (s?: string | null) => String(s || '').split(/\r?\n/).map(x => x.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);

export function catalogProgram(p: ProgramWithSector, site: string, today: string, skills: SkillLite[] = [], sectors: SectorLite[] = [], counts?: { approved: number } | null) {
  const state = regState(p, today, counts ? { program_id: p.id, approved: counts.approved, pending: 0, waitlisted: 0 } : null);
  const sector = sectors.find(s => s.code === p.sector);
  return stripNil({
    id: p.id, url: `${site}/programs/${p.id}`, name: { ar: p.name_ar, en: p.name_en || undefined }, type: p.program_type || 'course', delivery: courseMode(p.delivery_mode),
    cefr_level: p.cefr_level || undefined, hours: p.hours || undefined, fee: p.fee === null || p.fee === undefined || p.fee === '' ? undefined : Number(p.fee), currency: (p.currency || 'SAR').toUpperCase(),
    start_date: p.start_date || undefined, end_date: p.end_date || undefined, location: { ar: p.location_ar || undefined, en: p.location_en || undefined },
    registration: { state, open: state === 'open' || state === 'waitlist', deadline: p.registration_deadline || undefined, seats: p.seats || undefined },
    summary: { ar: firstLine(p.intro_ar) || undefined, en: firstLine(p.intro_en) || undefined }, audience: { ar: p.audience_ar || undefined, en: p.audience_en || undefined },
    sector: sector ? { code: sector.code, name: { ar: sector.name_ar, en: sector.name_en } } : undefined,
    skills: skills.map(s => stripNil({ code: s.code, name: { ar: s.name_ar, en: s.name_en }, saqf_level: s.saqf_level || undefined, cefr_level: s.cefr_level || undefined, sdaia_code: s.sdaia_code || undefined })),
  });
}
export function courseJsonLd(p: ProgramWithSector, site: string, today: string, skills: SkillLite[] = [], counts?: { approved: number } | null) {
  const state = regState(p, today, counts ? { program_id: p.id, approved: counts.approved, pending: 0, waitlisted: 0 } : null);
  const fee = p.fee === null || p.fee === undefined || p.fee === '' ? null : Number(p.fee); const url = `${site}/programs/${p.id}`;
  const outcomes = linesOf(p.outcomes_ar); const objectives = linesOf(p.objectives_ar);
  return stripNil({
    '@context': 'https://schema.org', '@type': 'Course', '@id': url, url, name: p.name_en || p.name_ar, alternateName: p.name_en ? p.name_ar : undefined,
    description: firstLine(p.intro_en) || firstLine(p.intro_ar) || `${p.name_ar} — ${BRAND.full.ar}`, inLanguage: p.program_type === 'arabic' ? 'ar' : ['ar', 'en'],
    provider: { '@type': 'EducationalOrganization', '@id': `${site}/#organization`, name: BRAND.full.en, url: site },
    educationalLevel: p.cefr_level || undefined, teaches: skills.length ? skills.map(s => s.name_en || s.name_ar) : (outcomes.length ? outcomes : undefined), educationalCredentialAwarded: p.program_type === 'diploma' ? 'Diploma' : 'Certificate of completion (verifiable, Open Badges 3.0)',
    timeRequired: hoursDuration(p.hours), audience: p.audience_ar || p.audience_en ? { '@type': 'EducationalAudience', audienceType: p.audience_en || p.audience_ar } : undefined,
    about: objectives.length ? objectives.slice(0, 5) : undefined,
    offers: fee === null ? undefined : { '@type': 'Offer', price: fee, priceCurrency: (p.currency || 'SAR').toUpperCase(), availability: availability(state), url, validThrough: p.registration_deadline || undefined, category: fee === 0 ? 'Free' : 'Paid' },
    hasCourseInstance: p.start_date ? [stripNil({ '@type': 'CourseInstance', courseMode: courseMode(p.delivery_mode), startDate: p.start_date, endDate: p.end_date || undefined, courseWorkload: hoursDuration(p.hours),
      location: courseMode(p.delivery_mode) === 'online' ? { '@type': 'VirtualLocation', url } : (p.location_ar || p.location_en ? { '@type': 'Place', name: p.location_en || p.location_ar } : undefined) })] : undefined,
  });
}

// ---------- الجلسات ----------
export type SessionLite = { id: string; kind: string; title_ar: string; title_en?: string | null; description_ar?: string | null; description_en?: string | null; speaker_name?: string | null; starts_at: string; duration_min: number; provider: string; access: string; status: string; skills?: string[]; sector?: string | null; program_id?: string | null; capacity?: number | null; lang?: string | null; recording_url?: string | null };
export function sessionEnd(s: Pick<SessionLite, 'starts_at' | 'duration_min'>): string | undefined { const st = new Date(s.starts_at); if (Number.isNaN(st.getTime())) return undefined; return new Date(st.getTime() + Math.max(0, Number(s.duration_min) || 0) * 60000).toISOString(); }
export function catalogSession(s: SessionLite, site: string, skills: SkillLite[] = []) {
  return stripNil({ id: s.id, url: `${site}/live/${s.id}`, title: { ar: s.title_ar, en: s.title_en || undefined }, kind: s.kind, starts_at: iso(s.starts_at), ends_at: sessionEnd(s), duration_min: s.duration_min, provider: s.provider, access: s.access, status: s.status, speaker: s.speaker_name || undefined, lang: s.lang || 'ar', capacity: s.capacity || undefined, program_id: s.program_id || undefined, sector: s.sector || undefined, recording: !!s.recording_url, skills: skills.map(x => ({ code: x.code, name: { ar: x.name_ar, en: x.name_en } })) });
}
export function eventJsonLd(s: SessionLite, site: string, program?: { id: string; name_ar: string; name_en?: string | null } | null, skills: SkillLite[] = []) {
  const url = `${site}/live/${s.id}`; const statusMap: Record<string, string> = { scheduled: 'https://schema.org/EventScheduled', live: 'https://schema.org/EventScheduled', ended: 'https://schema.org/EventScheduled', cancelled: 'https://schema.org/EventCancelled' };
  return stripNil({
    '@context': 'https://schema.org', '@type': s.kind === 'workshop' ? 'EducationEvent' : 'Event', '@id': url, url, name: s.title_en || s.title_ar, alternateName: s.title_en ? s.title_ar : undefined,
    description: firstLine(s.description_en) || firstLine(s.description_ar) || undefined, startDate: iso(s.starts_at), endDate: sessionEnd(s), duration: s.duration_min ? `PT${Math.round(Number(s.duration_min))}M` : undefined,
    eventStatus: statusMap[s.status] || statusMap.scheduled, eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode', location: { '@type': 'VirtualLocation', url }, inLanguage: s.lang || 'ar',
    organizer: { '@type': 'EducationalOrganization', '@id': `${site}/#organization`, name: BRAND.full.en, url: site }, performer: s.speaker_name ? { '@type': 'Person', name: s.speaker_name } : undefined,
    isAccessibleForFree: s.access === 'public', maximumAttendeeCapacity: s.capacity || undefined, about: skills.length ? skills.map(x => x.name_en || x.name_ar) : undefined,
    superEvent: program ? { '@type': 'Course', '@id': `${site}/programs/${program.id}`, name: program.name_en || program.name_ar } : undefined,
    offers: s.access === 'public' ? { '@type': 'Offer', price: 0, priceCurrency: 'SAR', availability: s.status === 'cancelled' ? 'https://schema.org/Discontinued' : 'https://schema.org/InStock', url } : undefined,
  });
}

// ---------- الحقائب العامة ----------
export type ResourceLite = { id: string; slug?: string | null; title_ar: string; title_en?: string | null; summary_ar?: string | null; summary_en?: string | null; type: string; level: string; lang: string; sector?: string | null; skills?: string[]; ai_ready?: boolean; published_at?: string | null; downloads?: number; views?: number };
export function catalogResource(r: ResourceLite, site: string, skills: SkillLite[] = []) {
  return stripNil({ id: r.id, url: `${site}/resources/${r.id}`, title: { ar: r.title_ar, en: r.title_en || undefined }, summary: { ar: r.summary_ar || undefined, en: r.summary_en || undefined }, type: r.type, level: r.level, lang: r.lang, sector: r.sector || undefined, ai_ready: !!r.ai_ready, published_at: iso(r.published_at), downloads: r.downloads || 0, skills: skills.map(x => ({ code: x.code, name: { ar: x.name_ar, en: x.name_en } })) });
}

// ---------- الملف المهاري العام ----------
export type PublicProfileLite = { public_id: string; display_name?: string | null; headline?: string | null; city?: string | null; organization?: string | null; share_mode?: string; skills?: { code: string; name_ar: string; name_en: string; computed_level: number; approved_level?: number | null }[]; credentials?: { code: string; title_ar: string; title_en?: string | null; issued_at: string }[] };
export function personJsonLd(p: PublicProfileLite, site: string) {
  const url = `${site}/p/${p.public_id}`;
  return stripNil({
    '@context': 'https://schema.org', '@type': 'Person', '@id': url, url, name: p.display_name || 'Athar learner', jobTitle: p.headline || undefined, homeLocation: p.city ? { '@type': 'Place', name: p.city } : undefined, affiliation: p.organization ? { '@type': 'Organization', name: p.organization } : undefined,
    knowsAbout: (p.skills || []).map(s => s.name_en || s.name_ar),
    hasCredential: (p.credentials || []).map(c => ({ '@type': 'EducationalOccupationalCredential', name: c.title_en || c.title_ar, url: `${site}/credential/${c.code}`, dateCreated: c.issued_at.slice(0, 10), recognizedBy: { '@type': 'EducationalOrganization', '@id': `${site}/#organization`, name: BRAND.full.en } })),
  });
}

// ---------- غلاف الكتالوج ----------
export function catalogEnvelope(site: string, data: { programs: unknown[]; sessions: unknown[]; resources: unknown[]; sectors: SectorLite[]; skills: SkillLite[] }, generatedAt = new Date().toISOString()) {
  return {
    name: 'Athar · TRACE — Open Catalog', version: CATALOG_VERSION, generated_at: generatedAt, site, license: `© ${BRAND.copyrightYear} ${BRAND.owner.en} — catalog data may be indexed and displayed with attribution and a link back.`,
    issuer: `${site}/.well-known/athar.json`, organization: organizationJsonLd(site),
    links: { programs: `${site}/programs`, live: `${site}/live`, resources: `${site}/resources`, verify: `${site}/credential/{code}`, placement: BRAND.placementUrl, jsonld: `${site}/api/catalog?format=jsonld` },
    counts: { programs: data.programs.length, sessions: data.sessions.length, resources: data.resources.length, sectors: data.sectors.length, skills: data.skills.length },
    sectors: data.sectors.map(s => ({ code: s.code, name: { ar: s.name_ar, en: s.name_en } })),
    skills: data.skills.map(s => stripNil({ code: s.code, name: { ar: s.name_ar, en: s.name_en }, domain: s.domain, saqf_level: s.saqf_level || undefined, cefr_level: s.cefr_level || undefined, sdaia_code: s.sdaia_code || undefined })),
    programs: data.programs, sessions: data.sessions, resources: data.resources,
  };
}
export function catalogItemList(site: string, items: Record<string, unknown>[]) {
  return { '@context': 'https://schema.org', '@type': 'ItemList', '@id': `${site}/api/catalog?format=jsonld`, name: 'Athar · TRACE — Programs & events', numberOfItems: items.length, itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, item: it })) };
}
/** نص <script type="application/ld+json"> آمن (يمنع إغلاق الوسم) */
export function jsonLdScript(obj: unknown): string { return JSON.stringify(obj).replace(/</g, '\\u003c'); }
