const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../db');

async function exec(sql, params=[]){
  try { return await db.exec(sql, params); } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.exec(pg, params); } catch(_) {}
  return null;
}
async function one(sql, params=[]){
  try { return await db.one(sql, params); } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.one(pg, params); } catch(_) {}
  return null;
}
async function ensureColumns(){
  const isPg = !!(process.env.DB_DRIVER==='pg' || process.env.DATABASE_URL);
  if (isPg){
    await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id integer`);
    await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`);
  } else {
    await exec(`ALTER TABLE orders ADD COLUMN courier_id integer`);
    await exec(`ALTER TABLE orders ADD COLUMN cancelled_at text`);
  }
}
function getCourierId(req){
  try{
    const auth = req.headers.authorization || req.headers.Authorization;
    let tok = null;
    if (auth && typeof auth === 'string') {
      const m = auth.match(/^Bearer\s+(.+)$/i);
      tok = m ? m[1] : (auth.length>20 ? auth : null);
    }
    if (!tok && req.cookies && typeof req.cookies.token==='string') tok = req.cookies.token;
    if (tok){
      const p = jwt.verify(tok, process.env.JWT_SECRET || 'change_me_please');
      const id = Number(p.id || p.user_id || p.uid || p.sub);
      if (id) return id;
    }
  }catch(_){}
  const b = Number(req.body && req.body.courier_id);
  if (b) return b;
  return 1;
}

router.post('/api/courier/orders/:id/accept', express.json(), async (req, res)=>{
  try{
    await ensureColumns();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'bad_id' });
    const courierId = getCourierId(req);

    const ord = await one('select id, status from orders where id = ?', [id]).catch(()=>null);
    if (!ord) return res.status(404).json({ ok:false, error:'not_found' });
    if (String(ord.status).toLowerCase()==='storniert') return res.status(409).json({ ok:false, error:'already_cancelled' });

    await exec('update orders set status=?, courier_id=? where id=?', ['akzeptiert', courierId, id]);
    res.json({ ok:true, id, status:'akzeptiert', courier_id:courierId });
  }catch(e){
    console.error('[courier-accept]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

router.post('/api/courier/orders/:id/decline', express.json(), async (req, res)=>{
  try{
    await ensureColumns();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'bad_id' });
    const nowIso = new Date().toISOString();
    await exec('update orders set status=?, cancelled_at=? where id=?', ['storniert', nowIso, id]);
    res.json({ ok:true, id, status:'storniert', cancelled_at: nowIso });
  }catch(e){
    console.error('[courier-decline]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

module.exports = router;
