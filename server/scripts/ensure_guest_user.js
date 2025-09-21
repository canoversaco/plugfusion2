const { db } = require('../db');
const bcrypt = require('bcryptjs');

async function one(sql, params){
  try { return await db.one(sql, params); } catch (_) {}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.one(pg, params);
}
async function exec(sql, params){
  try { return await db.exec(sql, params); } catch (_) {}
  let i=0; const pg = sql.replace(/\?/g, ()=>'$'+(++i));
  return db.exec(pg, params);
}

(async () => {
  // 1) vorhandenen Gast suchen
  let row = await one('select id from users where username = ?', ['guest']).catch(()=>null);
  if (row && row.id) { console.log(String(row.id)); return; }

  // 2) anlegen (deaktiviertes Passwort; Hash von zufälligem String)
  const hash = await bcrypt.hash('guest_disabled_'+Date.now(), 10);

  // Spaltenvielfalt abfedern (role/roles etc.)
  try {
    await exec(
      'insert into users (username, role, password_hash) values (?,?,?)',
      ['guest','kunde',hash]
    );
  } catch(e) {
    // PG/Schema-Fallbacks (falls Spalten anders heißen)
    try {
      await exec(
        'insert into users (username, password_hash) values (?,?)',
        ['guest',hash]
      );
    } catch(e2) {
      // letzter Versuch: minimal nur username
      await exec('insert into users (username) values (?)', ['guest']);
    }
  }

  row = await one('select id from users where username = ?', ['guest']).catch(()=>null);
  console.log(String(row && row.id ? row.id : '1'));
})().catch(e=>{ console.error(e); process.exit(1); });
