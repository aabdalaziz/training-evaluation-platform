'use client';

import ProgramStatusCard from './ProgramStatusCard';

const programs = [
  {
    name: 'برنامج تعليم اللغة العربية',
    participants: 126,
    trainers: 6,
    classrooms: 8,
    satisfaction: 96,
    status: 'ACTIVE' as const,
  },
  {
    name: 'برنامج الجودة والاعتماد',
    participants: 84,
    trainers: 4,
    classrooms: 5,
    satisfaction: 91,
    status: 'ACTIVE' as const,
  },
  {
    name: 'دبلوم إعداد المعلمين',
    participants: 42,
    trainers: 5,
    classrooms: 3,
    satisfaction: 94,
    status: 'DRAFT' as const,
  },
];

export default function ProgramDashboard() {
  return (
    <main
      style={{
        background: '#F4F7FB',
        minHeight: '100vh',
        padding: 30,
      }}
    >
      <div
        style={{
          maxWidth: 1400,
          margin: '0 auto',
        }}
      >
        <div
          style={{
            marginBottom: 40,
          }}
        >
          <h1
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 42,
              fontWeight: 900,
            }}
          >
            📚 مركز البرامج
          </h1>

          <p
            style={{
              color: '#64748b',
              marginTop: 12,
              fontSize: 18,
            }}
          >
            إدارة جميع البرامج التدريبية والدبلومات من مكان واحد.
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit,minmax(340px,1fr))',
            gap: 24,
          }}
        >
          {programs.map((program) => (
            <ProgramStatusCard
              key={program.name}
              {...program}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
