import type { Metadata } from 'next';
import BayanSession from '../../components/kids/BayanSession';

export const metadata: Metadata = { title: 'بَيان — الجلسة النموذجية «في السوق»', robots: { index: false, follow: false } };

/** بَيان (هـ-6-ب): وضع الطفل — شاشة كاملة بلا رأس البوّابة ولا الدليل */
export default function KidsDemoPage() { return <BayanSession />; }
