import { useState, useRef, useEffect, useCallback } from 'react';
import { IconMapPin, IconSearch, IconLoader2 } from '@tabler/icons-react';
import { geocodeAutocomplete, geocodeResolve } from '../../services/adminApi.js';
import './AddressAutocomplete.css';

/**
 * Reusable address autocomplete input with Google Places suggestions.
 *
 * Props:
 * - value: string (current display value)
 * - onChange: function(value) - called when user types
 * - onSelect: function(locationData) - called when user selects a suggestion
 *   locationData contains: { street_address, city, province, postal_code, country,
 *     latitude, longitude, timezone, place_id, formatted_address }
 * - token: string (auth token)
 * - placeholder: string
 * - disabled: boolean
 * - error: string
 */
export default function AddressAutocomplete({
  value = '',
  onChange,
  onSelect,
  token,
  placeholder = 'Search for an address...',
  disabled = false,
  error,
}) {
  const [inputValue, setInputValue] = useState(value);
  const [predictions, setPredictions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const debounceRef = useRef(null);
  const sessionTokenRef = useRef(null);

  // Generate a session token for billing optimization
  useEffect(() => {
    sessionTokenRef.current = crypto.randomUUID?.() || Math.random().toString(36).slice(2);
  }, []);

  // Sync external value changes
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        inputRef.current &&
        !inputRef.current.contains(event.target)
      ) {
        setIsOpen(false);
        setPredictions([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchPredictions = useCallback(
    async (query) => {
      if (!query || query.length < 2 || !token) {
        setPredictions([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const response = await geocodeAutocomplete(token, query, sessionTokenRef.current);
        setPredictions(response.predictions || []);
        setIsOpen(true);
        setHighlightedIndex(-1);
      } catch {
        setPredictions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [token]
  );

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange?.(newValue);

    // Debounce API calls
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPredictions(newValue);
    }, 300);
  };

  const handleSelect = async (prediction) => {
    setInputValue(prediction.main_text);
    setIsOpen(false);
    setPredictions([]);
    setIsLoading(true);

    try {
      const response = await geocodeResolve(token, { place_id: prediction.place_id });
      onSelect?.(response.location);
    } catch {
      // If resolve fails, still pass basic data from prediction
      onSelect?.({
        place_id: prediction.place_id,
        formatted_address: prediction.description,
        street_address: prediction.main_text,
        city: prediction.secondary_text || null,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (!isOpen || !predictions.length) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < predictions.length - 1 ? prev + 1 : 0));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : predictions.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < predictions.length) {
          handleSelect(predictions[highlightedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setPredictions([]);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  return (
    <div className={`address-autocomplete${error ? ' address-autocomplete--error' : ''}`} ref={dropdownRef}>
      <div className="address-autocomplete__input-wrapper">
        <IconMapPin size={16} stroke={1.6} className="address-autocomplete__icon" />
        <input
          ref={inputRef}
          type="text"
          className="address-autocomplete__input"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => predictions.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        {isLoading && (
          <IconLoader2 size={16} stroke={2} className="address-autocomplete__spinner" />
        )}
      </div>

      {isOpen && predictions.length > 0 && (
        <div className="address-autocomplete__dropdown">
          {predictions.map((prediction, index) => (
            <button
              key={prediction.place_id}
              type="button"
              className={`address-autocomplete__option${
                index === highlightedIndex ? ' address-autocomplete__option--highlighted' : ''
              }`}
              onClick={() => handleSelect(prediction)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <IconSearch size={14} stroke={1.6} className="address-autocomplete__option-icon" />
              <div className="address-autocomplete__option-text">
                <span className="address-autocomplete__option-main">{prediction.main_text}</span>
                {prediction.secondary_text && (
                  <span className="address-autocomplete__option-secondary">
                    {prediction.secondary_text}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {error && <span className="address-autocomplete__error">{error}</span>}
    </div>
  );
}
