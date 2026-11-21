const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
];

export default function NotificationFilters({ value, onChange, unreadCount = 0 }) {
  return (
    <div className="notification-filters" role="group" aria-label="Filter notifications">
      {FILTERS.map((filter) => (
        <button
          key={filter.value}
          type="button"
          className={`notification-filter${value === filter.value ? ' is-active' : ''}`}
          aria-pressed={value === filter.value}
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
          {filter.value === 'unread' && unreadCount > 0 && (
            <span className="notification-filter__count">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>
      ))}
    </div>
  );
}
