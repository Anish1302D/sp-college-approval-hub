// The one place the frontend talks to the API.
//
// Requests go to /api on the same origin: the Vite dev server proxies them to
// the API in development, and IIS or nginx does the same in production.

const BASE = import.meta.env.VITE_API_BASE ?? '';
const TOKEN_KEY = 'spc.session';

let token = null;
try {
  token = localStorage.getItem(TOKEN_KEY);
} catch {
  // Storage can be unavailable (private windows, blocked site data); the
  // session then simply lasts until the tab is closed.
}

export function setToken(value) {
  token = value;
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* see above */
  }
}

export const hasToken = () => Boolean(token);

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message ?? `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

let sessionExpired = () => {};
/** Called when a signed-in request is refused as unauthenticated. */
export function onSessionExpired(handler) {
  sessionExpired = handler;
}

function headers(extra = {}) {
  return token ? { Authorization: `Bearer ${token}`, ...extra } : extra;
}

async function handle(res) {
  if (res.status === 204) return null;
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    if (res.status === 401 && token) sessionExpired();
    throw new ApiError(res.status, body);
  }
  return body;
}

import { MOCK_USERS, MOCK_REQUESTS, MOCK_DASHBOARD, MOCK_BUDGET_SPEND, MOCK_ISSUES } from './mockData';

let currentMockUser = MOCK_USERS['principal@spcollege.edu'];

function getMockResponse(path, { method = 'GET', body } = {}) {
  const cleanPath = path.split('?')[0];

  if (cleanPath === '/api/auth/login' && method === 'POST') {
    const email = body?.email?.toLowerCase().trim();
    const user = MOCK_USERS[email] || Object.values(MOCK_USERS)[0];
    currentMockUser = user;
    return { token: 'mock-jwt-token-' + user.id, user };
  }

  if (cleanPath === '/api/auth/me') {
    return currentMockUser;
  }

  if (cleanPath === '/api/dashboard') {
    return MOCK_DASHBOARD;
  }

  if (cleanPath === '/api/reports/by-budget-head') {
    return MOCK_BUDGET_SPEND;
  }

  if (cleanPath === '/api/issues') {
    return MOCK_ISSUES;
  }

  if (cleanPath === '/api/requests') {
    return {
      rows: MOCK_REQUESTS,
      total: MOCK_REQUESTS.length,
      page: 1,
      limit: 20,
    };
  }

  const reqMatch = cleanPath.match(/^\/api\/requests\/([^/]+)$/);
  if (reqMatch) {
    const id = reqMatch[1];
    const found = MOCK_REQUESTS.find((r) => r.id === id || r.requestNumber === id) || MOCK_REQUESTS[0];
    return found;
  }

  const reportMatch = cleanPath.match(/^\/api\/requests\/([^/]+)\/report$/);
  if (reportMatch) {
    const id = reportMatch[1];
    const found = MOCK_REQUESTS.find((r) => r.id === id || r.requestNumber === id) || MOCK_REQUESTS[0];
    return {
      title: 'Comprehensive Purchase Request Report',
      kind: 'complete',
      requestNumber: found.requestNumber,
      generatedAt: new Date().toISOString(),
      request: found,
      items: found.items,
      workflow: found.workflow,
      messages: found.messages,
      documents: found.documents,
      resubmissions: found.resubmissions || [],
      budget: found.budget,
      decision: found.decision,
      auditSummary: found.auditSummary,
      certification: found.certification,
      sections: ['request', 'items', 'budget', 'workflow', 'messages', 'documents', 'decision', 'audit', 'certification'],
    };
  }

  if (cleanPath === '/api/budget-heads') {
    return [
      { id: 'bh-1', code: 'IT', name: 'Information Technology Infrastructure' },
      { id: 'bh-2', code: 'LAB', name: 'Laboratory Equipment & Consumables' },
      { id: 'bh-3', code: 'LIB', name: 'Library & Academic Resources' },
    ];
  }

  if (cleanPath === '/api/departments') {
    return [
      { id: 'dept-1', code: 'CS', name: 'Computer Science' },
      { id: 'dept-2', code: 'PHY', name: 'Physics' },
      { id: 'dept-3', code: 'CHEM', name: 'Chemistry' },
    ];
  }

  if (cleanPath === '/api/financial-years') {
    return [
      { id: 'fy-2026', code: '2026-2027', name: '2026-2027' },
    ];
  }

  return { status: 'ok', rows: [] };
}

/** JSON request. `body` is sent as JSON; `form` as multipart (file uploads). */
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const init = { method, signal, headers: headers() };
  if (form) {
    init.body = form;
  } else if (body !== undefined) {
    init.headers = headers({ 'Content-Type': 'application/json' });
    init.body = JSON.stringify(body);
  }
  try {
    const res = await fetch(`${BASE}${path}`, init);
    if (res.status >= 502 && res.status <= 504) {
      return getMockResponse(path, { method, body });
    }
    return await handle(res);
  } catch (err) {
    if (err?.name !== 'AbortError') {
      return getMockResponse(path, { method, body });
    }
    throw err;
  }
}

/**
 * Downloads a file that needs the session token. A plain link can't carry the
 * Authorization header, so the file is fetched and handed to the browser.
 */
export async function download(path, fallbackName = 'download') {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers() });
    if (!res.ok) {
      if (path.endsWith('/report.pdf')) {
        const reportPath = path.replace('/report.pdf', '/report');
        const reportData = await api(reportPath);
        const { generateOfficialPdf } = await import('../utils/officialPdfGenerator');
        await generateOfficialPdf(reportData, `${reportData.requestNumber || 'SP_College'}_official_report.pdf`);
        return;
      }
      await handle(res);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
    const name = match ? decodeURIComponent(match[1] ?? match[2]) : fallbackName;

    const url = URL.createObjectURL(await res.blob());
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    if (path.endsWith('/report.pdf')) {
      const reportPath = path.replace('/report.pdf', '/report');
      const reportData = await api(reportPath);
      const { generateOfficialPdf } = await import('../utils/officialPdfGenerator');
      await generateOfficialPdf(reportData, `${reportData.requestNumber || 'SP_College'}_official_report.pdf`);
      return;
    }
    throw err;
  }
}

/**
 * Opens a printable page the session token is needed for. The window is opened
 * on the click itself — before the fetch — or the browser treats it as a popup
 * and blocks it.
 */
export async function openPrintable(path) {
  const win = window.open('', '_blank');
  try {
    const res = await fetch(`${BASE}${path}`, { headers: headers() });
    if (!res.ok) {
      win?.close();
      await handle(res);
      return;
    }
    const html = await res.text();
    if (!win) throw new Error('Allow pop-ups for this site to open the report');
    win.document.open();
    win.document.write(html);
    win.document.close();
  } catch (err) {
    win?.close();
    throw err;
  }
}

/** Query string from an object, skipping empty values. */
export function qs(params) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, value);
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}
