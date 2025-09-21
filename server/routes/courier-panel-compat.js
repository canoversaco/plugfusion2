const DB = require("../db");

function userId(req) {
  return (req.user && (req.user.id || req.user.user_id)) || req.headers["x-user-id"] || req.headers["x-user"] || null;
}
async function query(sql, params) {
  if (!DB || !DB.query) throw new Error("DB not ready");
  return DB.query(sql, params);
}

module.exports = (app /*, db, mw */) => {
  // Bestellung annehmen
  app.post("/api/courier/accept", async (req, res) => {
    const { order_id, courier_id } = req.body || {};
    const cid = courier_id || userId(req);
    try {
      await query("UPDATE orders SET status = ?, courier_id = ? WHERE id = ?",
        ["accepted", cid, order_id]);
      res.json({ ok: true });
    } catch (e) {
      // PG fallback
      try {
        await query("UPDATE orders SET status = $1, courier_id = $2 WHERE id = $3",
          ["accepted", cid, order_id]);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: String(err.message || err) });
      }
    }
  });

  // Status setzen (allgemein)
  app.post("/api/orders/status", async (req, res) => {
    const { id, status, courier_id } = req.body || {};
    try {
      await query("UPDATE orders SET status = ?, courier_id = COALESCE(?, courier_id) WHERE id = ?",
        [status, courier_id || null, id]);
      res.json({ ok: true });
    } catch (e) {
      try {
        await query("UPDATE orders SET status = $1, courier_id = COALESCE($2, courier_id) WHERE id = $3",
          [status, courier_id || null, id]);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: String(err.message || err) });
      }
    }
  });

  // Bestellung abschließen
  app.post("/api/orders/:id/complete", async (req, res) => {
    const id = req.params.id;
    try {
      await query("UPDATE orders SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
        [id]);
      res.json({ ok: true });
    } catch (e) {
      try {
        await query("UPDATE orders SET status = 'completed', completed_at = NOW() WHERE id = $1", [id]);
        res.json({ ok: true });
      } catch (err) {
        res.status(400).json({ error: String(err.message || err) });
      }
    }
  });

  // Kurier-Orders Liste (pragmatisch)
  app.get("/api/courier/orders", async (req, res) => {
    const cid = userId(req);
    try {
      const r = await query("SELECT * FROM orders ORDER BY id DESC LIMIT 200", []);
      const rows = r.rows || r || [];
      const mine = rows.filter(o => !o.status || ["open","accepted","in_progress","en_route"].includes(String(o.status).toLowerCase()) || (o.courier_id==cid));
      res.json({ orders: mine });
    } catch (err) {
      res.json({ orders: [] });
    }
  });
};
