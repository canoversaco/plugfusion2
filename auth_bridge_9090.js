const express = require('express')
const crypto  = require('crypto')
const app = express()

const PORT = 9090
const HOST = '127.0.0.1'

// Body-Parser
app.use(express.json({ limit:'200kb' }))
app.use(express.urlencoded({ extended:true }))

// NUR username/password (kein email/login/user)
function pick(req){
  const ct = (req.headers['content-type']||'').toLowerCase()
  let username = ''
  let password = ''
  if (ct.includes('application/json') && req.body){
    username = String(req.body.username||'')
    password = String(req.body.password||'')
  } else {
    username = String((req.body && req.body.username) || '')
    password = String((req.body && req.body.password) || '')
  }
  return { username, password }
}

const USERS = [
  { username: 'plugadmin', password: 'plugadmin', role: 'admin' },
  { username: 'admin',     password: 'Admin123', role: 'admin' },
]

const mkToken = () => crypto.randomBytes(24).toString('hex')

// Debug
app.get('/api/login/ping', (_req,res)=> res.json({ ok:true, port:PORT }))

// Der eigentliche Login – prüft NUR username/password
app.post('/api/login', (req,res)=>{
  const { username, password } = pick(req)
  if (!username || !password){
    return res.status(400).json({ error:'missing_credentials', expects:['username','password'] })
  }
  const u = USERS.find(x=> x.username===username && x.password===password )
  if (!u) return res.status(401).json({ error:'wrong_credentials' })
  const token = mkToken()
  res.json({ ok:true, user:{ username:u.username, role:u.role }, token })
})

// Optionaler geschützter Test-Endpoint
function auth(req,res,next){
  const auth = req.headers.authorization||''
  if (auth.startsWith('Bearer ') && auth.slice(7).trim()) return next()
  return res.status(401).json({ error:'unauthorized' })
}
app.get('/api/my/orders', auth, (_req,res)=> res.json([]))

app.listen(PORT, HOST, ()=>{
  console.log(`[auth-bridge] ready on http://${HOST}:${PORT}  (expects username/password only)`)
})
