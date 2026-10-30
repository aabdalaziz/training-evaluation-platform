'use client';
// © 2026 Dr. Ahmed Mohamed Abdelaziz Badawi — All rights reserved. See COPYRIGHT.md
/** /trainers — هيئة أَثَر للمدربين (P31): بحث عام في المعتمدين المدرجين · لا نجوم ولا ترتيب تفضيلي · الطلب عبر أَثَر */
import { PortalShell } from '../components/PortalShell';
import { DirectoryList } from '../components/Directory';

export default function Page() { return <PortalShell><DirectoryList face="trainer" /></PortalShell>; }
