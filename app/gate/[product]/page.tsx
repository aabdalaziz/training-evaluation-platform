// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/* P79 */
/** /gate/<المنتج> — صفحة «تصريح الدخول»: تعريف قصير · تجربة دقيقتين · طلب تصريح · لديّ رمز · أنا من الطاقم/لديّ حساب. */
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GateClient from './GateClient';
import { DEFAULT_PRODUCTS, isSlug } from '../../../lib/portal/gate';

export const dynamic = 'force-dynamic';
export function generateMetadata({ params }: { params: { product: string } }): Metadata {
  const p = DEFAULT_PRODUCTS.find((x) => x.slug === params.product);
  return { title: `${p ? p.name_ar : 'تصريح الدخول'} — تصريح الدخول · أَثَر`, robots: { index: false, follow: false } };
}
export default function Page({ params, searchParams }: { params: { product: string }; searchParams: Record<string, string | undefined> }) {
  if (!isSlug(params.product)) notFound();
  return <GateClient slug={params.product} next={searchParams.next || null} expired={searchParams.expired === '1'} codeError={searchParams.code_error || null} />;
}
