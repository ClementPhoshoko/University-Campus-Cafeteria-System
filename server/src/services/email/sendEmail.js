import resend from './resend.js';

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'Merchant Munchies <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html }) {
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
  });

  if (error) throw error;
  return data;
}
