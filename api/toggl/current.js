export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiToken } = req.query;

  if (!apiToken) {
    return res.status(400).json({ error: 'API token required' });
  }

  try {
    const response = await fetch('https://api.track.toggl.com/api/v9/me/time_entries/current', {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Toggl API error: ${error}` });
    }

    const data = await response.json();
    res.status(200).json({ running: !!data, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
