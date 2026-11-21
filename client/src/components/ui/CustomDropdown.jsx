import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { IconCheck, IconChevronDown, IconClock, IconLoader2 } from '@tabler/icons-react';
import './CustomDropdown.css';

const MENU_GAP = 8;
const VIEWPORT_MARGIN = 8;
const MAX_MENU_HEIGHT = 320;
const MIN_MENU_HEIGHT = 96;

export default function CustomDropdown({
  label,
  ariaLabel,
  options = [],
  value,
  onChange,
  multiple = false,
  placeholder = 'Select...',
  error,
  disabled,
  loading = false,
  showClockIcon = false,
  showAvailabilityStatus = true,
  onOpen,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [menuPlacement, setMenuPlacement] = useState('bottom');
  const [menuMaxHeight, setMenuMaxHeight] = useState(null);
  const dropdownRef = useRef(null);
  const menuRef = useRef(null);

  const updateMenuPosition = useCallback(() => {
    if (!isOpen || !dropdownRef.current || !menuRef.current) return;

    const dropdownRect = dropdownRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const spaceBelow = viewportHeight - dropdownRect.bottom - MENU_GAP - VIEWPORT_MARGIN;
    const spaceAbove = dropdownRect.top - MENU_GAP - VIEWPORT_MARGIN;
    const desiredHeight = Math.min(menuRef.current.scrollHeight || MAX_MENU_HEIGHT, MAX_MENU_HEIGHT);

    let placement = 'bottom';
    let availableSpace = spaceBelow;
    if (spaceBelow < desiredHeight && spaceAbove > spaceBelow) {
      placement = 'top';
      availableSpace = spaceAbove;
    }

    const nextMaxHeight = Math.min(desiredHeight, Math.max(MIN_MENU_HEIGHT, availableSpace));
    setMenuPlacement((current) => (current === placement ? current : placement));
    setMenuMaxHeight((current) => (current === nextMaxHeight ? current : nextMaxHeight));
  }, [isOpen]);

  useLayoutEffect(() => {
    updateMenuPosition();
  }, [updateMenuPosition, options.length, loading]);

  useEffect(() => {
    if (!isOpen) return undefined;

    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isOpen, updateMenuPosition]);

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

  const handleTriggerClick = () => {
    if (disabled || loading) return;
    const opening = !isOpen;
    setIsOpen(opening);
    if (opening) {
      setMenuPlacement('bottom');
      setMenuMaxHeight(null);
      onOpen?.();
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
  const triggerLabel = loading ? 'Loading options' : displayValue();

  return (
    <div className={`custom-dropdown${error ? ' custom-dropdown--error' : ''}${disabled ? ' custom-dropdown--disabled' : ''}${loading ? ' custom-dropdown--loading' : ''}`} ref={dropdownRef}>
      {label && <label className="custom-dropdown__label">{label}</label>}
      <button
        type="button"
        className={`custom-dropdown__trigger${isOpen ? ' custom-dropdown__trigger--open' : ''}`}
        aria-label={ariaLabel ? `${ariaLabel}: ${triggerLabel}` : undefined}
        title={triggerLabel}
        onClick={handleTriggerClick}
        disabled={disabled || loading}
      >
        <span className={`custom-dropdown__value${selectedOptions.length === 0 ? ' custom-dropdown__value--placeholder' : ''}`}>
          {loading ? (
            <span className="custom-dropdown__loading">
              <IconLoader2 size={14} stroke={2} className="custom-dropdown__spinner" />
              Loading...
            </span>
          ) : (
            <>
              {showClockIcon && selectedOptions.length > 0 && (
                <IconClock size={14} stroke={1.8} className="custom-dropdown__value-icon" />
              )}
              <span className="custom-dropdown__value-label">{displayValue()}</span>
            </>
          )}
        </span>
        {!loading && <IconChevronDown size={16} stroke={2} className={`custom-dropdown__icon${isOpen ? ' custom-dropdown__icon--open' : ''}`} />}
      </button>

      {isOpen && !loading && (
        <div
          ref={menuRef}
          className={`custom-dropdown__menu custom-dropdown__menu--${menuPlacement}`}
          style={{ '--custom-dropdown-menu-max-height': menuMaxHeight ? `${menuMaxHeight}px` : undefined }}
        >
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
                  title={option.name}
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
                    {showAvailabilityStatus && (option.available ? (
                      <span className="custom-dropdown__option-available">Available</span>
                    ) : (
                      <span className="custom-dropdown__option-unavailable">Still Busy</span>
                    ))}
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
