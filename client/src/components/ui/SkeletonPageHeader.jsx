import Skeleton from './Skeleton.jsx';

export default function SkeletonPageHeader({ stats = 3 }) {
  return (
    <>
      <div className="skeleton--page-header">
        <Skeleton className="skeleton--text" style={{ width: '30%', height: 10 }} />
        <Skeleton className="skeleton--title" style={{ width: '45%' }} />
        <Skeleton className="skeleton--subtitle" style={{ width: '60%' }} />
      </div>
      {stats > 0 && (
        <div className="skeleton--kpi-row">
          {Array.from({ length: stats }, (_, i) => (
            <div key={i} className="skeleton--stat">
              <Skeleton className="skeleton--text" style={{ width: '50%', height: 10 }} />
              <Skeleton className="skeleton--title" style={{ width: '35%' }} />
            </div>
          ))}
        </div>
      )}
    </>
  );
}
