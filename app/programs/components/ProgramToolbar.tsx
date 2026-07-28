'use client';

type Props = {
  search: string;
  onSearch: (value: string) => void;
};

export default function ProgramToolbar({
  search,
  onSearch,
}: Props) {
  return (
    <section
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 30,
        display: 'flex',
        gap: 16,
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 10px 25px rgba(15,23,42,.05)',
      }}
    >
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="🔍 ابحث عن برنامج..."
        style={{
          flex: 1,
          minWidth: 260,
          padding: 14,
          borderRadius: 12,
          border: '1px solid #cbd5e1',
          outline: 'none',
          fontSize: 16,
        }}
      />

      <button
        style={{
          background: '#14466B',
          color: '#fff',
          border: 0,
          borderRadius: 12,
          padding: '14px 22px',
          fontWeight: 800,
          cursor: 'pointer',
        }}
      >
        ➕ إنشاء برنامج
      </button>
    </section>
  );
}
