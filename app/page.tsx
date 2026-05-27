import Link from 'next/link';

export default function Home() {
  return (
    <main style={{ maxWidth: 560, margin: '96px auto', display: 'grid', gap: 16 }}>
      <h1>Beauty AI</h1>
      <p>Try on makeup looks and get personalized recommendations.</p>
      <Link href="/login">Log in</Link>
    </main>
  );
}
