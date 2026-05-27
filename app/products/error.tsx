'use client';

export default function ProductsError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main style={{ maxWidth: 960, margin: '32px auto', padding: '0 16px' }}>
      <h1>Products</h1>
      <p>We could not load products right now.</p>
      <button onClick={reset}>Try again</button>
    </main>
  );
}
