// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P43-ب «أَثَر الواحد»: لوحة القيادة تملك قائمتها الجانبية بهوية أَثَر — الغلاف هنا حارسٌ فقط (bare) */
import { AdminShell } from '../components/AdminShell';
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminShell bare>{children}</AdminShell>; }
