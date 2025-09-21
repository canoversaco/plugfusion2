const DB=require("../db");
async function q(sql,params=[]){ try{return await DB.query(sql,params);}catch(e1){ if(sql.includes("?")){let i=1;const pg=sql.replace(/\?/g,_=>"$"+(i++)); return await DB.query(pg,params);} throw e1; } }
(async()=>{
  // tables
  await q("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE)",[]);
  try{ await q("CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, title TEXT, name TEXT, image TEXT, price REAL, unit_price REAL, cost REAL, category_id INTEGER, category TEXT, stock INTEGER DEFAULT 999)",[]);}
  catch{ await q("CREATE TABLE IF NOT EXISTS products (id SERIAL PRIMARY KEY, title TEXT, name TEXT, image TEXT, price NUMERIC, unit_price NUMERIC, cost NUMERIC, category_id INTEGER, category TEXT, stock INTEGER DEFAULT 999)",[]); }
  await q("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, role TEXT)",[]);
  try{ await q("CREATE TABLE IF NOT EXISTS orders (id INTEGER PRIMARY KEY, user_id INTEGER, courier_id INTEGER, status TEXT, cart_json TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, completed_at DATETIME)",[]);}
  catch{ await q("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id INTEGER, courier_id INTEGER, status TEXT, cart_json TEXT, created_at TIMESTAMP DEFAULT NOW(), completed_at TIMESTAMP)",[]); }
  try{ await q("CREATE TABLE IF NOT EXISTS order_items (id INTEGER PRIMARY KEY, order_id INTEGER, product_id INTEGER, title TEXT, qty INTEGER, price REAL)",[]);}
  catch{ await q("CREATE TABLE IF NOT EXISTS order_items (id SERIAL PRIMARY KEY, order_id INTEGER, product_id INTEGER, title TEXT, qty INTEGER, price NUMERIC)",[]); }

  // seed categories
  const catCount=await q("SELECT COUNT(1) as c FROM categories",[]); const c=(catCount.rows||catCount||[{c:0}])[0].c||0;
  if(!c){
    const cats=[["Snacks","snacks"],["Getränke","getraenke"],["Specials","specials"]];
    for(const [name,slug] of cats){ await q("INSERT INTO categories (name,slug) VALUES (?,?)",[name,slug]); }
  }
  // fetch cat ids
  const catsAll=(await q("SELECT id,name,slug FROM categories ORDER BY id ASC",[])).rows||[];
  const byName=Object.fromEntries(catsAll.map(x=>[x.name,x.id]));
  // seed products
  const pCount=await q("SELECT COUNT(1) as c FROM products",[]); const pc=(pCount.rows||pCount||[{c:0}])[0].c||0;
  if(!pc){
    const demo=[
      {title:"Chips Paprika",price:2.49,cat:"Snacks",img:"https://picsum.photos/seed/chips/400/300"},
      {title:"Schokolade Zartbitter",price:1.99,cat:"Snacks",img:"https://picsum.photos/seed/schoko/400/300"},
      {title:"Cola 0,5L",price:1.79,cat:"Getränke",img:"https://picsum.photos/seed/cola/400/300"},
      {title:"Wasser 0,5L",price:1.29,cat:"Getränke",img:"https://picsum.photos/seed/wasser/400/300"},
      {title:"Mystery Box",price:9.99,cat:"Specials",img:"https://picsum.photos/seed/mystery/400/300"}
    ];
    for(const p of demo){
      const cid = byName[p.cat]||null;
      await q("INSERT INTO products (title,name,image,price,category_id,category,stock) VALUES (?,?,?,?,?,?,?)",[p.title,p.title,p.img,p.price,cid,p.cat,999]);
    }
  }
  // users
  const uCount=await q("SELECT COUNT(1) as c FROM users",[]); const uc=(uCount.rows||uCount||[{c:0}])[0].c||0;
  if(!uc){
    await q("INSERT INTO users (username,role) VALUES (?,?)",["admin","admin"]);
    await q("INSERT INTO users (username,role) VALUES (?,?)",["kurier1","courier"]);
    await q("INSERT INTO users (username,role) VALUES (?,?)",["kunde1","customer"]);
  }
  const users=(await q("SELECT * FROM users",[])).rows||[];
  const uid=(name)=> (users.find(u=>u.username===name)||{}).id;

  // orders + items
  const oCount=await q("SELECT COUNT(1) as c FROM orders",[]); const oc=(oCount.rows||oCount||[{c:0}])[0].c||0;
  if(!oc){
    const prods=(await q("SELECT id,title,price FROM products",[])).rows||[];
    function mkOrder(user,status,courier=null,items=[{i:prods[0],qty:1},{i:prods[2],qty:2}]){
      return {user, status, courier, items: items.map(x=>({product_id:x.i.id, title:x.i.title, qty:x.qty, price:x.i.price}))};
    }
    const o1=mkOrder(uid("kunde1"),"open",null);
    const o2=mkOrder(uid("kunde1"),"accepted",uid("kurier1"));
    const o3=mkOrder(uid("kunde1"),"completed",uid("kurier1"));
    for(const O of [o1,o2,o3]){
      const cart={items:O.items}; const ins=await q("INSERT INTO orders (user_id,courier_id,status,cart_json) VALUES (?,?,?,?) RETURNING id",[O.user,O.courier,O.status,JSON.stringify(cart)]);
      const id=(ins.rows&&ins.rows[0]&&ins.rows[0].id)|| (await q("SELECT MAX(id) as id FROM orders",[])).rows[0].id;
      for(const it of O.items){ await q("INSERT INTO order_items (order_id,product_id,title,qty,price) VALUES (?,?,?,?,?)",[id,it.product_id,it.title,it.qty,it.price]); }
      if(O.status==="completed"){ try{ await q("UPDATE orders SET completed_at=CURRENT_TIMESTAMP WHERE id=?",[id]); }catch{ await q("UPDATE orders SET completed_at=NOW() WHERE id=$1",[id]); } }
    }
  }
  console.log("✅ Seed fertig.");
  process.exit(0);
})().catch(e=>{ console.error(e); process.exit(1); });
