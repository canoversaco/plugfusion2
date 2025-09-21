/**
 * Dev Login Bridge – Minimal-Auth-Server auf :3000
 *  - POST /api/login akzeptiert:
 *      • plugadmin / plugadmin
 *      • admin / Admin123
 *  - Body: JSON, FORM, Basic-Auth, GET-Query
 *  - Liefert { ok:true, user, token } (Bearer)
 *  - Zusätzliche Stubs:
 *      • GET /api/login/ping
 *      • GET /api/my/orders (geschützt; braucht Bearer oder Cookie "token")
 */
const express = require('express')
const crypto  = require('crypto')
const app = express()

const PORT = Number(process.env.PORT || 3000)
const HOST = process.env.HOST || '0.0.0.0'

app.use(express.json({ limit:'200kb' }))
app.use(express.urlencoded({ extended:true }))

const USERS = [
  { username:'plugadmin', password:'plugadmin', role:'admin' },
  { username:'admin',     password:'Admin123', role:'admin' },
]

const mkToken = () => crypto.randomBytes(24).toString('hex')

function pickCreds(req){
  const b = req.body || {}
  let u = b.username || b.user || b.email || b.login
  let p = b.password

  const auth = req.headers?.authorization || ''
  if ((!u || !p) && auth.startsWith('Basic ')){
    try{
      const dec = Buffer.from(auth.split(' ')[1], 'base64').toString('utf8')
      const i = dec.indexOf(':'); if (i>0){ u = u || dec.slice(0,i); p = p || dec.slice(i+1) }
    }catch{}
  }
  if ((!u || !p) && req.method==='GET'){
    u = u || req.query?.username || req.query?.user || req.query?.email || req.query?.login
    p = p || req.query?.password
  }
  return { username:String(u||''), password:String(p||'') }
}

app.get('/api/login/ping', (_req,res)=> res.json({ ok:true, bridge:true, hint:'POST /api/login' }))

app.post('/api/login', (req,res)=>{
  const { username, password } = pickCreds(req)
  if (!username || !password) return res.status(400).json({ error:'missing_credentials' })

  const u = USERS.find(x => x.username===username && x.password===password)
  if (!u) return res.status(401).json({ error:'wrong_credentials' })

  const token = mkToken()
  // kleine Cookie-Session zusätzlich (optional)
  res.cookie?.('token', token, { httpOnly:false, sameSite:'lax' })
  return res.json({ ok:true, user:{ username:u.username, role:u.role }, token })
})

// ganz simpler Auth-Check
function authMiddleware(req,res,next){
  const auth = req.headers?.authorization || ''
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  const cookieTok = (req.headers?.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('token='))?.split('=')[1] || ''
  if (bearer || cookieTok) return next()
  return res.status(401).json({ error:'unauthorized' })
}

// geschützte Probe-Route (Frontend kann damit Login verifizieren)
app.get('/api/my/orders', authMiddleware, (_req,res)=> res.json([]))

app.listen(PORT, HOST, ()=>{
  console.log(`[bridge] Auth-Bridge läuft auf http://${HOST}:${PORT}`)
})
