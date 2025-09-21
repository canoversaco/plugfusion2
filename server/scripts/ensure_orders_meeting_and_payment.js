const { db } = require('../db');
(async () => {
  const driver = process.env.DB_DRIVER || (process.env.DATABASE_URL ? 'pg' : 'sqlite');
  const run = (sql)=>db.exec(sql).catch(()=>{});
  if (driver==='sqlite'){
    await run(`ALTER TABLE orders ADD COLUMN meeting_lat REAL`);
    await run(`ALTER TABLE orders ADD COLUMN meeting_lng REAL`);
    await run(`ALTER TABLE orders ADD COLUMN meeting_desc TEXT`);
    await run(`ALTER TABLE orders ADD COLUMN meeting_status TEXT`); -- suggested/accepted/changed
    await run(`ALTER TABLE orders ADD COLUMN payment_method TEXT`); -- wallet/cash
  } else {
    await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS meeting_lat double precision`);
    await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS meeting_lng double precision`);
    await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS meeting_desc text`);
    await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS meeting_status text`);
    await run(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text`);
  }
  console.log('ok: orders meeting & payment columns ready');
  process.exit(0);
})().catch(e=>{console.error(e);process.exit(1)});
