export default function handler(req, res) {
  const token = req.cookies?.dropbox_token;
  res.status(200).json({ connected: !!token });
}
