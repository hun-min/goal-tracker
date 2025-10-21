export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { apiToken, description, projectName, workspaceId } = req.body;

  if (!apiToken) {
    return res.status(400).json({ error: 'API token required' });
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

    let projectId = null;
    if (projectName) {
      const projectsRes = await fetch(`https://api.track.toggl.com/api/v9/workspaces/${wid}/projects`, {
        headers: { 'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}` }
      });
      if (projectsRes.ok) {
        const projects = await projectsRes.json();
        let project = projects.find(p => p.name === projectName);
        if (!project) {
          const createRes = await fetch(`https://api.track.toggl.com/api/v9/workspaces/${wid}/projects`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`
            },
            body: JSON.stringify({ name: projectName, active: true })
          });
          if (createRes.ok) project = await createRes.json();
        }
        if (project) projectId = project.id;
      }
    }

    const response = await fetch('https://api.track.toggl.com/api/v9/time_entries', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${apiToken}:api_token`).toString('base64')}`
      },
      body: JSON.stringify({
        description: description || 'Goal Tracker',
        created_with: 'goal-tracker',
        start: new Date().toISOString(),
        duration: -1,
        workspace_id: wid,
        project_id: projectId
      })
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error: `Toggl API error: ${error}` });
    }

    const data = await response.json();
    res.status(200).json({ success: true, entryId: data.id, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
