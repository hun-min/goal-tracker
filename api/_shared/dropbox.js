import crypto from 'crypto';

const RAW_DROPBOX_APP_KEY = process.env.DROPBOX_APP_KEY || process.env.DROPBOX_CLIENT_ID;
const RAW_DROPBOX_APP_SECRET = process.env.DROPBOX_APP_SECRET || process.env.DROPBOX_CLIENT_SECRET;
const RAW_DROPBOX_REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI;
const VERCEL_URL = process.env.VERCEL_URL;
const IS_VERCEL = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);

function resolveRedirectUri() {
  let redirect = RAW_DROPBOX_REDIRECT_URI;

  if (redirect && /^https?:\/\/localhost/i.test(redirect) && IS_VERCEL && VERCEL_URL) {
    redirect = `https://${VERCEL_URL.replace(/^https?:\/\//, '')}/api/dropbox/auth/callback`;
  }

  if (!redirect && IS_VERCEL && VERCEL_URL) {
    redirect = `https://${VERCEL_URL.replace(/^https?:\/\//, '')}/api/dropbox/auth/callback`;
  }

  return redirect;
}

export const DROPBOX_APP_KEY = RAW_DROPBOX_APP_KEY;
export const DROPBOX_APP_SECRET = RAW_DROPBOX_APP_SECRET;
export const DROPBOX_REDIRECT_URI = resolveRedirectUri();

export const DROPBOX_COOKIE_NAMES = {
  state: 'dropboxState',
  verifier: 'dropboxVerifier',
  accessToken: 'dropboxAccess',
  accessExpiry: 'dropboxAccessExpiry',
  refreshToken: 'dropboxRefresh',
};

export function createRandomString(bytes = 32) {
  return crypto.randomBytes(bytes).toString('hex');
}

export function base64UrlEncode(buffer) {
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, part) => {
    const [rawName, ...rest] = part.trim().split('=');
    if (!rawName) return acc;
    acc[decodeURIComponent(rawName)] = decodeURIComponent(rest.join('='));
    return acc;
  }, {});
}

export function serializeCookie(name, value, options = {}) {
  const {
    httpOnly = true,
    secure = true,
    sameSite = 'Lax',
    path = '/',
    maxAge,
    expires,
  } = options;

  const segments = [`${encodeURIComponent(name)}=${encodeURIComponent(value ?? '')}`];

  if (maxAge !== undefined) segments.push(`Max-Age=${maxAge}`);
  if (expires) segments.push(`Expires=${expires.toUTCString()}`);
  segments.push(`Path=${path}`);
  if (httpOnly) segments.push('HttpOnly');
  if (secure) segments.push('Secure');
  if (sameSite) segments.push(`SameSite=${sameSite}`);

  return segments.join('; ');
}

export function clearCookie(name) {
  return serializeCookie(name, '', {
    maxAge: 0,
    expires: new Date(0),
  });
}

export async function refreshAccessToken(refreshToken) {
  if (!refreshToken) return null;
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
  });

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) return null;
  return resp.json();
}

export async function exchangeCodeForTokens(code, verifier) {
  const params = new URLSearchParams({
    code,
    grant_type: 'authorization_code',
    client_id: DROPBOX_APP_KEY,
    client_secret: DROPBOX_APP_SECRET,
    redirect_uri: DROPBOX_REDIRECT_URI,
    code_verifier: verifier,
  });

  const resp = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!resp.ok) {
    throw new Error(`Failed to exchange code: ${await resp.text()}`);
  }

  return resp.json();
}

export async function uploadFile(accessToken, path, contents) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', mute: true }),
      'Content-Type': 'application/octet-stream',
    },
    body: contents,
  });
  if (!resp.ok) {
    throw new Error(`Upload failed: ${await resp.text()}`);
  }
  return resp.json();
}

export async function downloadFile(accessToken, path) {
  const resp = await fetch('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Dropbox-API-Arg': JSON.stringify({ path }),
    },
  });
  if (resp.status === 409) return null;
  if (!resp.ok) {
    throw new Error(`Download failed: ${await resp.text()}`);
  }
  return resp.text();
}

export function ensureEnv() {
  if (!DROPBOX_APP_KEY || !DROPBOX_APP_SECRET || !DROPBOX_REDIRECT_URI) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Dropbox environment variables are not configured.' }),
    };
  }
  return null;
}

export function buildJsonResponse(statusCode, payload, cookies = []) {
  const headers = { 'Content-Type': 'application/json' };
  const response = {
    statusCode,
    headers,
    body: JSON.stringify(payload),
  };

  if (cookies.length === 1) {
    headers['Set-Cookie'] = cookies[0];
  } else if (cookies.length > 1) {
    response.multiValueHeaders = {
      'Set-Cookie': cookies,
    };
  }

  return response;
}
