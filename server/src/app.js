import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { requireAuth } from './auth.js';
import { config } from './config.js';
import { pool } from './db.js';
import { HttpError, errorHandler } from './errors.js';
import { attachmentsRouter } from './routes/attachments.js';
import { authRouter } from './routes/auth.js';
import { commentsRouter } from './routes/comments.js';
import { inventoryRouter } from './routes/inventory.js';
import { issuesRouter } from './routes/issues.js';
import { masterRouter } from './routes/master.js';
import { reportsRouter } from './routes/reports.js';
import { requestsRouter } from './routes/requests.js';
import { usersRouter } from './routes/users.js';

export function createApp() {
  const app = express();

  // Behind nginx or IIS on the college server, req.ip must be the client's
  // address — not the proxy's — or every user shares one sign-in rate limit.
  app.set('trust proxy', 'loopback');

  app.use(helmet());
  app.use(cors({
    origin: config.corsOrigins,
    allowedHeaders: ['Authorization', 'Content-Type'],
    exposedHeaders: ['Location', 'Content-Disposition'],
  }));
  app.use(express.json({ limit: '100kb' }));

  // Reports whether the API can reach the database.
  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({
        status: 'ok',
        version: '1.0.1',
        emailTransport: config.resendApiKey ? 'resend' : 'smtp',
        hasResendKey: Boolean(config.resendApiKey),
        hasSmtpUser: Boolean(config.smtp.user),
        principalEmail: config.principalEmail,
      });
    } catch (err) {
      res.status(503).json({ status: 'unavailable', error: err.message });
    }
  });

  // Temporary diagnostic — remove after confirming emails work
  app.get('/health/smtp', async (_req, res) => {
    const results = {
      primaryTransport: config.resendApiKey ? 'resend' : 'smtp',
      resendKey: config.resendApiKey ? `${config.resendApiKey.slice(0, 8)}****` : '(not set)',
      resendFrom: config.resendFrom,
      smtpUser: config.smtp.user || '(not set)',
      smtpHost: config.smtp.host,
      smtpPort: config.smtp.port,
      hasFallback: config.resendApiKey ? Boolean(config.smtp.user && config.smtp.pass) : Boolean(config.resendApiKey),
      principalEmail: config.principalEmail,
      verify: null,
      send: null,
    };
    try {
      const { sendMail, verifySmtp } = await import('./mailer.js');

      try { await verifySmtp(); results.verify = 'OK'; }
      catch (err) { results.verify = `FAILED: ${err.message}`; }

      try {
        const info = await sendMail({
          to: config.principalEmail,
          subject: '[TEST] Email from live server via ' + results.primaryTransport + (results.hasFallback ? ' (with fallback)' : ''),
          html: '<h2>Email Working!</h2><p>Sent from server via <b>' + results.primaryTransport + '</b> at ' + new Date().toISOString() + '</p>' +
                (results.hasFallback ? '<p><em>Fallback transport is available if primary fails.</em></p>' : ''),
        });
        results.send = { ok: true, messageId: info.messageId, response: info.response };
      } catch (err) {
        results.send = { ok: false, error: err.message, stack: err.stack };
      }

      res.json(results);
    } catch (err) {
      res.status(500).json({ ...results, fatal: err.message });
    }
  });

  app.use('/api/auth', authRouter);

  // Everything below requires a signed-in user.
  const api = express.Router();
  api.use(requireAuth);
  api.use('/requests/:id/comments', commentsRouter);
  api.use('/requests', requestsRouter);
  api.use('/issues', issuesRouter);
  api.use(masterRouter);
  api.use(attachmentsRouter);
  api.use(inventoryRouter);
  api.use(reportsRouter);
  api.use(usersRouter);
  app.use('/api', api);

  app.use((req, _res, next) => next(new HttpError(404, `No route for ${req.method} ${req.path}`)));
  app.use(errorHandler);

  return app;
}
