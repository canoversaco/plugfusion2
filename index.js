const express = require('express');
const ordersOpenUniform = require("./routes/orders.open.uniform");
const courierOrdersOpenAll = require("./routes/courier.orders.open.all");
const ordersJsonCompat = require("./routes/orders.json.compat");
const courierOrdersList = require("./routes/courier.orders.list");
const ordersOpenRead = require("./routes/orders-open.read");
const ordersAllOpen = require("./routes/orders-all.open");
const courierPanelApi = require("./routes/courier-panel.api");
const courierAllOrdersRoute = require("./routes/courier-all-orders");
const courierActionsRoute = require("./routes/courier-actions");
const courierOrdersRoute = require("./routes/courier-orders");
import 'dotenv/config'
const ordersCreateGuestOrUser = require("./routes/00-orders-create-guest-or-user");
const ordersCreateOverride = require("./routes/00-orders-create-override");
const authLoginOverride = require("./routes/00-auth-login-override");
const ordersCreateOverride = require("./routes/99-orders-create-override");
const cookieParser = require("cookie-parser");
import express from 'express'
import adminUsers from './routes/admin-users.js'
import adminAnalytics from './routes/admin-analytics.js'
import courierPanel from './routes/courier-panel.js'
import ordersCheckout from './routes/orders-checkout.js'
import ordersLive from './routes/orders-live.js'
import publicCore from './routes/02-public-core.js'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

// DB ist optional; Health prüft, ob sie antwortet
let dbQuery = async ()=>({ rows: [] })
try {
  const dbmod = await import('./db/index.js')
  dbQuery = dbmod.query || (dbmod.default && dbmod.default.query) || dbQuery
} catch (_) {}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()

/* ============================================
   [ORDERS_OVERRIDE_TOP] — frühe, auth-tolerante Bestellroute
   - handled /api/orders vollständig (kein next())
   - JWT optional (Header oder Cookie). Ohne JWT -> "guest"-User.
   ============================================ */
const jwt = require('jsonwebtoken');
const { db } = require('./db');
function getCookieToken(req){
  const raw = req.headers && req.headers.cookie;
  if (!raw) return null;
  const parts = raw.split(/;\s*/);
  for (const p of parts){
    const [k,...rest] = p.split('=');
    if (k === 'token') return rest.join('=');
  }
  return null;
}
function extractToken(req){
  const H = req.headers || {};
  const auth = H.authorization || H.Authorization;
  if (typeof auth === 'string'){
    const m = auth.match(/^Bearer\s+(.+)$/i);
    if (m) return m[1].trim();
    if (auth.length > 20) return auth.trim(); // ohne "Bearer"
  }
  const xt = H['x-auth-token'] || H['x-token'];
  if (xt && typeof xt === 'string' && xt.length > 10) return xt.trim();
  if (req.query && typeof req.query.token === 'string' && req.query.token.length > 10) return req.query.token.trim();
  const bt = req.body && (req.body.token || req.body.jwt || req.body.authToken);
  if (bt && typeof bt === 'string') return bt.trim();
  const ct = getCookieToken(req);
  if (ct && ct.length > 10) return ct.trim();
  return null;
}
async function one(sql, params){
  try { return await db.one(sql, params); } catch(_){}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.one(pg, params);
}
async function exec(sql, params){
  try { return await db.exec(sql, params); } catch(_){}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.exec(pg, params);
}
async function ensureGuestId(){
  let row = await one('select id from users where username = ?', ['guest']).catch(()=>null);
  if (!row){
    try { await exec('insert into users (username, role) values (?,?)', ['guest','kunde']); } catch(e){}
    row = await one('select id from users where username = ?', ['guest']).catch(()=>null);
  }
  return Number(row && row.id || 1);
}
async function getProductPricing(pid){
  const r = await one('select id, title, name, price_cents, price from products where id = ?', [pid]).catch(()=>null);
  if (!r) return null;
  let unit = 0;
  if (r.price_cents != null) unit = Number(r.price_cents) || 0;
  else if (r.price != null) unit = Math.round(Number(r.price) * 100) || 0;
  return { id: r.id, title: r.title || r.name || ('#'+r.id), unit_cents: unit };
}

// Route-Level Bodyparser, damit wir KEINE globalen Middlewares benötigen:
app.post('/api/orders', express.json(), async (req, res) => {
  try{
    // 1) User ermitteln: JWT (Header/Cookie) -> userId, sonst guest
    let userId = null;
    try {
      const tok = extractToken(req);
      if (tok){
        const p = jwt.verify(tok, process.env.JWT_SECRET || 'change_me_please');
        userId = Number(p.id || p.user_id || p.uid || p.sub) || null;
      }
    } catch(e){}
    if (!userId) userId = await ensureGuestId();

    // 2) Payload / Items prüfen
    const body = req.body || {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (!items.length) return res.status(400).json({ error:'no_items' });

    const norm=[]; 
    for (const it of items){
      const pid = Number(it.product_id || it.id);
      const qty = Math.max(1, Number(it.qty || 1));
      if (!pid || !isFinite(pid)) continue;
      norm.push({ product_id: pid, qty });
    }
    if (!norm.length) return res.status(400).json({ error:'no_valid_items' });

    // 3) Preise & Summen
    let subtotal = 0; const priced=[];
    for (const it of norm){
      const p = await getProductPricing(it.product_id);
      if (!p) return res.status(400).json({ error:'product_not_found', product_id: it.product_id });
      const line = p.unit_cents * it.qty;
      subtotal += line;
      priced.push({ ...it, unit_cents: p.unit_cents, line_cents: line });
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
    const isPg = !!(process.env.DB_DRIVER === 'pg' || process.env.DATABASE_URL);
    let orderId = null;
    if (isPg){
      const r = await one(
        'insert into orders (user_id, status, subtotal_cents, total_cents, payment_method, meeting_lat, meeting_lng, meeting_desc, meeting_status, created_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id',
        [userId, 'wartet_bestätigung', subtotal, total, payment_method, meeting_lat, meeting_lng, meeting_desc, meeting_status, nowIso]
      );
      orderId = r && r.id;
    } else {
      await exec(
        'insert into orders (user_id, status, subtotal_cents, total_cents, payment_method, meeting_lat, meeting_lng, meeting_desc, meeting_status, created_at) values (?,?,?,?,?,?,?,?,?,?)',
        [userId, 'wartet_bestätigung', subtotal, total, payment_method, meeting_lat, meeting_lng, meeting_desc, meeting_status, nowIso]
      );
      const r = await one('select last_insert_rowid() as id', []);
      orderId = r && r.id;
    }
    if (!orderId) return res.status(500).json({ error:'order_insert_failed' });

    // 6) Insert Items
    for (const it of priced){
      await exec('insert into order_items (order_id, product_id, qty, unit_price_cents, total_cents) values (?,?,?,?,?)',
        [orderId, it.product_id, it.qty, it.unit_cents, it.line_cents]
      ).catch(async()=>{
        await exec('insert into order_items (order_id, product_id, qty, unit_price_cents, total_cents) values ($1,$2,$3,$4,$5)',
          [orderId, it.product_id, it.qty, it.unit_cents, it.line_cents]);
      });
    }

    // 7) Antwort – wir beenden hier vollständig (KEIN next())
    return res.json({
      ok: true,
      order_id: orderId,
      total_cents: total,
      meeting: meeting_status ? { lat: meeting_lat, lng: meeting_lng, desc: meeting_desc, status: meeting_status } : null,
      payment_method
    });
  }catch(e){
    console.error('[ORDERS_OVERRIDE_TOP]', e);
    return res.status(500).json({ error:'server_error' });
  }
});
/* ===== END [ORDERS_OVERRIDE_TOP] ===== */
app.disable('x-powered-by')
app.use(cors({ origin: '*'}));
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }))
app.use(ordersOpenUniform);
app.use(courierOrdersOpenAll);
app.use(ordersJsonCompat);
app.use(courierOrdersList);
app.use(ordersOpenRead);
app.use(ordersAllOpen);
app.use(courierPanelApi);
app.use(courierAllOrdersRoute);
app.use(courierActionsRoute);
app.use(courierOrdersRoute);
app.use(ordersCreateGuestOrUser);
app.use(authLoginOverride);
app.use(ordersCreateOverride);
app.use(ordersCreateOverride);;
app.use('/api/courier', courierPanel);

app.use('/api', ordersCheckout);
app.use('/api', ordersLive);
app.use('/api', publicCore);

// --- Health
app.get('/api/health', async (_req,res)=>{
  let db = true
  try { await dbQuery('SELECT 1', []) } catch { db = false }
  res.json({ ok:true, db })
})

// --- Vorhandene Router aus ./routes automatisch mounten
const routesDir = path.join(__dirname, 'routes')
if (fs.existsSync(routesDir)) {
  for (const f of fs.readdirSync(routesDir)) {
    if (!f.endsWith('.js')) continue
    try {
      const mod = await import(path.join(routesDir, f))
      const router = mod.default || mod.router
      if (typeof router === 'function') {
        app.use('/api', router);
        console.log('[routes] mounted:', f)
      }
    } catch (e) {
      console.warn('[routes] skip', f, '-', e?.message)
    }
  }
}

// --- Statische Website (Vite build)
const dist = path.join(__dirname, '../web/dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist, { index: 'index.html', extensions: ['html'] }));
  // SPA-Fallback
  app.get(/^(?!\/api\/).*/, (_req,res)=> res.sendFile(path.join(dist, 'index.html')))
} else {
  console.warn('[web] dist/ fehlt – baue das Frontend und starte neu.')
}

const PORT = Number(process.env.PORT || 8080)
app.use('/api', require('./routes/courier_compat.js'));
app.listen(PORT, ()=> console.log(`[server] Plug Fusion läuft auf http://localhost:${PORT}`))
\n// Galerie-Uploads\nconst adminUploadRoute = require('./routes/admin-upload')\napp.use('/api/admin/upload', adminUploadRoute)

// plug-fusion auto-added routes (fallback register)
try { require("./routes/ui-extra")(app); } catch {}
try { require("./routes/courier-panel-compat")(app); } catch {}

// auto-added: chat SSE compat routes
try { require("./routes/chat-sse-compat")(app); } catch (e) { console.warn("chat-sse-compat failed:", e && e.message); }

// auto-added: ui extras
try { require("./routes/ui-extra")(app); } catch (e) { console.warn("auto-added: ui extras failed:", e && e.message); }

// auto-added: catalog compat
try { require("./routes/catalog-compat")(app); } catch (e) { console.warn("auto-added: catalog compat failed:", e && e.message); }

// auto-added: orders compat
try { require("./routes/orders-compat")(app); } catch (e) { console.warn("auto-added: orders compat failed:", e && e.message); }

// auto-added: orders live compat
try { require("./routes/orders-live-compat")(app); } catch (e) { console.warn("auto-added: orders live compat failed:", e && e.message); }
