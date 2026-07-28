'use client';

import DashboardHeader from "../layout/DashboardHeader";
import DashboardHome from "./DashboardHome";
import SystemHealthCard from "../cards/SystemHealthCard";

type Props = {
  profile: {
    full_name: string;
    role: string;
  };

  programs: any[];

  stats: {
    daily: number;
    final: number;
    avg: number;
  };

  onRefresh?: () => void;
};

export default function CommandCenter({
  profile,
  programs,
  stats,
  onRefresh,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
      }}
    >
      <DashboardHeader
        userName={profile.full_name}
        role={profile.role}
        onRefresh={onRefresh}
      />

      <SystemHealthCard
        status="healthy"
        items={[
          "جميع البرامج مرتبطة بقوالب التقييم",
          "جميع خدمات المنصة تعمل بصورة طبيعية",
          "لا توجد أخطاء في إرسال التقييمات",
          "آخر نسخة احتياطية تمت بنجاح",
        ]}
      />

      <DashboardHome
        programs={programs}
        stats={stats}
      />
    </div>
  );
}
