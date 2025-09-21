const express = require('express');
const router = express.Router();
const { db } = require('../db');

// Helpers, die mit sqlite ODER pg klarkommen
async function many(sql, params=[]){
  if (typeof db.all === 'function') {            // sqlite-ähnlich
    try { return await db.all(sql, params); } catch(_) {}
    try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.all(pg, params); } catch(_) {}
  }
  try { const r=await db.exec(sql, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); const r=await db.exec(pg, params); if (Array.isArray(r)) return r; if (r&&r.rows) return r.rows; } catch(_) {}
  return [];
}

router.get('/api/courier/orders-list', async (req, res)=>{
  try{
    // exakt wie im Admin: alle Orders, id DESC
    const orders = await many(
      `select id, user_id, courier_id, status, subtotal_cents, total_cents,
              payment_method, meeting_lat, meeting_lng, meeting_desc,
              meeting_status, created_at, cancelled_at
       from orders
       order by id desc`, []
    );

    // Items dazuholen
    const out = [];
    for (const o of orders){
      const items = await many(
        `select product_id, qty, unit_price_cents, total_cents
         from order_items where order_id = ? order by rowid asc`, [o.id]
      );
      out.push({ ...o, items });
    }

    res.json({ ok:true, total: out.length, orders: out });
  }catch(e){
    console.error('[courier.orders.list]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
});

module.exports = router;
