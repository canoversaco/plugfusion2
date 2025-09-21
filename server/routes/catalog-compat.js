const DB=require("../db");
async function q(sql,params=[]){ try{return await DB.query(sql,params);}catch(e1){ if(sql.includes("?")){let i=1;const pg=sql.replace(/\?/g,_=>"$"+(i++));return await DB.query(pg,params);} throw e1; } }
module.exports=(app)=>{
  app.get("/api/categories",async(req,res)=>{
    try{const r=await q("CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY, name TEXT, slug TEXT UNIQUE)",[]);
        const rr=await q("SELECT id, name, slug FROM categories ORDER BY name ASC",[]);
        const rows=rr.rows||rr||[]; if(rows.length) return res.json({categories:rows});}catch{}
    try{
      const r=await q("SELECT DISTINCT category as name FROM products WHERE category IS NOT NULL ORDER BY category ASC",[]);
      const rows=(r.rows||r||[]).map((x,i)=>({id:x.id||i+1,name:x.name||x.category,slug:String(x.name||"").toLowerCase().replace(/\s+/g,'-')}));
      return res.json({categories:rows});
    }catch{ return res.json({categories:[]});}
  });
  app.get("/api/menu/products",async(req,res)=>{
    const cat=String(req.query.category||"").trim();
    if(!cat) return res.json({products:[]});
    if(cat.toLowerCase()==="all"){
      try{const r=await q("SELECT id,title,name,image,price,unit_price,cost,category_id,category FROM products ORDER BY id DESC LIMIT 200",[]);
          return res.json({products:r.rows||r||[]});}catch{ return res.json({products:[]});}
    }
    const tries=[
      ["SELECT id,title,name,image,price,unit_price,cost,category_id,category FROM products WHERE category_id=? OR category=? ORDER BY id DESC LIMIT 200",[cat,cat]],
      ["SELECT id,title,name,image,price,unit_price,cost,category_id,category FROM products WHERE category_id=$1 OR category=$2 ORDER BY id DESC LIMIT 200",[cat,cat]],
    ];
    for(const [sql,p] of tries){ try{const r=await q(sql,p); return res.json({products:r.rows||r||[]});}catch{} }
    return res.json({products:[]});
  });
};