import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import Skeleton from '../../components/ui/Skeleton.jsx';
import { makeVendorLocationOptions } from './vendorLocationSelection.js';
import '../../components/cards/CardSkeletonShimmer.css';
import './vendor-location-picker.css';

export function VendorLocationPickerSkeleton({ className = '' }) {
  return (
    <div
      className={`vendor-location-picker vendor-location-picker--skeleton${className ? ` ${className}` : ''}`}
      role="status"
      aria-label="Loading pickup locations"
      aria-busy="true"
    >
      <div className="vendor-location-picker__copy" aria-hidden="true">
        <Skeleton className="vendor-location-picker__skeleton-title home_card-skeleton-shimmer" />
        <Skeleton className="vendor-location-picker__skeleton-text home_card-skeleton-shimmer" />
      </div>
      <Skeleton className="vendor-location-picker__skeleton-select home_card-skeleton-shimmer" aria-hidden="true" />
    </div>
  );
}

export default function VendorLocationPicker({ locations, value, onChange, className = '' }) {
  const options = makeVendorLocationOptions(locations);
  const selected = options.find((option) => option.id === value) || null;
  if (!options.length) return null;

  return (
    <div className={`vendor-location-picker${className ? ` ${className}` : ''}`}>
      <div className="vendor-location-picker__copy">
        <strong>Pickup location</strong>
        <span>Choose where you’ll collect this order.</span>
      </div>
      <CustomDropdown
        ariaLabel="Pickup location"
        placeholder="Choose a pickup location"
        options={options}
        value={selected}
        onChange={(option) => onChange(option.id)}
        showAvailabilityStatus={false}
      />
    </div>
  );
}
