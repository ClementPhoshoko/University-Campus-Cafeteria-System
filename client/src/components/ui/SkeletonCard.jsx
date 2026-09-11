import Skeleton from './Skeleton.jsx';

export default function SkeletonCard({ image = true, lines = 2, badges = 1 }) {
  return (
    <div className="skeleton--card">
      {image && <Skeleton className="skeleton--image" />}
      <div className="skeleton--card-body">
        <div className="skeleton--card-header">
          <Skeleton className="skeleton--title" style={{ width: '65%', height: 18 }} />
          <Skeleton className="skeleton--badge" style={{ width: 60, height: 22, borderRadius: 100 }} />
        </div>
        <Skeleton className="skeleton--text" style={{ width: '80%', height: 14 }} />
        <div className="skeleton--card-stats">
          <Skeleton className="skeleton--stat-box" />
          <Skeleton className="skeleton--stat-box" />
          <Skeleton className="skeleton--stat-box" />
        </div>
        <div className="skeleton--card-footer">
          <Skeleton className="skeleton--text" style={{ width: 90, height: 12 }} />
          <Skeleton className="skeleton--text" style={{ width: 110, height: 12 }} />
        </div>
      </div>
    </div>
  );
}
