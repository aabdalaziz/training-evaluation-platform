/**
 * /student — المسار القديم لبوّابة المتعلّم → يحوّل إلى البوّابة الجديدة /me
 * (الروابط ورموز QR المطبوعة سابقًا تبقى صالحة)
 */
import { redirect } from 'next/navigation';

export default function StudentRedirect() {
  redirect('/me');
}
