const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

export async function resendVerificationEmail(email) {
  const res = await fetch(`${API_URL}/email/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Failed to resend verification email');
  return res.json();
}

export async function sendOrderConfirmed(data) {
  const res = await fetch(`${API_URL}/email/order-confirmed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to send email');
  return res.json();
}

export async function sendOrderReady(data) {
  const res = await fetch(`${API_URL}/email/order-ready`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to send email');
  return res.json();
}
