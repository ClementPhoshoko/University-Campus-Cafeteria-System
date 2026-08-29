import { useState, useRef, useEffect } from 'react';
import { IconCheck, IconChevronDown, IconClock } from '@tabler/icons-react';
import './CustomDropdown.css';

export default function CustomDropdown({
  label,
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = 'Select...',
  error,
  disabled,
  showClockIcon = false,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (value) {
      if (multiple && Array.isArray(value)) {
        setSelectedOptions(value);
      } else {
        setSelectedOptions([value]);
      }
    } else {
      setSelectedOptions([]);
    }
  }, [value, multiple]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option) => {
    if (multiple) {
      const newSelection = selectedOptions.some((o) => o.id === option.id)
        ? selectedOptions.filter((o) => o.id !== option.id)
        : [...selectedOptions, option];
      setSelectedOptions(newSelection);
      onChange(newSelection);
    } else {
      setSelectedOptions([option]);
      onChange(option);
      setIsOpen(false);
    }
  };

  const displayValue = () => {
    if (selectedOptions.length === 0) return placeholder;
    if (multiple) {
      return selectedOptions.length === 1
        ? selectedOptions[0].name
        : `${selectedOptions.length} selected`;
    }
    return selectedOptions[0]?.name || placeholder;
  };

  return (
    <div className={`custom-dropdown${error ? ' custom-dropdown--error' : ''}${disabled ? ' custom-dropdown--disabled' : ''}`} ref={dropdownRef}>
      {label && <label className="custom-dropdown__label">{label}</label>}
      <button
        type="button"
        className={`custom-dropdown__trigger${isOpen ? ' custom-dropdown__trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span className={`custom-dropdown__value${selectedOptions.length === 0 ? ' custom-dropdown__value--placeholder' : ''}`}>
          {showClockIcon && selectedOptions.length > 0 && (
            <IconClock size={14} stroke={1.8} className="custom-dropdown__value-icon" />
          )}
          {displayValue()}
        </span>
        <IconChevronDown size={16} stroke={2} className={`custom-dropdown__icon${isOpen ? ' custom-dropdown__icon--open' : ''}`} />
      </button>

      {isOpen && (
        <div className="custom-dropdown__menu">
          {options.length === 0 ? (
            <div className="custom-dropdown__empty">No options available</div>
          ) : (
            options.map((option) => {
              const isSelected = selectedOptions.some((o) => o.id === option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`custom-dropdown__option${isSelected ? ' custom-dropdown__option--selected' : ''}${!option.available ? ' custom-dropdown__option--unavailable' : ''}`}
                  onClick={() => option.available && handleSelect(option)}
                  disabled={!option.available}
                >
                  <span className="custom-dropdown__option-left">
                    {showClockIcon && (
                      <IconClock size={14} stroke={1.8} className="custom-dropdown__option-icon" />
                    )}
                    <span className="custom-dropdown__option-name">
                      {option.name}
                      {option.timeRange && <span className="custom-dropdown__option-time"> - {option.timeRange}</span>}
                    </span>
                  </span>
                  <span className="custom-dropdown__option-right">
                    {option.available ? (
                      <span className="custom-dropdown__option-available">Available</span>
                    ) : (
                      <span className="custom-dropdown__option-unavailable">Still Busy</span>
                    )}
                    {option.priceDelta && option.priceDelta !== 'R0.00' && (
                      <span className="custom-dropdown__option-price">+{option.priceDelta}</span>
                    )}
                    {isSelected && <IconCheck size={16} stroke={2.5} className="custom-dropdown__check" />}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {error && <span className="custom-dropdown__error">{error}</span>}
    </div>
  );
}
