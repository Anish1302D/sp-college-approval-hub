import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import { config } from './config.js';

// ---------------------------------------------------------------------------
// Transport: Resend (HTTP API) or SMTP (nodemailer) depending on config.
//
// Render's free tier blocks outbound SMTP ports (587, 465). Resend uses
// HTTPS, so it works everywhere.  When RESEND_API_KEY is set we use it;
// otherwise we fall back to SMTP for local development.
// ---------------------------------------------------------------------------

let resendClient = null;
let smtpTransporter = null;

function useResend() {
  return Boolean(config.resendApiKey);
}

function getResendClient() {
  if (resendClient) return resendClient;
  resendClient = new Resend(config.resendApiKey);
  return resendClient;
}

function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter;
  smtpTransporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });
  return smtpTransporter;
}

/**
 * Sends an email using Resend (HTTP) or SMTP (nodemailer).
 * If the primary transport fails and the other is configured, it retries
 * with the fallback transport so at least one path can succeed.
 *
 * @param {{ to: string, cc?: string, subject: string, html: string }} opts
 */
export async function sendMail({ to, cc, subject, html }) {
  if (useResend()) {
    try {
      return await _sendViaResend({ to, cc, subject, html });
    } catch (resendErr) {
      console.warn(`[mailer] Resend failed: ${resendErr.message}`);
      // Fallback to SMTP if credentials are configured
      if (config.smtp.user && config.smtp.pass) {
        console.log('[mailer] Falling back to SMTP…');
        return await _sendViaSmtp({ to, cc, subject, html });
      }
      throw resendErr;
    }
  }

  // Primary: SMTP
  try {
    return await _sendViaSmtp({ to, cc, subject, html });
  } catch (smtpErr) {
    console.warn(`[mailer] SMTP failed: ${smtpErr.message}`);
    // Fallback to Resend if API key is configured
    if (config.resendApiKey) {
      console.log('[mailer] Falling back to Resend…');
      return await _sendViaResend({ to, cc, subject, html });
    }
    throw smtpErr;
  }
}

async function _sendViaResend({ to, cc, subject, html }) {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: config.resendFrom || 'SP College Workflow <onboarding@resend.dev>',
    to: Array.isArray(to) ? to : to.split(',').map((e) => e.trim()),
    cc: cc ? (Array.isArray(cc) ? cc : cc.split(',').map((e) => e.trim())) : undefined,
    subject,
    html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  console.log(`[mailer/resend] sent "${subject}" → ${to} (id: ${data.id})`);
  return { messageId: data.id, response: 'Resend OK' };
}

async function _sendViaSmtp({ to, cc, subject, html }) {
  const transport = getSmtpTransporter();
  const info = await transport.sendMail({
    from: config.smtp.from,
    to,
    cc: cc || undefined,
    subject,
    html,
  });

  console.log(`[mailer/smtp] sent "${subject}" → ${to} (messageId: ${info.messageId})`);
  return info;
}

/**
 * Verifies the email transport at startup.
 */
export async function verifySmtp() {
  if (useResend()) {
    console.log('[mailer] Using Resend HTTP API (SMTP ports blocked on this host)');
    return;
  }

  try {
    await getSmtpTransporter().verify();
    console.log('[mailer] SMTP connection verified');
  } catch (err) {
    console.warn('[mailer] SMTP verification failed — emails will be retried on send:', err.message);
  }
}
