
const DB = require("../db");
const subs = new Map(); // order_id -> Set(res)

function room(id){ if (!subs.has(id)) subs.set(id, new Set()); return subs.get(id); }
function broadcast(id, payload){
  const data = JSON.stringify(payload);
  for (const res of room(id)) { try { res.write(`data: ${data}\n\n`); } catch {} }
}
async function q(sql, params=[]){
  try { return await DB.query(sql, params); } catch (e1) {
    if (sql.includes("?")) { let i=1; const pg = sql.replace(/\?/g,_=>"$"+(i++)); return await DB.query(pg, params); }
    throw e1;
  }
}
async function ensureTables(){
  try {
    await q("CREATE TABLE IF NOT EXISTS order_locations (id INTEGER PRIMARY KEY, order_id INTEGER, lat REAL, lng REAL, heading REAL, speed REAL, ts DATETIME DEFAULT CURRENT_TIMESTAMP)", []);
  } catch {
    await q("CREATE TABLE IF NOT EXISTS order_locations (id SERIAL PRIMARY KEY, order_id INTEGER, lat NUMERIC, lng NUMERIC, heading NUMERIC, speed NUMERIC, ts TIMESTAMP DEFAULT NOW())", []);
  }
}

module.exports = (app) => {
  // SSE stream per order
  const ssePaths = [
    "/api/orders/:id/sse",
    "/api/orders-live/:id/sse",
    "/api/orders-live/sse"
  ];
  for (const p of ssePaths) {
    app.get(p, async (req, res) => {
      const id = String(req.params.id || req.query.id || "");
      if (!id) return res.status(400).json({ error: "id required" });
      await ensureTables();
      res.setHeader("Content-Type","text/event-stream");
      res.setHeader("Cache-Control","no-cache");
      res.setHeader("Connection","keep-alive");
      res.flushHeaders && res.flushHeaders();
      res.write("retry: 2000\n\n");
      room(id).add(res);
      req.on("close", ()=> room(id).delete(res));
      // send last known
      try {
        const r = await q("SELECT lat, lng, heading, speed, ts FROM order_locations WHERE order_id = ? ORDER BY id DESC LIMIT 1", [id]);
        const row = (r.rows || r || [])[0];
        if (row) res.write(`data: ${JSON.stringify({coords:{lat:Number(row.lat), lng:Number(row.lng), heading:row.heading, speed:row.speed}, ts:row.ts})}\n\n`);
      } catch {}
    });
  }

  // location updates (courier)
  const locPaths = [
    "/api/orders/:id/location",
    "/api/orders-live/:id/location",
  ];
  for (const p of locPaths) {
    app.post(p, async (req, res) => {
      const id = String(req.params.id || "");
      const { lat, lng, heading=null, speed=null } = req.body || {};
      if (!id || typeof lat !== "number" || typeof lng !== "number") {
        return res.status(400).json({ error: "lat,lng required" });
      }
      await ensureTables();
      try {
        await q("INSERT INTO order_locations (order_id, lat, lng, heading, speed) VALUES (?, ?, ?, ?, ?)", [id, lat, lng, heading, speed]);
      } catch {
        await q("INSERT INTO order_locations (order_id, lat, lng, heading, speed) VALUES ($1, $2, $3, $4, $5)", [id, lat, lng, heading, speed]);
      }
      // very naive ETA: just constant 10
      broadcast(id, { coords: {lat, lng, heading, speed}, eta: 10, status: "en_route", ts: Date.now() });
      res.json({ ok: true });
    });
  }
};
