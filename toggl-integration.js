// Toggl Integration Module
export const TogglIntegration = {
  // Toggl API 토큰 저장/불러오기
  getApiToken() {
    return localStorage.getItem('toggl_api_token') || '';
  },

  setApiToken(token) {
    localStorage.setItem('toggl_api_token', token);
  },

  isConnected() {
    return !!this.getApiToken();
  },

  // 타이머 시작
  async startTimer(description, projectId = null) {
    const apiToken = this.getApiToken();
    if (!apiToken) {
      console.log('Toggl not connected');
      return null;
    }

    try {
      const response = await fetch('/api/toggl/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken, description, projectId })
      });

      if (!response.ok) {
        throw new Error('Failed to start Toggl timer');
      }

      const data = await response.json();
      return data.entryId;
    } catch (error) {
      console.error('Toggl start error:', error);
      return null;
    }
  },

  // 타이머 정지
  async stopTimer(entryId) {
    const apiToken = this.getApiToken();
    if (!apiToken || !entryId) {
      return false;
    }

    try {
      const response = await fetch('/api/toggl/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiToken, entryId })
      });

      if (!response.ok) {
        throw new Error('Failed to stop Toggl timer');
      }

      return true;
    } catch (error) {
      console.error('Toggl stop error:', error);
      return false;
    }
  }
};
