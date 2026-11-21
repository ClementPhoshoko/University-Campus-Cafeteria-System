import { useEffect, useRef, useState } from 'react';
import { IconDotsVertical } from '@tabler/icons-react';

/** Small reusable overflow menu. Item clicks never reach a surrounding list row. */
export default function NotificationActionsMenu({
  items = [],
  label = 'More notification actions',
  className = '',
  buttonClassName = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={`notification-menu${className ? ` ${className}` : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className={`notification-menu__trigger${buttonClassName ? ` ${buttonClassName}` : ''}`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
      >
        <IconDotsVertical size={18} stroke={1.8} />
      </button>

      {open && (
        <div className="notification-menu__dropdown" role="menu">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                className={`notification-menu__item${item.tone === 'danger' ? ' notification-menu__item--danger' : ''}`}
                disabled={item.disabled}
                onClick={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  item.onClick?.();
                }}
              >
                {Icon && <Icon size={16} stroke={1.8} aria-hidden="true" />}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
