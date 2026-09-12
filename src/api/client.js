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

/** JSON request. `body` is sent as JSON; `form` as multipart (file uploads). */
export async function api(path, { method = 'GET', body, form, signal } = {}) {
  const init = { method, signal, headers: headers() };
  if (form) {
    init.body = form;
  } else if (body !== undefined) {
    init.headers = headers({ 'Content-Type': 'application/json' });
    init.body = JSON.stringify(body);
  }
  return handle(await fetch(`${BASE}${path}`, init));
}

/**
 * Downloads a file that needs the session token. A plain link can't carry the
 * Authorization header, so the file is fetched and handed to the browser.
 */
export async function download(path, fallbackName = 'download') {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  if (!res.ok) await handle(res);
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
