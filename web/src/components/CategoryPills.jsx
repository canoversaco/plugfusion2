import React, { useEffect, useState } from "react";

async function j(u){ const r=await fetch(u); if(!r.ok) throw new Error(await r.text().catch(()=>r.statusText)); return r.json(); }

export default function CategoryPills({ onSelect }) {
  const [cats,setCats]=useState([]), [ui,setUi]=useState({categoryFeatured:{}});
  useEffect(()=>{ (async()=>{
    const cands=["/api/categories","/api/menu/categories","/api/catalog/categories","/api/admin/categories"];
    let C=[]; for(const u of cands){ try{ const d=await j(u); C=d.categories||d; break;}catch{} }
    try{ const U=await j("/api/ui"); setUi(U); }catch{}
    const norm=(C||[]).map(c=>({ id:c.id||c.category_id||c.slug||c.name, name:c.name||c.title||c.slug }));
    norm.sort((a,b)=>{
      const fa=ui.categoryFeatured?.[a.id]?1:0, fb=ui.categoryFeatured?.[b.id]?1:0;
      return (fb-fa)||String(a.name).localeCompare(String(b.name));
    });
    setCats(norm);
  })(); },[]);
  function choose(id){
    onSelect && onSelect(id);
    // URL Param fallback (wenn View keinen onSelect hat)
    const url = new URL(window.location.href);
    url.hash = "#/menu";
    url.searchParams.set("category", id);
    window.history.pushState({}, "", url.toString());
    window.dispatchEvent(new CustomEvent("plug:categorySelected", { detail:{ id } }));
  }
  return (
    <div className="sticky top-0 z-20 bg-zinc-950/70 backdrop-blur border-b border-zinc-800/60 -mx-3 px-3 py-2">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {cats.map(c=>{
          const featured = !!(ui.categoryFeatured||{})[c.id];
          return (
            <button key={c.id} onClick={()=>choose(c.id)}
              className={"px-3 py-1.5 rounded-full border text-sm " + (featured ? "bg-amber-700/30 border-amber-600/40 text-amber-200" : "bg-zinc-900 border-zinc-700 text-zinc-200")}
              title={featured ? "Vom Admin hervorgehoben" : ""}>
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
