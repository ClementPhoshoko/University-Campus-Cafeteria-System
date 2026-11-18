import CustomDropdown from '../../components/ui/CustomDropdown.jsx';
import { makeVendorLocationOptions } from './vendorLocationSelection.js';
import './vendor-location-picker.css';

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
