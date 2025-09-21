const jwt = require('jsonwebtoken');

/**
 * Versucht, ein Token aus möglichst vielen Quellen zu lesen:
 * - Authorization: Bearer <token>  ODER nur der Token ohne "Bearer"
 * - X-Header: x-auth-token / x-token
 * - Query:    ?token=
 * - Body:     { token | jwt | authToken }
 * - Cookie:   token
 */
function extractToken(req){
  const H = req.headers || {};
  const auth = H.authorization || H.Authorization;
  if (typeof auth === 'string') {
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    // Falls der Client "Authorization: <token>" ohne "Bearer" sendet:
    if (auth.length > 20) return auth.trim();
  }
  const xt = H['x-auth-token'] || H['x-token'];
  if (xt && typeof xt === 'string' && xt.length > 10) return xt.trim();

  if (req.query && typeof req.query.token === 'string' && req.query.token.length > 10) {
    return req.query.token.trim();
  }
  const btok = req.body?.token || req.body?.jwt || req.body?.authToken;
  if (btok && typeof btok === 'string') return btok.trim();

  if (req.cookies && typeof req.cookies.token === 'string') {
    return req.cookies.token.trim();
  }
  return null;
}

/**
 * Verifiziert das JWT mit mehreren Secrets (für Mismatch-Fälle):
 * - JWT_SECRET
 * - JWT_SECRET_FALLBACK
 * - Plug-Defaults: 'plugdev', 'change_me_please'
 */
function verifyWithFallbacks(token){
  const candidates = [
    process.env.JWT_SECRET,
    process.env.JWT_SECRET_FALLBACK,
    'plugdev',
    'change_me_please',
  ].filter(Boolean);
  let lastErr = null;
  for (const sec of candidates){
    try {
      return jwt.verify(token, sec);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('verify_failed');
}

/**
 * required = true  -> 401 bei fehlendem/ungültigem Token
 * required = false -> lässt durch, req.user ggf. undefined
 * DEV-Fallback: Wenn ENV DEV_ALLOW_ORDER_WITHOUT_AUTH=1 gesetzt ist und keine Verifikation möglich,
 * dann setzen wir einen Demo-User (id=1, role='kunde') NUR für POST /api/orders.
 */
function authz(required = true) {
  return function (req, res, next) {
    try {
      const token = extractToken(req);
      if (!token) {
        // Optionaler Dev-Fallback
        if (process.env.DEV_ALLOW_ORDER_WITHOUT_AUTH === '1' && req.method === 'POST' && req.path.startsWith('/api/orders')) {
          req.user = { id: 1, role: 'kunde', username: 'dev' };
          return next();
        }
        if (required) return res.status(401).json({ error: 'unauth', reason: 'no_token' });
        return next();
      }
      const payload = verifyWithFallbacks(token);
      req.user = {
        id: payload.id || payload.user_id || payload.uid || payload.sub,
        role: payload.role || payload.r || 'kunde',
        username: payload.username || payload.u || undefined,
        _raw: payload,
      };
      if (!req.user.id) {
        if (process.env.DEV_ALLOW_ORDER_WITHOUT_AUTH === '1' && req.method === 'POST' && req.path.startsWith('/api/orders')) {
          req.user = { id: 1, role: 'kunde', username: 'dev' };
          return next();
        }
        if (required) return res.status(401).json({ error: 'unauth', reason: 'invalid_payload' });
      }
      return next();
    } catch (e) {
      if (process.env.DEV_ALLOW_ORDER_WITHOUT_AUTH === '1' && req.method === 'POST' && req.path.startsWith('/api/orders')) {
        req.user = { id: 1, role: 'kunde', username: 'dev' };
        return next();
      }
      if (required) return res.status(401).json({ error: 'unauth', reason: 'token_verify_failed' });
      return next();
    }
  }
}

module.exports = {
  authzRequired: authz(true),
  authzOptional: authz(false),
};
