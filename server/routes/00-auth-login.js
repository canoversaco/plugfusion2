/**
 * Robust /api/login – NUR username/password
 * - akzeptiert JSON & x-www-form-urlencoded
 * - optional Basic-Auth (für Tools), aber KEIN email/user/login-Feld – nur username/password
 * - sofortige Logins (ohne DB nötig):
 *     • plugadmin / plugadmin  (role=admin)
 *     • admin     / Admin123    (role=admin)
 * - wenn DB vorhanden: users-Tabelle wird (best effort) angelegt/aktualisiert
 *   und Login gegen password_hash (bcryptjs) ODER password (Plain) geprüft.
 *
 * Export: function(app, db) { ... }  → kompatibel mit Loadern, die (app,db) aufrufen.
 */
module.exports = function(app, db){
  const express = require('express')
  const crypto  = require('crypto')
  let bcrypt = null; try{ bcrypt = require('bcryptjs') }catch{}

  // feste, einfache DEV-Logins (ohne '!' um Bash-Probleme zu vermeiden)
  const DEFAULTS = [
    { username:'plugadmin', password:'plugadmin', role:'admin' },
    { username:'admin',     password:'Admin123',  role:'admin' },
  ]

  // Body-Parser sicher aktivieren (falls global nicht gesetzt)
  try{ app.use(express.json({limit:'200kb'})) }catch{}
  try{ app.use(express.urlencoded({extended:true})) }catch{}

  const mkToken = ()=> crypto.randomBytes(24).toString('hex')

  // striktes Auslesen NUR von username/password
  function pick(req){
    const ct = (req.headers['content-type']||'').toLowerCase()
    let u='', p=''
    if (ct.includes('application/json')){ u = String(req.body?.username||''); p = String(req.body?.password||'') }
    else { u = String(req.body?.username||''); p = String(req.body?.password||'') }

    // optional: Basic-Auth (für CLI-Tests)
    const auth = req.headers?.authorization || ''
    if ((!u || !p) && auth.startsWith('Basic ')){
      try{
        const dec = Buffer.from(auth.split(' ')[1],'base64').toString('utf8')
        const i = dec.indexOf(':'); if (i>0){ u = u||dec.slice(0,i); p = p||dec.slice(i+1) }
      }catch{}
    }
    return { username:u, password:p }
  }

  // DB Helper – tolerant für sqlite (get/run) & pg (query)
  function getDb(){
    if (db) return db
    try{
      // Versuch, dein DB-Interface zu laden (best effort)
      const dbIndex = require('../db')
      return dbIndex?.default || dbIndex || null
    }catch{ return null }
  }
  const _db = getDb()

  async function dbRun(sql, params){
    try{
      if (typeof _db?.run === 'function'){ await _db.run(sql, params); return true }
      if (typeof _db?.query === 'function'){ await _db.query(sql, params); return true }
    }catch{}
    return false
  }
  async function dbGet(sql, params){
    try{
      if (typeof _db?.get === 'function'){ return await _db.get(sql, params) }
      if (typeof _db?.query === 'function'){ const r = await _db.query(sql, params); return r?.rows?.[0]||r?.[0]||null }
    }catch{}
    return null
  }
  async function ensureUsersTable(){
    if (!_db) return
    await dbRun(`CREATE TABLE IF NOT EXISTS users(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      password TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT
    );`, [])
  }
  async function ensureDefaultUser(u,p,role){
    if (!_db) return
    await ensureUsersTable()
    let hash=null
    if (bcrypt){ try{ hash = await bcrypt.hash(p,10) }catch{} }
    const fields=['username','role','created_at','password']; const vals=[u,role,new Date().toISOString(),p]
    if (hash){ fields.push('password_hash'); vals.push(hash) }

    // sqlite upsert
    const ok = await dbRun(
      `INSERT INTO users (${fields.join(',')}) VALUES (${fields.map(()=>'?').join(',')})
       ON CONFLICT(username) DO UPDATE SET role=excluded.role, password=excluded.password,
       password_hash=COALESCE(excluded.password_hash, users.password_hash)`, vals
    )
    if (ok) return

    // pg upsert
    const ph = vals.map((_,i)=>'$'+(i+1)).join(',')
    await dbRun(
      `INSERT INTO users (${fields.join(',')}) VALUES (${ph})
       ON CONFLICT (username) DO UPDATE SET role=EXCLUDED.role, password=EXCLUDED.password,
       password_hash=COALESCE(EXCLUDED.password_hash, users.password_hash)`, vals
    )
  }
  async function getUserByUsername(u){
    return await dbGet('SELECT * FROM users WHERE username=?', [u]) ||
           await dbGet('SELECT * FROM users WHERE username=$1 LIMIT 1', [u])
  }

  async function verifyPassword(user, plain){
    if (!user) return false
    if (bcrypt && user.password_hash){
      try{ if (await bcrypt.compare(plain, user.password_hash)) return true }catch{}
    }
    if (user.password && String(user.password)===String(plain)) return true
    // letzter Fallback – falls DB-Satz ohne Passwort vorliegt, aber Default-User sein sollte
    if (DEFAULTS.find(d=>d.username===user.username && d.password===plain)) return true
    return false
  }

  // Debug-Endpoint (optional)
  app.get?.('/api/login/ping', (_req,res)=> res.json({ ok:true, expects:['username','password'] }))

  // DER Login-Endpoint
  app.post('/api/login', async (req,res)=>{
    try{
      const { username, password } = pick(req)
      if (!username || !password) return res.status(400).json({ error:'missing_credentials', expects:['username','password'] })

      // Sofortige DEV-Logins (ohne DB)
      const d = DEFAULTS.find(x=> x.username===username && x.password===password )
      if (d){
        // best-effort: in DB nachziehen
        try{ await ensureDefaultUser(d.username, d.password, d.role) }catch{}
        return res.json({ ok:true, user:{ username:d.username, role:d.role }, token: mkToken() })
      }

      // Mit DB prüfen (falls vorhanden)
      const user = await getUserByUsername(username)
      if (!user) return res.status(401).json({ error:'invalid_user' })
      const ok = await verifyPassword(user, password)
      if (!ok) return res.status(401).json({ error:'wrong_password' })

      return res.json({ ok:true, user:{ id:user.id, username:user.username, role:user.role||'user' }, token: mkToken() })
    }catch(err){
      console.error('LOGIN ERROR', err)
      return res.status(500).json({ error:'server_error' })
    }
  })

  console.log('[login] /api/login aktiv – akzeptiert NUR username/password | Default-Logins:', DEFAULTS.map(x=>x.username).join(', '))
}
