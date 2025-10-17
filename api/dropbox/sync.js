import { Dropbox } from 'dropbox';

export default async function handler(req, res) {
  const token = req.cookies?.dropbox_token;
  
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const dbx = new Dropbox({ accessToken: token });
  const { action, data } = req.body;

  try {
    if (action === 'push') {
      await dbx.filesUpload({
        path: '/goals.json',
        contents: JSON.stringify(data),
        mode: 'overwrite'
      });
      res.status(200).json({ success: true });
    } else if (action === 'pull') {
      const response = await dbx.filesDownload({ path: '/goals.json' });
      const fileContent = response.result.fileBinary.toString();
      const parsed = JSON.parse(fileContent);
      res.status(200).json(parsed);
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    if (error.status === 409) {
      res.status(404).json({ error: 'File not found' });
    } else {
      res.status(500).json({ error: 'Sync failed' });
    }
  }
}
