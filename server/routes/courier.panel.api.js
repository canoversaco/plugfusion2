const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { db } = require('../db');

/* ---------- DB Utils (sqlite/pg tolerant) ---------- */
async function many(sql, params=[]) {
  if (typeof db.all === 'function') {
    try { return await db.all(sql, params); } catch(_) {}
    try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.all(pg, params); } catch(_) {}
  }
  try { const r=await db.exec(sql, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); const r=await db.exec(pg, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  return [];
}
async function one(sql, params=[]) {
  try { return await db.one(sql, params); } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.one(pg, params); } catch(_) {}
  return null;
}
async function exec(sql, params=[]) {
  try { return await db.exec(sql, params); } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.exec(pg, params); } catch(_) {}
  return null;
}

/* ---------- Auth helper nur zur Courier-ID ---------- */
function extractToken(req){
  const H=req.headers||{};
  const a=H.authorization||H.Authorization;
  if (typeof a==='string'){
    const m=a.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    if (a.length>20) return a.trim();
  }
  if (req.cookies && typeof req.cookies.token==='string') return req.cookies.token;
  return null;
}
function getCourierId(req){
  try {
    const t=extractToken(req);
    if (t){
      const p=jwt.verify(t, process.env.JWT_SECRET||'change_me_please');
      const id=Number(p.id||p.user_id||p.uid||p.sub);
      if (id) return id;
    }
  } catch(_){}
  const cid=Number(req.body && req.body.courier_id);
  if (cid) return cid;
  return 1;
}

/* ---------- Schema-Sicherheit (idempotent) ---------- */
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

/* ---------- LIST ---------- */
router.get('/api/courier/panel/orders', async (req, res)=>{
  try{
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit || '50', 10)));
    const offset = (page-1)*limit;
    const status = String(req.query.status||'all').toLowerCase();
    const q = (req.query.q||'').trim();

    let where='1=1'; const args=[];
    if (status==='open'){
      where += " AND (lower(status) IN ('wartet_bestätigung','wartet_bestaetigung'))";
    } else if (status!=='all'){
      where += " AND lower(status)=?";
      args.push(status);
    }
    if (q){
      if (/^\d+$/.test(q)){
        where += " AND (id=? OR CAST(user_id AS text)=?)";
        args.push(Number(q), q);
      } else {
        where += " AND (COALESCE(meeting_desc,'') LIKE ?)";
        args.push('%'+q+'%');
      }
    }

    const totalRow = await one(`SELECT COUNT(1) n FROM orders WHERE ${where}`, args) || { n:0 };
    const rows = await many(
      `SELECT id, user_id, courier_id, status, subtotal_cents, total_cents,
              payment_method, meeting_lat, meeting_lng, meeting_desc,
              meeting_status, created_at, cancelled_at
       FROM orders
       WHERE ${where}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`, [...args, limit, offset]
    );

    const out=[];
    for (const o of rows){
      const items = await many(
        `SELECT product_id, qty, unit_price_cents, total_cents
         FROM order_items WHERE order_id=? ORDER BY rowid ASC`, [o.id]
      );
      out.push({ ...o, items });
    }

    res.json({ ok:true, page, limit, total:Number(totalRow.n||0), orders:out });
  }catch(e){
    console.error('[courier.panel.list]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

/* ---------- ACCEPT ---------- */
router.post('/api/courier/panel/orders/:id/accept', express.json(), async (req, res)=>{
  try{
    await ensureColumns();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'bad_id' });
    const courierId = getCourierId(req);

    const ord = await one('SELECT id,status FROM orders WHERE id=?', [id]).catch(()=>null);
    if (!ord) return res.status(404).json({ ok:false, error:'not_found' });
    if (String(ord.status).toLowerCase()==='storniert') return res.status(409).json({ ok:false, error:'already_cancelled' });

    await exec('UPDATE orders SET status=?, courier_id=? WHERE id=?', ['akzeptiert', courierId, id]);
    res.json({ ok:true, id, status:'akzeptiert', courier_id:courierId });
  }catch(e){
    console.error('[courier.panel.accept]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

/* ---------- DECLINE ---------- */
router.post('/api/courier/panel/orders/:id/decline', express.json(), async (req, res)=>{
  try{
    await ensureColumns();
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ ok:false, error:'bad_id' });
    const nowIso = new Date().toISOString();
    await exec('UPDATE orders SET status=?, cancelled_at=? WHERE id=?', ['storniert', nowIso, id]);
    res.json({ ok:true, id, status:'storniert', cancelled_at:nowIso });
  }catch(e){
    console.error('[courier.panel.decline]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

module.exports = router;
