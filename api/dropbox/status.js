export default function handler(req, res) {
  const tokenCookie = req.cookies?.dropbox_token;
  
  if (!tokenCookie) {
    return res.status(200).json({ connected: false });
  }
  
  try {
    const tokenData = JSON.parse(tokenCookie);
    const now = Date.now();
    const expiresAt = tokenData.expires_at;
    
    // 토큰이 1시간 이내에 만료되면 경고
    const oneHour = 60 * 60 * 1000;
    const willExpireSoon = expiresAt && (expiresAt - now) < oneHour;
    
    res.status(200).json({ 
      connected: true,
      expires_at: expiresAt,
      expires_soon: willExpireSoon,
      time_left: expiresAt ? Math.max(0, expiresAt - now) : null
    });
  } catch (err) {
    // 구 형식 토큰 (문자열)
    res.status(200).json({ connected: true, legacy_token: true });
  }
}
