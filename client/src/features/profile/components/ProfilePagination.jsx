export default function ProfilePagination({ pagination, onPrevious, onNext, disabled = false }) {
  const page = Number(pagination?.page || 1);
  const totalPages = Math.max(1, Number(pagination?.totalPages || 1));
  if (totalPages <= 1) return null;

  return (
    <div className="profile_pagination" aria-label="Favourite list pages">
      <button type="button" className="profile_link-button" onClick={onPrevious} disabled={disabled || page <= 1}>
        Previous
      </button>
      <span className="profile_pagination-label">Page {page} of {totalPages}</span>
      <button type="button" className="profile_link-button" onClick={onNext} disabled={disabled || page >= totalPages}>
        Next
      </button>
    </div>
  );
}
