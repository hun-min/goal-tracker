export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const tokenCookie = req.cookies?.dropbox_token;
  if (!tokenCookie) {
    return res.status(401).json({ error: 'Not connected' });
  }
  
  let token;
  try {
    const tokenData = JSON.parse(tokenCookie);
    token = tokenData.access_token;
  } catch (e) {
    token = tokenCookie;
  }
  
  if (!token) {
    return res.status(401).json({ error: 'Invalid token format' });
  }

  const { path } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'Missing path' });
  }

  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path })
    });

    if (!response.ok) {
      throw new Error('Delete failed');
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
