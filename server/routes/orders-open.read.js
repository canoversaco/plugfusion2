const express = require('express');
const router = express.Router();
const { db } = require('../db');

/* helper that works with sqlite OR pg adapter */
async function many(sql, params=[]){
  if (typeof db.all === 'function') {
    try { return await db.all(sql, params); } catch(_) {}
    try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.all(pg, params); } catch(_) {}
  }
  try { const r=await db.exec(sql, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); const r=await db.exec(pg, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  return [];
}
async function one(sql, params=[]){
  try { return await db.one(sql, params); } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.one(pg, params); } catch(_) {}
  return null;
}

async function sendOrders(req, res){
  try{
    const page  = Math.max(1, parseInt(req.query.page || '1', 10));
    const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '200', 10)));
    const offset = (page-1)*limit;

    const totalRow = await one('select count(1) n from orders', []) || { n:0 };
    const orders = await many(
      `select id, user_id, courier_id, status, subtotal_cents, total_cents,
              payment_method, meeting_lat, meeting_lng, meeting_desc,
              meeting_status, created_at, cancelled_at
       from orders
       order by id desc
       limit ? offset ?`, [limit, offset]
    );

    const out = [];
    for (const o of orders){
      const items = await many(
        `select product_id, qty, unit_price_cents, total_cents
         from order_items where order_id = ? order by rowid asc`, [o.id]
      );
      out.push({ ...o, items });
    }

    res.json({ ok:true, page, limit, total: Number(totalRow.n||0), orders: out });
  }catch(e){
    console.error('[orders-open.read]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
}

router.get('/api/orders-open', sendOrders);   // Variante mit /api
router.get('/orders-open', sendOrders);       // Variante ohne /api (wie im Screenshot)

module.exports = router;
