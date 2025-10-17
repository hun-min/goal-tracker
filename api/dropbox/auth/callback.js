import {
  ensureEnv,
  parseCookies,
  exchangeCodeForTokens,
  serializeCookie,
  clearCookie,
  DROPBOX_COOKIE_NAMES,
} from '../../_shared/dropbox.js';

export default async function handler(req, res) {
  const envError = ensureEnv();
  if (envError) {
    return res.status(envError.statusCode).json(JSON.parse(envError.body));
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state: returnedState } = req.query;
  const cookies = parseCookies(req.headers.cookie || '');
  const savedState = cookies[DROPBOX_COOKIE_NAMES.state];
  const codeVerifier = cookies[DROPBOX_COOKIE_NAMES.verifier];

  if (!code || !returnedState || returnedState !== savedState || !codeVerifier) {
    return res.status(400).send('<html><body><h1>인증 실패</h1><p>상태가 일치하지 않습니다.</p></body></html>');
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    const expiresIn = tokens.expires_in ?? 3600;
    const expiresAt = Date.now() + expiresIn * 1000;

    res.setHeader('Set-Cookie', [
      clearCookie(DROPBOX_COOKIE_NAMES.state),
      clearCookie(DROPBOX_COOKIE_NAMES.verifier),
      serializeCookie(DROPBOX_COOKIE_NAMES.accessToken, tokens.access_token, { maxAge: expiresIn }),
      serializeCookie(DROPBOX_COOKIE_NAMES.accessExpiry, String(expiresAt), { maxAge: expiresIn }),
      serializeCookie(DROPBOX_COOKIE_NAMES.refreshToken, tokens.refresh_token, { maxAge: 365 * 24 * 60 * 60 }),
    ]);

    return res.status(200).send(`
      <html>
        <body>
          <h1>Dropbox 연결 완료!</h1>
          <p>창을 닫고 앱으로 돌아가세요.</p>
          <script>
            window.opener?.postMessage({ type: 'dropbox-auth-success' }, '*');
            setTimeout(() => window.close(), 2000);
          </script>
        </body>
      </html>
    `);
  } catch (err) {
    return res.status(500).send(`<html><body><h1>인증 오류</h1><p>${err.message}</p></body></html>`);
  }
}
