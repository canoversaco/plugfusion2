const express = require('express');
const router = express.Router();
const { db } = require('../db');
const { extractToken, verifyToken } = require('../lib/auth_helpers');

async function one(sql, params) {
  try { return await db.one(sql, params); } catch(_) {}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.one(pg, params);
}
async function exec(sql, params) {
  try { return await db.exec(sql, params); } catch(_) {}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.exec(pg, params);
}
async function getProductPricing(productId) {
  const row = await one('select id, title, name, price_cents, price from products where id = ?', [productId]).catch(()=>null);
  if (!row) return null;
  let unit = 0;
  if (row.price_cents != null) unit = Number(row.price_cents) || 0;
  else if (row.price != null) unit = Math.round(Number(row.price) * 100) || 0;
  return { id: row.id, title: row.title || row.name || ('#'+row.id), unit_cents: unit };
}

router.post('/api/orders', express.json(), async (req, res) => {
  try{
    // 1) Auth direkt hier prüfen (Header oder Cookie)
    const t = extractToken(req);
    if (!t) return res.status(401).json({ error: 'unauth', reason: 'no_token' });
    const p = verifyToken(t);
    const userId = Number(p.id || p.user_id || p.uid || p.sub);
    if (!userId) return res.status(401).json({ error: 'unauth', reason: 'invalid_payload' });

    // 2) Payload validieren
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error: 'no_items' });

    const norm = [];
    for (const it of items) {
      const pid = Number(it.product_id || it.id);
      const qty = Math.max(1, Number(it.qty || 1));
      if (!pid || !isFinite(pid)) continue;
      norm.push({ product_id: pid, qty });
    }
    if (!norm.length) return res.status(400).json({ error: 'no_valid_items' });

    // 3) Preise & Summen
    let subtotal = 0;
    const priced = [];
    for (const it of norm) {
      const prod = await getProductPricing(it.product_id);
      if (!prod) return res.status(400).json({ error: 'product_not_found', product_id: it.product_id });
      const line = prod.unit_cents * it.qty;
      subtotal += line;
      priced.push({ ...it, unit_cents: prod.unit_cents, line_cents: line });
    }
    const fees = 0;
    const total = subtotal + fees;

    // 4) Meeting & Payment
    const mp = body.meeting_point || {};
    const meeting_lat = (mp && mp.lat != null) ? Number(mp.lat) : null;
    const meeting_lng = (mp && mp.lng != null) ? Number(mp.lng) : null;
    const meeting_desc = (mp && mp.desc != null) ? String(mp.desc) : null;
    const meeting_status = (meeting_lat != null || meeting_lng != null || meeting_desc) ? 'suggested' : null;
    const payment_method = (body.payment === 'wallet' || body.pay_with_wallet) ? 'wallet' : 'cash';

    // 5) Insert Order
    const nowIso = new Date().toISOString();
    const driver = (process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'pg' : 'sqlite')).toLowerCase();

    let orderId = null;
    if (driver === 'pg') {
      const row = await one(
        `insert into orders
          (user_id, status, subtotal_cents, total_cents, payment_method,
           meeting_lat, meeting_lng, meeting_desc, meeting_status, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         returning id`,
        [userId, 'wartet_bestätigung', subtotal, total, payment_method,
         meeting_lat, meeting_lng, meeting_desc, meeting_status, nowIso]
      );
      orderId = row && row.id;
    } else {
      await exec(
        `insert into orders
          (user_id, status, subtotal_cents, total_cents, payment_method,
           meeting_lat, meeting_lng, meeting_desc, meeting_status, created_at)
         values (?,?,?,?,?,?,?,?,?,?)`,
        [userId, 'wartet_bestätigung', subtotal, total, payment_method,
         meeting_lat, meeting_lng, meeting_desc, meeting_status, nowIso]
      );
      const row = await one('select last_insert_rowid() as id', []);
      orderId = row && row.id;
    }
    if (!orderId) return res.status(500).json({ error: 'order_insert_failed' });

    // 6) Insert Items
    for (const it of priced) {
      await exec(
        `insert into order_items (order_id, product_id, qty, unit_price_cents, total_cents)
         values (?,?,?,?,?)`,
        [orderId, it.product_id, it.qty, it.unit_cents, it.line_cents]
      ).catch(async() => {
        await exec(
          `insert into order_items (order_id, product_id, qty, unit_price_cents, total_cents)
           values ($1,$2,$3,$4,$5)`,
          [orderId, it.product_id, it.qty, it.unit_cents, it.line_cents]
        );
      });
    }

    return res.json({
      ok: true,
      order_id: orderId,
      total_cents: total,
      meeting: meeting_status ? { lat: meeting_lat, lng: meeting_lng, desc: meeting_desc, status: meeting_status } : null,
      payment_method
    });
  } catch(e){
    console.error('[orders-override]', e);
    return res.status(500).json({ error: 'server_error' });
  }
});

module.exports = router;
