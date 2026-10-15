import PrimaryButton from '../../components/PrimaryButton.jsx';
import './MockPaymentPanel.css';

export default function MockPaymentPanel({ order, busy, error, onPay, onCancel }) {
  return (
    <main className="mock-payment-page">
      <section className="mock-payment" aria-labelledby="mock-payment-title">
        <p className="mock-payment__mode">Test mode <span>No real charge</span></p>
        <h1 id="mock-payment-title">Complete your payment</h1>
        <p className="mock-payment__intro">This secure checkout simulator lets you test the order journey. No card details are collected.</p>

        <div className="mock-payment__summary">
          <div><span>Order reference</span><strong>{order.reference}</strong></div>
          <div><span>Total due</span><strong className="mock-payment__total">{order.currency || 'ZAR'} {Number(order.total || 0).toFixed(2)}</strong></div>
        </div>

        <div className="mock-payment__method">
          <span className="mock-payment__method-icon" aria-hidden="true">▣</span>
          <div><strong>Sandbox card</strong><span>Simulated test payment</span></div>
          <span className="mock-payment__method-badge">TEST</span>
        </div>

        {busy && (
          <div className="mock-payment__processing" role="status" aria-live="polite">
            <span className="mock-payment__spinner" aria-hidden="true" />
            <span><strong>Confirming your payment</strong><small>Keep this page open while we update your order.</small></span>
          </div>
        )}

        {error && <p className="mock-payment__error" role="alert">{error}</p>}
        <PrimaryButton onClick={() => onPay('succeeded')} disabled={busy} aria-busy={busy}>
          {busy ? 'Processing test payment…' : `Pay ${order.currency || 'ZAR'} ${Number(order.total || 0).toFixed(2)}`}
        </PrimaryButton>
        <button className="mock-payment__decline" type="button" onClick={() => onPay('failed')} disabled={busy}>
          Simulate a declined payment
        </button>
        <button className="mock-payment__cancel" type="button" onClick={onCancel} disabled={busy}>
          Cancel and return to orders
        </button>
        <p className="mock-payment__footnote">Development checkout · No payment provider is connected</p>
      </section>
    </main>
  );
}
