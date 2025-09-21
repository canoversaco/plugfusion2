const jwt = require('jsonwebtoken');

function extractToken(req){
  const H = req.headers || {};
  const auth = H.authorization || H.Authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    if (auth.length > 20) return auth.trim(); // "Authorization: <token>" ohne "Bearer"
  }
  const xt = H['x-auth-token'] || H['x-token'];
  if (xt && typeof xt === 'string' && xt.length > 10) return xt.trim();
  if (req.query && typeof req.query.token === 'string' && req.query.token.length > 10) return req.query.token.trim();
  const btok = req.body?.token || req.body?.jwt || req.body?.authToken;
  if (btok && typeof btok === 'string') return btok.trim();
  if (req.cookies && typeof req.cookies.token === 'string' && req.cookies.token.length > 10) return req.cookies.token.trim();
  return null;
}

function verifyToken(token){
  const secret = process.env.JWT_SECRET || 'change_me_please';
  return jwt.verify(token, secret);
}

function signToken(payload, opts = {}){
  const secret = process.env.JWT_SECRET || 'change_me_please';
  return jwt.sign(payload, secret, { expiresIn: '7d', ...opts });
}

function setAuthCookie(res, token){
  const isSecure = process.env.COOKIE_SECURE === '1'; // in Prod hinter HTTPS auf 1 setzen
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

module.exports = { extractToken, verifyToken, signToken, setAuthCookie };
