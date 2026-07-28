'use client';

type ProgramCardProps = {
  nameAr: string;
  nameEn?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  startDate?: string | null;
  endDate?: string | null;

  classrooms?: number;
  trainers?: number;
  participants?: number;
  rating?: number;

  onEdit?: () => void;
  onReports?: () => void;
  onEvaluation?: () => void;
};

const STATUS = {
  DRAFT: {
    label: 'مسودة',
    color: '#64748b',
    bg: '#f1f5f9',
  },
  ACTIVE: {
    label: 'نشط',
    color: '#047857',
    bg: '#dcfce7',
  },
  COMPLETED: {
    label: 'مكتمل',
    color: '#1d4ed8',
    bg: '#dbeafe',
  },
  CANCELLED: {
    label: 'ملغي',
    color: '#b91c1c',
    bg: '#fee2e2',
  },
};

export default function ProgramCard(props: ProgramCardProps) {
  const s = STATUS[props.status];

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 20,
        padding: 22,
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 20,
          marginBottom: 18,
        }}
      >
        <div>
          <h3
            style={{
              margin: 0,
              color: '#14466B',
              fontSize: 22,
              fontWeight: 900,
            }}
          >
            {props.nameAr}
          </h3>

          {props.nameEn && (
            <div
              style={{
                color: '#64748b',
                marginTop: 6,
                fontSize: 14,
              }}
            >
              {props.nameEn}
            </div>
          )}
        </div>

        <span
          style={{
            background: s.bg,
            color: s.color,
            padding: '8px 14px',
            borderRadius: 20,
            fontWeight: 800,
            fontSize: 13,
          }}
        >
          {s.label}
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,minmax(120px,1fr))',
          gap: 12,
          marginBottom: 20,
        }}
      >
        <Info title="🏫 القاعات" value={props.classrooms ?? 0} />

        <Info title="👨‍🏫 المدربون" value={props.trainers ?? 0} />

        <Info title="👨‍🎓 المشاركون" value={props.participants ?? 0} />

        <Info
          title="⭐ متوسط الرضا"
          value={
            props.rating
              ? props.rating.toFixed(2)
              : '--'
          }
        />
      </div>

      <div
        style={{
          color: '#64748b',
          fontSize: 13,
          marginBottom: 18,
        }}
      >
        {props.startDate || '—'}
        {'  '}
        {props.endDate && `→ ${props.endDate}`}
      </div>

      <div
        style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <Action
          text="✏️ تعديل"
          onClick={props.onEdit}
        />

        <Action
          text="📊 التقارير"
          onClick={props.onReports}
        />

        <Action
          text="📝 التقييمات"
          onClick={props.onEvaluation}
        />
      </div>
    </div>
  );
}

function Info({
  title,
  value,
}: {
  title: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: '#f8fafc',
        borderRadius: 12,
        padding: 14,
      }}
    >
      <div
        style={{
          color: '#64748b',
          fontSize: 12,
          marginBottom: 6,
        }}
      >
        {title}
      </div>

      <div
        style={{
          color: '#14466B',
          fontWeight: 900,
          fontSize: 22,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Action({
  text,
  onClick,
}: {
  text: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: 0,
        cursor: 'pointer',
        borderRadius: 12,
        padding: '10px 18px',
        background: '#14466B',
        color: '#fff',
        fontWeight: 800,
        fontSize: 13,
      }}
    >
      {text}
    </button>
  );
}
