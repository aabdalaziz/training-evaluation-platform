'use client';

type Props = {
  name: string;
  participants: number;
  trainers: number;
  classrooms: number;
  satisfaction: number;
  status: 'ACTIVE' | 'DRAFT' | 'COMPLETED';
};

const colors = {
  ACTIVE: '#3F7F79',
  DRAFT: '#D9A866',
  COMPLETED: '#8E4A68',
};

export default function ProgramStatusCard(props: Props) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 24,
        padding: 24,
        borderTop: `6px solid ${colors[props.status]}`,
        boxShadow: '0 12px 30px rgba(42,22,38,.05)',
      }}
    >
      <h2
        style={{
          margin: 0,
          color: '#3A1F36',
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        {props.name}
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2,1fr)',
          gap: 16,
          marginTop: 24,
        }}
      >
        <Item label="المشاركون" value={props.participants} />
        <Item label="المدرّبون" value={props.trainers} />
        <Item label="الشُّعب" value={props.classrooms} />
        <Item label="الرضا" value={`${props.satisfaction}%`} />
      </div>

      <button
        style={{
          marginTop: 24,
          width: '100%',
          border: 0,
          borderRadius: 14,
          background: '#3A1F36',
          color: '#fff',
          padding: 14,
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        فتح مركز البرنامج
      </button>
    </div>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        background: '#FBF4EE',
        borderRadius: 14,
        padding: 16,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: '#8E7F8A',
          fontSize: 13,
        }}
      >
        {label}
      </div>

      <div
        style={{
          marginTop: 8,
          color: '#3A1F36',
          fontWeight: 900,
          fontSize: 28,
        }}
      >
        {value}
      </div>
    </div>
  );
}
