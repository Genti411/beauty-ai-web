import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer style={{ borderTop: '1px solid #eee', marginTop: 48, padding: '16px', fontSize: 13, color: '#666', display: 'grid', gap: 6, textAlign: 'center' }}>
      <nav style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
      <p style={{ margin: 0 }}>
        Beauty AI may earn a commission from purchases made through links on this site.
      </p>
    </footer>
  );
}
