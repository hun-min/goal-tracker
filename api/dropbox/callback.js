export default async function handler(req, res) {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }

  const clientId = process.env.DROPBOX_APP_KEY;
  const clientSecret = process.env.DROPBOX_APP_SECRET;
  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/dropbox/callback`;

  try {
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri
      })
    });

    const data = await response.json();
    
    if (data.access_token) {
      // 토큰과 만료 시간을 함께 저장
      const tokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: Date.now() + (data.expires_in * 1000) // 현재 시간 + 만료 시간(초)
      };
      
      res.setHeader('Set-Cookie', `dropbox_token=${JSON.stringify(tokenData)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      res.send('<script>window.close()</script>');
    } else {
      console.error('Dropbox token error:', data);
      res.status(400).send(`Failed to get access token: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    res.status(500).send('Authentication failed');
  }
}
