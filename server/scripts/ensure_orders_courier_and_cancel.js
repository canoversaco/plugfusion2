const { db } = require('../db');

(async ()=>{
  const driver = (process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'pg' : 'sqlite')).toLowerCase();
  async function exec(sql){ try{ await db.exec(sql); }catch(e){} }

  if (driver==='pg'){
    await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_id integer`);
    await exec(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS cancelled_at timestamptz`);
  } else {
    await exec(`ALTER TABLE orders ADD COLUMN courier_id integer`);
    await exec(`ALTER TABLE orders ADD COLUMN cancelled_at text`);
  }
  console.log('ok: orders.courier_id / orders.cancelled_at ready');
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
