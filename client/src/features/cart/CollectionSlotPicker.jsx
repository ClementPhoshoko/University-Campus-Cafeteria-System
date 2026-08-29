import { IconClock, IconCheck } from '@tabler/icons-react';
import './CollectionSlotPicker.css';

export default function CollectionSlotPicker({ slots, selectedSlot, onSelectSlot }) {
  return (
    <div className="collection-slot-picker">
      <div className="collection-slot-picker__header">
        <h2 className="collection-slot-picker__title">
          <IconClock size={16} stroke={1.8} />
          Select Collection Time
        </h2>
      </div>
      <div className="collection-slot-picker__grid">
        {slots.map((slot) => (
          <button
            key={slot.id}
            type="button"
            className={`collection-slot-picker__slot${selectedSlot === slot.id ? ' collection-slot-picker__slot--selected' : ''}${!slot.available ? ' collection-slot-picker__slot--unavailable' : ''}`}
            onClick={() => slot.available && onSelectSlot(slot.id)}
            disabled={!slot.available}
          >
            <span className="collection-slot-picker__time">
              {slot.startsAt} - {slot.endsAt}
            </span>
            {selectedSlot === slot.id && (
              <IconCheck size={14} stroke={2.5} className="collection-slot-picker__check" />
            )}
            {!slot.available && (
              <span className="collection-slot-picker__unavailable">Full</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
