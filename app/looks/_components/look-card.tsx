import type { SavedLook } from '@/lib/looks/looks';
import { deleteLookAction } from '../actions';

export function LookCard({ look }: { look: SavedLook }) {
  return (
    <article style={{ border: '1px solid #eee', borderRadius: 8, padding: 12, display: 'grid', gap: 8 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- signed URL, not next/image */}
      <img src={look.imageUrl} alt="Saved look" style={{ width: '100%', borderRadius: 6 }} />
      <p style={{ fontSize: 12, color: '#666' }}>
        Saved {new Date(look.createdAt).toLocaleString()}
      </p>
      <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 4 }}>
        {look.picks.map((p) => (
          <li key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 6, background: p.shade.hex }} />
            <span><strong>{p.brand}</strong> {p.name}</span>
            <a href={p.buyUrl} target="_blank" rel="sponsored nofollow noopener" style={{ marginLeft: 'auto' }}>
              Shop
            </a>
          </li>
        ))}
      </ul>
      <form action={deleteLookAction}>
        <input type="hidden" name="id" value={look.id} />
        <button type="submit">Delete this look</button>
      </form>
    </article>
  );
}
