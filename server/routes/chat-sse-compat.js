const DB=require("../db"); const subs=new Map();
function setFor(room){ if(!subs.has(room)) subs.set(room,new Set()); return subs.get(room); }
function broadcast(room,msg){ const data=JSON.stringify({type:"chat",data:msg}); for(const res of setFor(room)){ try{ res.write(`data: ${data}\n\n`);}catch{} } }
async function q(sql,params=[]){ try{return await DB.query(sql,params);}catch(e1){ if(sql.includes("?")){let i=1;const pg=sql.replace(/\?/g,_=>"$"+(i++)); return await DB.query(pg,params);} throw e1; } }
async function ensure(){ try{ await q("CREATE TABLE IF NOT EXISTS chat_messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT, user_id TEXT, author TEXT, text TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)",[]); }
catch{ try{ await DB.query("CREATE TABLE IF NOT EXISTS chat_messages (id SERIAL PRIMARY KEY, room TEXT, user_id TEXT, author TEXT, text TEXT, created_at TIMESTAMP DEFAULT NOW())",[]);}catch{} } }
module.exports=(app)=>{
  app.get("/api/chat/stream",(req,res)=>{
    const room=String(req.query.room||""); if(!room) return res.status(400).json({error:"room required"});
    res.setHeader("Content-Type","text/event-stream"); res.setHeader("Cache-Control","no-cache"); res.setHeader("Connection","keep-alive");
    res.flushHeaders&&res.flushHeaders(); res.write("retry: 2000\n\n"); setFor(room).add(res); req.on("close",()=>setFor(room).delete(res));
    res.write(`data: ${JSON.stringify({type:"hello",room})}\n\n`);
  });
  app.get("/api/chat/history",async(req,res)=>{ const room=String(req.query.room||""); if(!room) return res.json({messages:[]});
    await ensure(); try{const r=await q("SELECT id,room,user_id,author,text,created_at FROM chat_messages WHERE room=? ORDER BY id ASC LIMIT 200",[room]); res.json({messages:r.rows||r}); }catch{ res.json({messages:[]}); } });
  app.post("/api/chat/send",async(req,res)=>{ const {room,text}=req.body||{}; if(!room||!text) return res.status(400).json({error:"room and text required"});
    const user=(req.user&&(req.user.id||req.user.user_id))||req.headers["x-user-id"]||null; const author=(req.user&&(req.user.name||req.user.username))||"User";
    await ensure(); try{ await q("INSERT INTO chat_messages (room,user_id,author,text) VALUES (?,?,?,?)",[room,user,author,text]); }
    catch{ try{ await DB.query("INSERT INTO chat_messages (room,user_id,author,text) VALUES ($1,$2,$3,$4)",[room,user,author,text]); }catch(e){ return res.status(400).json({error:String(e.message||e)}); } }
    const msg={room,user_id:user,author,text,created_at:new Date().toISOString()}; broadcast(room,msg); res.json({ok:true});
  });
};