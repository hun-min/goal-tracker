export default async function handler(req, res) {
  const tokenCookie = req.cookies?.dropbox_token;
  
  if (!tokenCookie) {
    return res.status(401).json({ error: 'No token found' });
  }
  
  try {
    const tokenData = JSON.parse(tokenCookie);
    
    if (!tokenData.refresh_token) {
      return res.status(400).json({ error: 'No refresh token available' });
    }
    
    const clientId = process.env.DROPBOX_APP_KEY;
    const clientSecret = process.env.DROPBOX_APP_SECRET;
    
    console.log('Refresh attempt:', { 
      hasClientId: !!clientId, 
      hasClientSecret: !!clientSecret, 
      hasRefreshToken: !!tokenData.refresh_token 
    });
    
    const response = await fetch('https://api.dropboxapi.com/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokenData.refresh_token,
        client_id: clientId,
        client_secret: clientSecret
      })
    });
    
    const data = await response.json();
    
    console.log('Dropbox API response:', { status: response.status, data });
    
    if (data.access_token) {
      // 새로운 토큰 데이터 생성
      const newTokenData = {
        access_token: data.access_token,
        refresh_token: data.refresh_token || tokenData.refresh_token, // 새 refresh_token이 없으면 기존 것 유지
        expires_at: Date.now() + (data.expires_in * 1000)
      };
      
      res.setHeader('Set-Cookie', `dropbox_token=${JSON.stringify(newTokenData)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`);
      res.status(200).json({ 
        success: true, 
        expires_at: newTokenData.expires_at,
        message: '토큰이 갱신되었습니다'
      });
    } else {
      console.error('Dropbox refresh error:', data);
      res.status(400).json({ error: 'Failed to refresh token', details: data });
    }
  } catch (error) {
    console.error('Refresh token error:', error.message, error.stack);
    res.status(500).json({ error: 'Token refresh failed', details: error.message });
  }
}