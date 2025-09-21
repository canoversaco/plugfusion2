const fs=require("fs");const path=require("path");
const DATA=path.join(__dirname,"..","..","data","ui.json");
function readUI(){ try{ return JSON.parse(fs.readFileSync(DATA,"utf8")); }catch{ return {highlights:[],categoryFeatured:{}}; } }
function writeUI(obj){ fs.mkdirSync(path.dirname(DATA),{recursive:true}); fs.writeFileSync(DATA, JSON.stringify(obj,null,2)); }
module.exports=(app)=>{ app.get("/api/ui",(req,res)=>res.json(readUI()));
  app.post("/api/admin/ui",(req,res)=>{ const b=req.body||{}; const ui={highlights:b.highlights||[],categoryFeatured:b.categoryFeatured||{}}; writeUI(ui); res.json(ui); });
  app.post("/api/admin/categories/:id/feature",(req,res)=>{ const id=req.params.id; const {featured}=req.body||{}; const ui=readUI(); ui.categoryFeatured=ui.categoryFeatured||{}; ui.categoryFeatured[id]=!!featured; writeUI(ui); res.json({ok:true,categoryFeatured:ui.categoryFeatured}); });
};