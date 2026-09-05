export function parsePagination(query, { maxLimit = 100, defaultLimit = 20 } = {}) {
  const pageNum = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limitNum = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
  const from = (pageNum - 1) * limitNum;
  const to = from + limitNum - 1;
  return { pageNum, limitNum, from, to };
}

export function buildPagination(count, pageNum, limitNum) {
  return {
    page: pageNum,
    limit: limitNum,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limitNum),
  };
}