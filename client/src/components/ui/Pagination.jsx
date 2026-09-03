import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import './Pagination.css';

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  itemsPerPage = 10,
  label = 'items',
  onPageChange,
}) {
  if (totalPages <= 1 && totalItems <= itemsPerPage) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const getVisiblePages = () => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
    if (currentPage <= 4) return [1, 2, 3, 4, 5, '...', totalPages];
    if (currentPage >= totalPages - 3) return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  return (
    <nav className="pagination" aria-label="Pagination">
      <div className="pagination__info">
        <span className="pagination__info-text">
          Showing {startItem} to {endItem} of {totalItems} {label}
        </span>
      </div>

      <div className="pagination__controls">
        <button
          type="button"
          className="pagination__btn pagination__btn--prev"
          onClick={() => onPageChange?.(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <IconChevronLeft size={16} stroke={2} />
        </button>

        <div className="pagination__pages">
          {getVisiblePages().map((page, index) =>
            page === '...' ? (
              <span key={`ellipsis-${index}`} className="pagination__ellipsis">...</span>
            ) : (
              <button
                key={page}
                type="button"
                className={`pagination__page${currentPage === page ? ' pagination__page--active' : ''}`}
                onClick={() => onPageChange?.(page)}
                aria-label={`Page ${page}`}
                aria-current={currentPage === page ? 'page' : undefined}
              >
                {page}
              </button>
            )
          )}
        </div>

        <button
          type="button"
          className="pagination__btn pagination__btn--next"
          onClick={() => onPageChange?.(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <IconChevronRight size={16} stroke={2} />
        </button>
      </div>
    </nav>
  );
}
