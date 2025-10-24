export default function handler(req, res) {
  const clientId = process.env.DROPBOX_APP_KEY;
  const redirectUri = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/dropbox/callback`;
  
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&token_access_type=offline`;
  
  res.status(200).json({ authUrl });
}
