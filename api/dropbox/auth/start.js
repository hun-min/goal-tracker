import crypto from 'crypto';
import {
  ensureEnv,
  createRandomString,
  base64UrlEncode,
  serializeCookie,
  DROPBOX_COOKIE_NAMES,
  buildJsonResponse,
  DROPBOX_APP_KEY,
  DROPBOX_REDIRECT_URI,
} from '../../_shared/dropbox.js';

export default async function handler(req, res) {
  const envError = ensureEnv();
  if (envError) {
    return res.status(envError.statusCode).json(JSON.parse(envError.body));
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const state = createRandomString(16);
    const codeVerifier = createRandomString(40);
    const codeChallenge = base64UrlEncode(
      crypto.createHash('sha256').update(codeVerifier).digest()
    );

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: DROPBOX_APP_KEY,
      redirect_uri: DROPBOX_REDIRECT_URI,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
      token_access_type: 'offline',
    });

    res.setHeader('Set-Cookie', [
      serializeCookie(DROPBOX_COOKIE_NAMES.state, state, { maxAge: 600 }),
      serializeCookie(DROPBOX_COOKIE_NAMES.verifier, codeVerifier, { maxAge: 600 }),
    ]);

    const authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
    return res.status(200).json({ url: authUrl });
  } catch (err) {
    return res.status(500).json({
      error: 'auth_start_failed',
      message: err?.message || 'Unknown error',
    });
  }
}
