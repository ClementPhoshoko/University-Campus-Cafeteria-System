import CustomDropdown from '../../../components/ui/CustomDropdown.jsx';

/**
 * Paginated reference-data picker for sites and buildings.
 * Uses the shared CustomDropdown so the profile matches the vendor pages.
 * The server returns only active records; this wrapper never invents records.
 */
export default function LocationSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  clearLabel = 'Not set',
  loading = false,
  error,
  hasMore = false,
  onLoadMore,
  disabled = false,
  highlight = false,
  selectedLabel = '',
}) {
  const selectedOption = options.find((option) => option.id === value)
    || (value ? { id: value, name: selectedLabel || 'Current selection' } : null);
  const dropdownOptions = [
    { id: '', name: clearLabel, available: true },
    ...options.map((option) => ({ ...option, available: true })),
  ];

  return (
    <div className={`profile_input-field${highlight ? ' profile_location-select--active' : ''}`}>
      <CustomDropdown
        label={label}
        ariaLabel={label}
        placeholder={placeholder}
        options={dropdownOptions}
        value={selectedOption}
        onChange={(option) => onChange(option?.id || null, option?.name || '')}
        loading={loading}
        error={error}
        disabled={disabled}
        showAvailabilityStatus={false}
      />
      {hasMore && (
        <button type="button" className="profile_link-button" onClick={onLoadMore} disabled={loading}>
          Load more options
        </button>
      )}
    </div>
  );
}
