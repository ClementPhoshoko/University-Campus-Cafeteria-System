import { IconClock, IconCheck } from '@tabler/icons-react';
import './CollectionSlotPicker.css';

export default function CollectionSlotPicker({ slots, selectedSlot, onSelectSlot }) {
  const selectedSlotData = slots.find(s => s.id === selectedSlot);
  const totalSlots = slots.length;

  const getDotPosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const radius = 70;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    return { x, y };
  };

  return (
    <div className="collection-slot-picker">
      <div className="collection-slot-picker__header">
        <h2 className="collection-slot-picker__title">
          <IconClock size={16} stroke={1.8} />
          Pick-up Time
        </h2>
      </div>

      <div className="collection-slot-picker__body">
        <div className="collection-slot-picker__list">
          {slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={`collection-slot-picker__item${selectedSlot === slot.id ? ' collection-slot-picker__item--selected' : ''}${!slot.available ? ' collection-slot-picker__item--unavailable' : ''}`}
              onClick={() => slot.available && onSelectSlot(slot.id)}
              disabled={!slot.available}
            >
              <span className="collection-slot-picker__item-time">
                {slot.startsAt} - {slot.endsAt}
              </span>
              {selectedSlot === slot.id && (
                <IconCheck size={14} stroke={2.5} className="collection-slot-picker__item-check" />
              )}
              {!slot.available && (
                <span className="collection-slot-picker__item-full">Full</span>
              )}
            </button>
          ))}
        </div>

        <div className="collection-slot-picker__clock">
        <svg viewBox="-100 -100 200 200" className="collection-slot-picker__svg">
          <circle cx="0" cy="0" r="85" className="collection-slot-picker__clock-face" />
          <circle cx="0" cy="0" r="3" className="collection-slot-picker__center" />

          {selectedSlot && (
            <>
              <line
                x1="0" y1="0"
                x2={getDotPosition(slots.findIndex(s => s.id === selectedSlot), totalSlots).x}
                y2={getDotPosition(slots.findIndex(s => s.id === selectedSlot), totalSlots).y}
                className="collection-slot-picker__hand"
              />
            </>
          )}

          {slots.map((slot, index) => {
            const pos = getDotPosition(index, totalSlots);
            const isSelected = selectedSlot === slot.id;
            const isAvailable = slot.available;
            return (
              <g key={slot.id}>
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 8 : 5}
                  className={`collection-slot-picker__dot ${isSelected ? 'collection-slot-picker__dot--selected' : ''} ${!isAvailable ? 'collection-slot-picker__dot--unavailable' : ''}`}
                  onClick={() => isAvailable && onSelectSlot(slot.id)}
                  style={{ cursor: isAvailable ? 'pointer' : 'not-allowed' }}
                />
              </g>
            );
          })}
        </svg>

        <div className="collection-slot-picker__time-display">
          {selectedSlotData ? (
            <>
              <span className="collection-slot-picker__time-main">
                {selectedSlotData.startsAt}
              </span>
              <span className="collection-slot-picker__time-range">
                to {selectedSlotData.endsAt}
              </span>
            </>
          ) : (
            <span className="collection-slot-picker__time-placeholder">
              Select a slot
            </span>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
