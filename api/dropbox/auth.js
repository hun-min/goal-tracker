export default function handler(req, res) {
  const clientId = process.env.DROPBOX_APP_KEY;
  const redirectUri = `${process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'http://localhost:3000'}/api/dropbox/callback`;
  
  const authUrl = `https://www.dropbox.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
  
  res.status(200).json({ authUrl });
}
