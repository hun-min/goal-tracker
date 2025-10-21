export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.dropbox_token;
  if (!token) {
    return res.status(401).json({ error: 'Dropbox not connected' });
  }

  try {
    const response = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ path: '/Apps/goal-tracker' })
    });
    
    if (!response.ok) {
      throw new Error('List failed');
    }
    
    const data = await response.json();
    return res.status(200).json(data.entries || []);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'List failed' });
  }
}
