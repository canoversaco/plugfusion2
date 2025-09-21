const express = require('express');
const router = express.Router();
const { db } = require('../db');

// helpers für sqlite ODER pg
async function many(sql, params = []) {
  if (typeof db.all === 'function') {
    try { return await db.all(sql, params); } catch (_) {}
    try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); return await db.all(pg, params); } catch (_) {}
  }
  try { const r = await db.exec(sql, params); if (Array.isArray(r)) return r; if (r && r.rows) return r.rows; } catch (_) {}
  try { let i=0; const pg=sql.replace(/\?/g,()=>'$'+(++i)); const r = await db.exec(pg, params); if (Array.isArray(r)) return r; if (r && r.rows) return r.rows; } catch (_) {}
  return [];
}

async function listOrders() {
  const orders = await many(
    `select id, user_id, courier_id, status, subtotal_cents, total_cents,
            payment_method, meeting_lat, meeting_lng, meeting_desc,
            meeting_status, created_at, cancelled_at
     from orders
     order by id desc`, []
  );
  const out = [];
  for (const o of orders) {
    const items = await many(
      `select product_id, qty, unit_price_cents, total_cents
       from order_items where order_id = ? order by rowid asc`, [o.id]
    );
    out.push({ ...o, items });
  }
  return out;
}

async function sendJson(req, res) {
  try {
    const data = await listOrders();
    res.set('content-type','application/json; charset=utf-8');
    res.json({ ok:true, total:data.length, orders:data });
  } catch (e) {
    console.error('[orders.open.uniform]', e);
    res.status(500).json({ ok:false, error:'server_error' });
  }
}

// Immer JSON & ohne Auth:
router.get('/api/orders', sendJson);

module.exports = router;
