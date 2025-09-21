const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { signToken, setAuthCookie } = require('../lib/auth_helpers');

async function getUserByUsername(username){
  // versuche user by username
  const q = 'select id, username, role, password_hash, password from users where username = ?';
  let row = null;
  try { row = await db.one(q, [username]); }
  catch { // PG-Fallback
    try {
      let i=0; const pg = q.replace(/\?/g, ()=>'$'+(++i));
      row = await db.one(pg, [username]);
    } catch {}
  }
  return row;
}

router.post('/api/login', express.json(), async (req, res) => {
  try{
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'missing_credentials' });

    // 1) DB-User
    const row = await getUserByUsername(username).catch(()=>null);

    let ok = false, uid = null, role = 'kunde', uname = username;

    if (row) {
      uid = row.id; role = row.role || 'kunde'; uname = row.username || username;
      if (row.password_hash && typeof row.password_hash === 'string') {
        ok = await bcrypt.compare(password, row.password_hash);
      } else if (row.password) {
        // Plaintext-Fallback (legacy)
        ok = String(row.password) === String(password);
      }
    }

    // 2) ENV-Admin-Fallback (konfigurierbar, aber produktiv nutzbar)
    if (!ok) {
      const AU = process.env.ADMIN_USER || 'admin';
      const AP = process.env.ADMIN_PASS || 'Admin123';
      if (username === AU && password === AP) {
        // Stelle sicher, dass es einen DB-User gibt, oder simuliere account mit id=1
        uid = 1; role = 'admin'; uname = AU;
        ok = true;
      }
    }

    // 3) plugadmin/plugadmin (nur wenn EXPLIZIT erlaubt)
    if (!ok && process.env.ALLOW_PLUGADMIN === '1' && username === 'plugadmin' && password === 'plugadmin') {
      uid = 1; role = 'admin'; uname = 'plugadmin'; ok = true;
    }

    if (!ok) return res.status(401).json({ error: 'unauth' });

    const token = signToken({ id: uid, role, username: uname });
    setAuthCookie(res, token);
    return res.json({ ok: true, token });
  } catch(e){
    console.error('[login-override]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

// Session-Check
router.get('/api/auth/me', (req, res) => {
  try{
    const { extractToken, verifyToken } = require('../lib/auth_helpers');
    const t = extractToken(req);
    if (!t) return res.status(401).json({ ok:false, error:'no_token' });
    const p = verifyToken(t);
    return res.json({ ok:true, user: { id: p.id || p.sub, role: p.role || 'kunde', username: p.username } });
  }catch(e){
    return res.status(401).json({ ok:false, error:'invalid_token' });
  }
});

module.exports = router;
