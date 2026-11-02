// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** P43-ب «أَثَر الواحد»: كل ما تحت /reports غرفة في «مركز قيادة أَثَر» — الغلاف يضيف شريط الغرفة والحارس والتذييل دون تعديل الصفحات */
import { AdminShell } from '../components/AdminShell';
export default function Layout({ children }: { children: React.ReactNode }) { return <AdminShell>{children}</AdminShell>; }
