import React, { useEffect, useState } from "react";
async function j(u){ const r=await fetch(u); if(!r.ok) throw new Error(await r.text().catch(()=>r.statusText)); return r.json(); }

export default function HighlightsGrid(){
  const [ui,setUi]=useState({highlights:[]});
  useEffect(()=>{ (async()=>{ try{ setUi(await j("/api/ui")); }catch{} })(); },[]);
  if (!(ui.highlights||[]).length) return null;
  return (
    <div className="mb-4">
      <h2 className="text-lg font-semibold mb-2">Highlights & Aktionen</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {ui.highlights.map((h,i)=>(
          <a key={i} href={h.href || "#"} className="group rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-900/60 hover:border-violet-500 transition">
            {h.image && <img src={h.image} className="w-full h-36 object-cover group-hover:opacity-95" />}
            <div className="p-3">
              <div className="font-medium">{h.title}</div>
              {h.subtitle && <div className="text-sm text-zinc-400">{h.subtitle}</div>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
