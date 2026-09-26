import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ quiet: true });

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} — see .env.example`);
  }
  return value;
}

function secret(name) {
  const value = required(name);
  if (value.length < 32) {
    throw new Error(`${name} must be at least 32 characters`);
  }
  return value;
}

export const config = Object.freeze({
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required('DATABASE_URL'),
  jwtSecret: secret('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  // Separate from the JWT secret: rotating session keys must not make every
  // recorded approval seal unverifiable.
  signingSecret: secret('SIGNING_SECRET'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB ?? 10) * 1024 * 1024,
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  // SMTP email configuration (local dev fallback)
  smtp: Object.freeze({
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    secure: (process.env.SMTP_SECURE ?? 'true') === 'true',
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.SMTP_FROM ?? `"SP College Workflow" <${process.env.SMTP_USER ?? 'noreply@spcollege.edu.in'}>`,
  }),
  // Resend HTTP API (for cloud hosts that block SMTP ports)
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  resendFrom: process.env.RESEND_FROM ?? 'SP College Workflow <onboarding@resend.dev>',
  // Default principal email for issue notifications (demo)
  principalEmail: process.env.PRINCIPAL_EMAIL ?? 'protonedge01@gmail.com',
});
