const express = require('express')
const router = express.Router()

// Falls Projekt diese Utils global bereitstellt:
const _norm = s => (s||'').toString().toLowerCase().replace(/\s+/g,'_')
const _allowed = new Set(['offen','akzeptiert','in_arbeit','unterwegs','abgeschlossen'])
const _openSet  = new Set(['offen','pending','neu','wartet_bestätigung','wartet_bestaetigung','bestätigt','bestaetigt','angenommen'])

async function colExists(db, table, col){
  try{
    const isPg = !!(db?.client?.connectionParameters || db?._client)
    if(isPg){
      const r = await qAll(db, `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table.replace(/.*\./,'')])
      return (r||[]).map(x=>String(x.column_name).toLowerCase()).includes(col.toLowerCase())
    }else{
      const r = await qAll(db, `PRAGMA table_info(${table})`)
      return (r||[]).some(x=>String(x.name).toLowerCase()===col.toLowerCase())
    }
  }catch{ return false }
}
async function addCol(db, t, c, type){
  try{ await qRun(db, `ALTER TABLE ${t} ADD COLUMN ${c} ${type}`) }catch{}
}
async function ensureCols(db){
  if(!cache.orders) return
  const t = cache.orders
  await addCol(db, t, 'status', 'TEXT')
  if(!await colExists(db,t,'courier_id') && await colExists(db,t,'assigned_courier_id')){
    // ok, dann nutzen wir assigned_courier_id
  }else{
    await addCol(db, t, 'courier_id', 'INTEGER')
  }
  await addCol(db, t, 'eta_at', 'TEXT')
  await addCol(db, t, 'gps_lat', 'REAL')
  await addCol(db, t, 'gps_lng', 'REAL')
  await addCol(db, t, 'gps_at', 'TEXT')
}
async function updateOrder(db, id, fields){
  const t = cache.orders
  const cols = (cache.cols[t]||[]).map(x=>x.toLowerCase())
  const set=[], params=[]
  for(const [k,v] of Object.entries(fields)){
    let key=k
    if(k==='courier_id' && !cols.includes('courier_id') && cols.includes('assigned_courier_id')) key='assigned_courier_id'
    set.push(`${key}=?`); params.push(v)
  }
  params.push(id)
  if(set.length) await qRun(db, `UPDATE ${t} SET ${set.join(', ')} WHERE id=?`, params)
}

function attachAssign(path){
  router.post(path, async (req,res)=>{
    try{
      const db = DB(req); await ensureDiscovered(req); await ensureCols(db)
      const id = Number(req.params.id)
      const me = (req.user||req.session?.user||{}).id ?? null
      const target = (req.body||{}).courier_id ?? me
      if(!cache.orders) return res.status(400).json({ok:false})
      if(!target) return res.status(400).json({ok:false, err:'no_courier'})
      await updateOrder(db, id, { courier_id: Number(target) })
      try{
        const r = (await qAll(db, `SELECT status FROM ${cache.orders} WHERE id=?`, [id]))?.[0]||{}
        const s0 = _norm(r.status)
        if(_openSet.has(s0)) await updateOrder(db, id, { status:'akzeptiert' })
      }catch{}
      res.json({ok:true,id,courier_id:Number(target)})
    }catch(e){ console.error('[compat-assign]',e); res.status(500).json({ok:false}) }
  })
}
function attachUnassign(path){
  router.post(path, async (req,res)=>{
    try{
      const db = DB(req); await ensureDiscovered(req); await ensureCols(db)
      const id = Number(req.params.id)
      await updateOrder(db, id, { courier_id:null, assigned_courier_id:null })
      res.json({ok:true,id})
    }catch(e){ console.error('[compat-unassign]',e); res.status(500).json({ok:false}) }
  })
}
function attachStatus(path){
  router.post(path, async (req,res)=>{
    try{
      const db = DB(req); await ensureDiscovered(req); await ensureCols(db)
      const id = Number(req.params.id)
      let s = _norm((req.body||{}).status)
      if(s==='bestätigt'||s==='bestaetigt'||s==='angenommen') s='akzeptiert'
      if(!_allowed.has(s)) s='offen'
      await updateOrder(db, id, { status:s })
      if(s==='akzeptiert' && req.user?.id) try{ await updateOrder(db,id,{courier_id:req.user.id}) }catch{}
      res.json({ok:true,id,status:s})
    }catch(e){ console.error('[compat-status]',e); res.status(500).json({ok:false}) }
  })
}
function attachEta(path){
  router.post(path, async (req,res)=>{
    try{
      const db = DB(req); await ensureDiscovered(req); await ensureCols(db)
      const id = Number(req.params.id)
      const iso = (req.body||{}).eta_at
      if(!iso) return res.status(400).json({ok:false,err:'no_eta'})
      const v = new Date(iso).toISOString()
      await updateOrder(db, id, { eta_at:v })
      res.json({ok:true,id,eta_at:v})
    }catch(e){ console.error('[compat-eta]',e); res.status(500).json({ok:false}) }
  })
}
function attachLoc(path){
  router.post(path, async (req,res)=>{
    try{
      const db = DB(req); await ensureDiscovered(req); await ensureCols(db)
      const id = Number(req.params.id)
      const {lat,lng}=(req.body||{})
      if(typeof lat!=='number'||typeof lng!=='number') return res.status(400).json({ok:false,err:'no_coords'})
      await updateOrder(db, id, { gps_lat:lat, gps_lng:lng, gps_at:new Date().toISOString() })
      res.json({ok:true,id})
    }catch(e){ console.error('[compat-loc]',e); res.status(500).json({ok:false}) }
  })
}

// Alle Varianten verdrahten:
;[
 '/admin/orders/:id/assign',  '/courier/orders/:id/assign',  '/orders/:id/assign'
].forEach(attachAssign)

;[
 '/admin/orders/:id/unassign','/courier/orders/:id/unassign','/orders/:id/unassign'
].forEach(attachUnassign)

;[
 '/admin/orders/:id/status',  '/courier/orders/:id/status',  '/orders/:id/status'
].forEach(attachStatus)

;[
 '/admin/orders/:id/eta',     '/courier/orders/:id/eta',     '/orders/:id/eta'
].forEach(attachEta)

;[
 '/admin/orders/:id/loc',     '/courier/orders/:id/loc',     '/orders/:id/loc'
].forEach(attachLoc)

/* ----- Kurier-Liste (id, name, role) ----- */
router.get(['/admin/couriers','/couriers'], async (req,res)=>{
  try{
    const db = DB(req); await ensureDiscovered(req)
    const t = cache.users || cache.user || cache.accounts || null
    if(!t) return res.json({ok:true, couriers: []})
    // Spalten prüfen
    const cols=(cache.cols[t]||[]).map(x=>x.toLowerCase())
    const nameCol = cols.includes('username') ? 'username'
                   : cols.includes('name') ? 'name'
                   : null
    const roleCol = cols.includes('role') ? 'role'
                   : cols.includes('user_role') ? 'user_role'
                   : null
    // Query vorbereiten
    let sql=`SELECT id${nameCol?', '+nameCol:' '}${roleCol?', '+roleCol:' '} FROM ${t}`
    if(roleCol) sql += ` WHERE LOWER(${roleCol}) IN ('courier','kurier')`
    sql += ` ORDER BY ${nameCol||'id'} ASC LIMIT 1000`
    const rows = await qAll(db, sql)
    const list = (rows||[]).map(r=>{
      const id=r.id
      const role=r[roleCol]||null
      const nm = r[nameCol] || `Kurier #${id}`
      return { id, name: String(nm), role: role||'courier' }
    })
    res.json({ok:true, couriers:list})
  }catch(e){ console.error('[courier_compat /couriers]', e); res.status(500).json({ok:false, couriers: []}) }
})

module.exports = router
