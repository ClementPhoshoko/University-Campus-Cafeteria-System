import Skeleton from './Skeleton.jsx';

export default function SkeletonTable({ rows = 5, columns = 4, header = true }) {
  return (
    <div className="skeleton--stat">
      {header && (
        <div className="skeleton--table-row" style={{ borderBottom: '1px solid var(--color-border-default)' }}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="skeleton--text" style={{ flex: 1, height: 10 }} />
          ))}
        </div>
      )}
      {Array.from({ length: rows }, (_, rowIdx) => (
        <div key={rowIdx} className="skeleton--table-row">
          {Array.from({ length: columns }, (_, colIdx) => (
            <Skeleton
              key={colIdx}
              className="skeleton--text"
              style={{ flex: 1, height: 12, width: colIdx === 0 ? '60%' : undefined }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
