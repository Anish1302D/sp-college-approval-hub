import nodemailer from 'nodemailer';
import { config } from './config.js';

// Lazy-initialised SMTP transporter — created once on first send.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,          // true for 465, false for 587/STARTTLS
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

/**
 * Sends an email using the configured SMTP transport.
 *
 * @param {{ to: string, cc?: string, subject: string, html: string }} opts
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
export async function sendMail({ to, cc, subject, html }) {
  const transport = getTransporter();

  const info = await transport.sendMail({
    from: config.smtp.from,
    to,
    cc: cc || undefined,
    subject,
    html,
  });

  console.log(`[mailer] sent "${subject}" → ${to} (messageId: ${info.messageId})`);
  return info;
}

/**
 * Verifies SMTP credentials at startup (optional — call from index.js if
 * you want a fast-fail when the SMTP server is unreachable).
 */
export async function verifySmtp() {
  try {
    await getTransporter().verify();
    console.log('[mailer] SMTP connection verified');
  } catch (err) {
    console.warn('[mailer] SMTP verification failed — emails will be retried on send:', err.message);
  }
}
