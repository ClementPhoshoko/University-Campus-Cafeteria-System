import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import PrimaryButton from '../PrimaryButton.jsx';
import confirmAvatar from '../../assets/avatars/Cheerful_Student_Presenting_with_Open_Palm.png';
import './confirm-dialog.css';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [current, setCurrent] = useState(null);
  const resolver = useRef(null);
  const cancelRef = useRef(null);
  const returnFocusRef = useRef(null);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    if (resolver.current) resolver.current(false);
    returnFocusRef.current = document.activeElement;
    resolver.current = resolve;
    setCurrent({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      tone: options.tone === 'danger' ? 'danger' : 'default',
      showAvatar: options.showAvatar !== false,
    });
  }), []);

  const finish = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setCurrent(null);
    requestAnimationFrame(() => returnFocusRef.current?.focus?.());
  }, []);

  useEffect(() => {
    if (!current) return undefined;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
      }
      if (event.key === 'Tab') {
        const dialog = document.querySelector('.confirm-dialog');
        const controls = dialog?.querySelectorAll('button:not(:disabled)');
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [current, finish]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {current && (
        <div className="confirm-dialog-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) finish(false);
        }}>
          <section className={`confirm-dialog confirm-dialog--${current.tone}`} role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-message">
            <div className={`confirm-dialog__content${current.showAvatar ? '' : ' confirm-dialog__content--no-avatar'}`}>
              {current.showAvatar && <img className="confirm-dialog__avatar" src={confirmAvatar} alt="" />}
              <div className="confirm-dialog__copy">
                <div className="confirm-dialog__heading">
                  {current.tone === 'danger' && <span className="confirm-dialog__icon" aria-hidden="true"><IconAlertTriangle size={17} stroke={1.8} /></span>}
                  <h2 id="confirm-dialog-title" className="confirm-dialog__title">{current.title}</h2>
                </div>
                <p id="confirm-dialog-message" className="confirm-dialog__message">{current.message}</p>
              </div>
            </div>
            <div className="confirm-dialog__actions">
              <button ref={cancelRef} type="button" className="confirm-dialog__cancel" onClick={() => finish(false)}>{current.cancelLabel}</button>
              <PrimaryButton className={`primary-btn primary-btn--md confirm-dialog__confirm${current.tone === 'danger' ? ' confirm-dialog__confirm--danger' : ''}`} onClick={() => finish(true)}>
                {current.confirmLabel}
              </PrimaryButton>
            </div>
          </section>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used within ConfirmProvider');
  return confirm;
}
