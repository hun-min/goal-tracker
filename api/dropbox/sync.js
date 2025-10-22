const DROPBOX_FILE_PATH = '/Apps/goal-tracker/goals.json';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.cookies?.dropbox_token;
  if (!token) {
    return res.status(401).json({ error: 'Dropbox not connected' });
  }

  const { mode, contents, path } = req.body;
  if (!mode) {
    return res.status(400).json({ error: 'Missing mode' });
  }

  try {
    if (mode === 'pull') {
      const response = await fetch('https://content.dropboxapi.com/2/files/download', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: path || DROPBOX_FILE_PATH })
        }
      });
      
      if (!response.ok) {
        if (response.status === 409) {
          return res.status(200).json({ ok: true, contents: null });
        }
        throw new Error('Download failed');
      }
      
      const fileData = await response.text();
      return res.status(200).json({ ok: true, contents: fileData });
    }
    
    if (mode === 'push') {
      if (typeof contents !== 'string') {
        return res.status(400).json({ error: 'Missing contents for push' });
      }
      
      const response = await fetch('https://content.dropboxapi.com/2/files/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Dropbox-API-Arg': JSON.stringify({ path: path || DROPBOX_FILE_PATH, mode: 'overwrite' }),
          'Content-Type': 'application/octet-stream'
        },
        body: contents
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[dropbox] upload error:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status}`);
      }
      
      return res.status(200).json({ ok: true });
    }
    
    return res.status(400).json({ error: 'Unsupported mode' });
  } catch (err) {
    console.error('[dropbox] sync error', err);
    return res.status(500).json({ error: err.message || 'Dropbox sync failed' });
  }
}
