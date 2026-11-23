import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import BayanSession from '../../../components/kids/BayanSession';
import { SESSIONS, getSession } from '../../../../lib/kids/sessions';

export const dynamicParams = false;
export function generateStaticParams() { return SESSIONS.map(s => ({ session: s.slug })); }
export function generateMetadata({ params }: { params: { session: string } }): Metadata {
  const s = getSession(params.session);
  return { title: s ? `بَيان — الجلسة ${s.meta.order} «في ${s.meta.world}»` : 'بَيان', robots: { index: false, follow: false } };
}

/** بَيان (هـ-6-ج): أي جلسة تجريبية بمعرّفها (bayt · souq) */
export default function KidsDemoSessionPage({ params }: { params: { session: string } }) {
  const s = getSession(params.session);
  if (!s) notFound();
  return <BayanSession session={s} />;
}
