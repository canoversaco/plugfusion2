import React from "react"

export default function CategoryBar({ categories=[], active, onChange }){
  const cats = [...categories]
    .sort((a,b)=>((b.featured?1:0)-(a.featured?1:0)) || String(a.name||"").localeCompare(String(b.name||"")))
  const Btn = ({ id, name, featured=false }) => {
    const is = String(active)===String(id)
    return (
      <button
        onClick={()=>onChange?.(id)}
        className={[
          "shrink-0 px-4 py-2 rounded-full border text-sm transition-all",
          is
            ? "bg-violet-600 border-violet-500 text-white shadow"
            : (featured
                ? "bg-amber-700/20 border-amber-500/50 text-amber-200 hover:bg-amber-700/30"
                : "bg-zinc-900 border-zinc-700 text-zinc-200 hover:bg-zinc-800")
        ].join(" ")}
        style={{minHeight: 38}}
        title={featured ? "Hervorgehoben" : ""}
      >
        {featured ? "⭐ " : ""}{name}
      </button>
    )
  }
  return (
    <div className="-mx-1 px-1 py-2 sticky top-0 z-20 bg-zinc-950/75 backdrop-blur border-b border-zinc-800/60">
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <Btn id="all" name="Alle" featured={false} />
        {cats.map(c=><Btn key={c.id} id={c.id} name={c.name} featured={!!c.featured} />)}
      </div>
    </div>
  )
}
