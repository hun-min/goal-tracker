export default async function handler(req, res) {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send('No code provided');
  }

  const clientId = process.env.DROPBOX_APP_KEY;
  const clientSecret = process.env.DROPBOX_APP_SECRET;
  const redirectUri = 'https://targeted-time.vercel.app/api/dropbox/callback';

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
      res.setHeader('Set-Cookie', `dropbox_token=${data.access_token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      res.send('<script>window.close()</script>');
    } else {
      res.status(400).send('Failed to get access token');
    }
  } catch (error) {
    res.status(500).send('Authentication failed');
  }
}
