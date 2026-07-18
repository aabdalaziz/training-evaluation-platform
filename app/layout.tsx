import type { Metadata } from 'next';import './style.css';
export const metadata:Metadata={title:'منصة تقويم البرامج التدريبية',description:'Training Evaluation Platform'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ar" dir="rtl"><body>{children}</body></html>}
