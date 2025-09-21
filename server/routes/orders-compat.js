const DB=require("../db");
function who(req){ return (req.user&&(req.user.id||req.user.user_id))||req.headers["x-user-id"]||req.headers["x-user"]||null; }
async function q(sql,params=[]){ try{return await DB.query(sql,params);}catch(e1){ if(sql.includes("?")){let i=1;const pg=sql.replace(/\?/g,_=>"$"+(i++));return await DB.query(pg,params);} throw e1; } }
module.exports=(app)=>{
  // eigene Bestellungen inkl. Positionen
  app.get("/api/my/orders",async(req,res)=>{
    const me=who(req);
    const base=async(sql,p)=>{ const r=await q(sql,p); const orders=r.rows||r||[];
      for(const o of orders){
        try{
          const ri=await q("SELECT id, order_id, product_id, title, qty, price FROM order_items WHERE order_id = ? ORDER BY id ASC",[o.id||o.order_id]);
          o.items=(ri.rows||ri||[]).map(x=>({id:x.product_id||x.id,title:x.title,qty:x.qty,price:Number(x.price||0)}));
          o.cart_json = o.cart_json || JSON.stringify({items:o.items});
        }catch{}
      }
      return orders;
    };
    try{ const orders=await base("SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 200",[me]); return res.json({orders}); }catch{}
    try{ const orders=await base("SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC LIMIT 200",[me]); return res.json({orders}); }catch{}
    return res.json({orders:[]});
  });

  // kurier: offene & eigene
  app.get("/api/courier/orders",async(req,res)=>{
    const me=who(req);
    try{
      const r=await q("SELECT * FROM orders ORDER BY id DESC LIMIT 200",[]);
      const rows=r.rows||r||[];
      const mine=rows.filter(o=>{ const s=String(o.status||"").toLowerCase(); return ["open","accepted","in_progress","en_route"].includes(s) || (o.courier_id==me); });
      return res.json({orders:mine});
    }catch{ return res.json({orders:[]}); }
  });

  // unified
  app.get("/api/orders",async(req,res)=>{
    const scope=String(req.query.scope||"");
    if(scope==="me") return app._router.handle({...req,url:"/api/my/orders",method:"GET"},res,()=>{});
    if(scope==="courier") return app._router.handle({...req,url:"/api/courier/orders",method:"GET"},res,()=>{});
    try{ const r=await q("SELECT * FROM orders ORDER BY id DESC LIMIT 100",[]); return res.json({orders:r.rows||r||[]}); }catch{ return res.json({orders:[]}); }
  });

  // status setzen
  app.post("/api/orders/status",async(req,res)=>{
    const {id,status,courier_id}=req.body||{};
    const tries=[
      ["UPDATE orders SET status=?, courier_id=COALESCE(?, courier_id) WHERE id=?",[status,courier_id||null,id]],
      ["UPDATE orders SET status=$1, courier_id=COALESCE($2, courier_id) WHERE id=$3",[status,courier_id||null,id]],
    ];
    for(const [sql,p] of tries){ try{ await q(sql,p); return res.json({ok:true}); }catch{} }
    res.status(400).json({error:"failed"});
  });

  // abschließen
  app.post("/api/orders/:id/complete",async(req,res)=>{
    const id=req.params.id;
    const tries=[
      ["UPDATE orders SET status='completed', completed_at=CURRENT_TIMESTAMP WHERE id=?",[id]],
      ["UPDATE orders SET status='completed', completed_at=NOW() WHERE id=$1",[id]],
    ];
    for(const [sql,p] of tries){ try{ await q(sql,p); return res.json({ok:true}); }catch{} }
    res.status(400).json({error:"failed"});
  });

  // kurier annehmen
  app.post("/api/courier/accept",async(req,res)=>{
    const {order_id,courier_id}=req.body||{};
    const cid=courier_id||who(req);
    const tries=[
      ["UPDATE orders SET status='accepted', courier_id=? WHERE id=?",[cid,order_id]],
      ["UPDATE orders SET status='accepted', courier_id=$1 WHERE id=$2",[cid,order_id]],
    ];
    for(const [sql,p] of tries){ try{ await q(sql,p); return res.json({ok:true}); }catch{} }
    res.status(400).json({error:"failed"});
  });
};