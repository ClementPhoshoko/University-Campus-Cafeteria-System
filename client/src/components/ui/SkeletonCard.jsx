import Skeleton from './Skeleton.jsx';

export default function SkeletonCard({ image = true, lines = 2, badges = 1 }) {
  return (
    <div className="skeleton--card">
      {image && <Skeleton className="skeleton--image" />}
      <Skeleton className="skeleton--title" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className="skeleton--text" style={{ width: `${70 - i * 10}%` }} />
      ))}
      {badges > 0 && (
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: badges }, (_, i) => (
            <Skeleton key={i} className="skeleton--badge" />
          ))}
        </div>
      )}
    </div>
  );
}
