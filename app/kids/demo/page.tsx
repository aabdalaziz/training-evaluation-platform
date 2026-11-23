import type { Metadata } from 'next';
import BayanSession from '../../components/kids/BayanSession';
import { DEFAULT_SESSION } from '../../../lib/kids/sessions';

export const metadata: Metadata = { title: `بَيان — الجلسة ${DEFAULT_SESSION.meta.order} «في ${DEFAULT_SESSION.meta.world}»`, robots: { index: false, follow: false } };

/** بَيان (هـ-6-ج): وضع الطفل — الجلسة الأولى في المنهج (في البيت · حرف الألف). باقي الجلسات: /kids/demo/[session] */
export default function KidsDemoPage() { return <BayanSession session={DEFAULT_SESSION} />; }
