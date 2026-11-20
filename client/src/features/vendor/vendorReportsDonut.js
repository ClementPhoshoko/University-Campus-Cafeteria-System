const DONUT_RADIUS = 46;
const SEGMENT_GAP = 1.5;
const CIRCUMFERENCE = 2 * Math.PI * DONUT_RADIUS;

export function formatStatusPercentage(value) {
  const rounded = Math.round(Number(value || 0) * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

export function buildStatusSegments(breakdown = []) {
  const rows = (Array.isArray(breakdown) ? breakdown : [])
    .map((row) => ({
      status: row?.status || 'unknown',
      count: Math.max(0, Number(row?.count) || 0),
    }))
    .filter((row) => row.count > 0);

  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return { total: 0, segments: [] };

  const gap = rows.length > 1 ? SEGMENT_GAP : 0;
  let offset = 0;

  const segments = rows.map((row) => {
    const ratio = row.count / total;
    const segmentLength = Math.max(0.5, ratio * CIRCUMFERENCE - gap);
    const segment = {
      ...row,
      percentage: ratio * 100,
      strokeDasharray: `${segmentLength} ${CIRCUMFERENCE - segmentLength}`,
      strokeDashoffset: offset === 0 ? 0 : -offset,
    };
    offset += ratio * CIRCUMFERENCE;
    return segment;
  });

  return { total, segments };
}
