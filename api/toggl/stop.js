export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiToken, entryId, workspaceId } = req.body;

  if (!apiToken || !entryId) {
    return res.status(400).json({ error: 'API token and entry ID required' });
  }

  try {
    let wid = workspaceId;
    if (!wid) {
      const meRes = await fetch('https://api.track.toggl.com/api/v9/me', {
        headers: { 'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}` }
      });
      if (meRes.ok) {
        const meData = await meRes.json();
        wid = meData.default_workspace_id;
      }
    }

    const response = await fetch(`https://api.track.toggl.com/api/v9/workspaces/${wid}/time_entries/${entryId}/stop`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`
      }
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Toggl API error: ${error}` });
    }

    const data = await response.json();
    res.status(200).json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
