export default function PortalFooter() {
  return (
    <footer
      style={{
        marginTop: 70,
        padding: '40px 20px',
        background: '#14466B',
        color: '#fff',
        textAlign: 'center',
      }}
    >
      <h3
        style={{
          margin: 0,
          fontWeight: 900,
        }}
      >
        🏛 بوابة التميز للتعليم والتطوير
      </h3>

      <p
        style={{
          marginTop: 14,
          opacity: 0.9,
        }}
      >
        Excellence Portal for Education & Development
      </p>

      <p
        style={{
          marginTop: 25,
          opacity: 0.75,
          fontSize: 14,
        }}
      >
        © {new Date().getFullYear()} جميع الحقوق محفوظة
      </p>
    </footer>
  );
}
