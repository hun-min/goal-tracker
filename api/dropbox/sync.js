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
        mode: { '.tag': 'overwrite' }
      });
      res.status(200).json({ success: true });
    } else if (action === 'pull') {
      try {
        const response = await dbx.filesDownload({ path: '/goals.json' });
        const fileContent = response.result.fileBinary.toString('utf-8');
        const parsed = JSON.parse(fileContent);
        res.status(200).json(parsed);
      } catch (downloadError) {
        console.error('Download error:', downloadError);
        if (downloadError.status === 409) {
          res.status(404).json({ error: 'File not found', message: 'Dropbox에 파일이 없습니다. 먼저 업로드하세요.' });
        } else {
          res.status(500).json({ error: 'Download failed', message: downloadError.message, status: downloadError.status });
        }
      }
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Sync failed', message: error.message });
  }
}
