import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { createPortal } from 'react-dom';
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
  multiSelect = false,
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [menuPos, setMenuPos] = useState(null);
  const [openUp, setOpenUp] = useState(false);
  const hasOpenedRef = useRef(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const listRef = useRef(null);
  const isOpenRef = useRef(false);
  const menuPosRef = useRef({ top: 0, left: 0, width: 0 });

  if (isOpen) hasOpenedRef.current = true;
  isOpenRef.current = isOpen;

  const selectedValues = multiSelect && Array.isArray(value) ? value.map(String) : [];
  const selectedOption = multiSelect
    ? null
    : options.find((opt) => String(opt.value) === String(value));

  const close = useCallback(() => {
    setIsOpen(false);
    setHighlightedIndex(-1);
  }, []);

  const positionMenu = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const rect = trigger.getBoundingClientRect();
    const menuHeight = menu.offsetHeight;
    const gap = 6;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const shouldOpenUp = menuHeight + gap > spaceBelow && spaceAbove > spaceBelow;
    const top = shouldOpenUp ? Math.max(8, rect.top - menuHeight - gap) : Math.min(rect.bottom + gap, window.innerHeight - 8);
    const next = { top, left: rect.left, width: rect.width };
    const prevTop = menuPosRef.current.top;
    setOpenUp(shouldOpenUp);
    if (next.top !== prevTop || next.left !== menuPosRef.current.left || next.width !== menuPosRef.current.width) {
      menuPosRef.current = next;
      setMenuPos(next);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    positionMenu();
    const raf = requestAnimationFrame(() => positionMenu());
    const handleScroll = () => positionMenu();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [isOpen, positionMenu]);

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
        setHighlightedIndex(options.findIndex((opt) => (
          multiSelect
            ? selectedValues.includes(String(opt.value))
            : String(opt.value) === String(value)
        )));
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
          handleSelect(options[highlightedIndex].value);
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
    if (multiSelect) {
      const optionKey = String(optionValue);
      const currentValues = Array.isArray(value) ? value : [];
      onChange(currentValues.some((current) => String(current) === optionKey)
        ? currentValues.filter((current) => String(current) !== optionKey)
        : [...currentValues, optionValue]);
      return;
    }
    onChange(optionValue);
    close();
  }, [multiSelect, onChange, close, value]);

  const displayLabel = multiSelect
    ? selectedValues.length === 1
      ? options.find((option) => String(option.value) === selectedValues[0])?.label || placeholder
      : selectedValues.length > 1 ? `${selectedValues.length} selected` : placeholder
    : selectedOption?.label || placeholder;
  const isPlaceholder = multiSelect ? selectedValues.length === 0 : !selectedOption;

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

        {hasOpenedRef.current && !loading && createPortal(
          <div
            className={`admin-dropdown__menu${isOpen ? '' : ' admin-dropdown__menu--hidden'}${isOpen && openUp ? ' admin-dropdown__menu--up' : ''}`}
            ref={menuRef}
            role="listbox"
            aria-multiselectable={multiSelect || undefined}
            style={menuPos ? { position: 'fixed', top: menuPos.top, left: menuPos.left, width: menuPos.width } : { position: 'fixed', top: -9999, left: 0 }}
          >
            <div className="admin-dropdown__list" ref={listRef}>
              {options.length === 0 ? (
                <div className="admin-dropdown__empty">No options available</div>
              ) : (
                options.map((option, index) => (
                  <DropdownOption
                    key={String(option.value)}
                    option={option}
                    isSelected={multiSelect
                      ? selectedValues.includes(String(option.value))
                      : String(option.value) === String(value)}
                    isHighlighted={index === highlightedIndex}
                    onSelect={() => handleSelect(option.value)}
                    onHover={() => setHighlightedIndex(index)}
                  />
                ))
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
      {error && <span className="admin-dropdown__error">{error}</span>}
    </div>
  );
}
