'use client';

export default function TryOnError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 880, margin: '32px auto', padding: '0 16px' }}>
      <h1>Virtual Try-On</h1>
      <p>We could not load try-on right now.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
