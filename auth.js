const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const token = req.cookies?.session;
  if (!token) return res.status(401).json({ error: 'Please sign in.' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.clearCookie('session');
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}
module.exports = { requireAuth };
