import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { IconCheck, IconChevronDown, IconLoader2 } from '@tabler/icons-react';
import './AdminDropdown.css';

const DropdownOption = memo(function DropdownOption({ option, isSelected, isHighlighted, onSelect, onHover }) {
  return (
    <button
      type="button"
      className={`admin-dropdown__option${isSelected ? ' admin-dropdown__option--selected' : ''}${isHighlighted ? ' admin-dropdown__option--highlighted' : ''}`}
      onClick={onSelect}
      onMouseEnter={onHover}
      role="option"
      aria-selected={isSelected}
    >
      <span className="admin-dropdown__option-label">{option.label}</span>
      {isSelected && <IconCheck size={15} stroke={2.5} className="admin-dropdown__check" />}
    </button>
  );
});

export default function AdminDropdown({
  label,
  options = [],
  value = '',
  onChange,
  placeholder = 'Select...',
  disabled = false,
  loading = false,
  error = null,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const hasOpenedRef = useRef(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);

  if (isOpen) hasOpenedRef.current = true;

  const selectedOption = options.find((opt) => String(opt.value) === String(value));

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e) {
      if (triggerRef.current && !triggerRef.current.contains(e.target) && menuRef.current && !menuRef.current.contains(e.target)) {
        close();
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, close]);

  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const item = listRef.current.children[highlightedIndex];
      if (item) item.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

  const handleKeyDown = (e) => {
    if (disabled || loading) return;
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex(options.findIndex((opt) => String(opt.value) === String(value)));
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < options.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : options.length - 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && options[highlightedIndex]) {
          onChange(options[highlightedIndex].value);
          close();
        }
        break;
      case 'Tab':
        close();
        break;
      default:
        break;
    }
  };

  const handleSelect = useCallback((optionValue) => {
    onChange(optionValue);
    close();
  }, [onChange, close]);

  const displayLabel = selectedOption ? selectedOption.label : placeholder;
  const isPlaceholder = !selectedOption;

  return (
    <div className={`admin-dropdown${error ? ' admin-dropdown--error' : ''}${disabled ? ' admin-dropdown--disabled' : ''}`}>
      {label && <label className="admin-dropdown__label" htmlFor={id}>{label}</label>}
      <div className="admin-dropdown__wrapper" ref={triggerRef}>
        <button
          type="button"
          id={id}
          className={`admin-dropdown__trigger${isOpen ? ' admin-dropdown__trigger--open' : ''}`}
          onClick={() => !disabled && !loading && setIsOpen(!isOpen)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className={`admin-dropdown__value${isPlaceholder ? ' admin-dropdown__value--placeholder' : ''}`}>
            {loading ? (
              <span className="admin-dropdown__loading">
                <IconLoader2 size={14} stroke={2} className="admin-dropdown__spinner" />
                Loading...
              </span>
            ) : (
              displayLabel
            )}
          </span>
          {loading ? null : (
            <IconChevronDown size={16} stroke={2} className={`admin-dropdown__chevron${isOpen ? ' admin-dropdown__chevron--open' : ''}`} />
          )}
        </button>

        {hasOpenedRef.current && !loading && (
          <div
            className={`admin-dropdown__menu${isOpen ? '' : ' admin-dropdown__menu--hidden'}`}
            ref={menuRef}
            role="listbox"
          >
            <div className="admin-dropdown__list" ref={listRef}>
              {options.length === 0 ? (
                <div className="admin-dropdown__empty">No options available</div>
              ) : (
                options.map((option, index) => (
                  <DropdownOption
                    key={String(option.value)}
                    option={option}
                    isSelected={String(option.value) === String(value)}
                    isHighlighted={index === highlightedIndex}
                    onSelect={() => handleSelect(option.value)}
                    onHover={() => setHighlightedIndex(index)}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
      {error && <span className="admin-dropdown__error">{error}</span>}
    </div>
  );
}
