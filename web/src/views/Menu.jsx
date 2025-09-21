import React, { useEffect, useMemo, useState } from 'react'
import { useCart } from '../cart/CartContext.jsx'
import { ShoppingCart, Tag } from 'lucide-react'

const euro = c => (Number(c||0)/100).toFixed(2).replace('.',',')+' €'

export default function Menu(){
  const { addItem, totalCents, count } = useCart()
  const [cats,setCats]=useState([]); const [active,setActive]=useState('all')
  const [prods,setProds]=useState([]); const [q,setQ]=useState('')

  useEffect(()=>{ (async()=>{
    try{ const r=await fetch('/api/categories'); const d=await r.json(); const a=d.categories||d||[]; setCats(a.map(c=>({id:c.id??c.slug??c.name,name:c.name||c.title||c.slug}))) }catch{}
    try{
      const r=await fetch('/api/products'); const d=await r.json();
      const list=(d.products||d||[]).map(p=>({id:p.id||p.product_id, title:p.name||p.title, price_cents:p.price_cents??Math.round((p.price||0)*100), image:p.image_url||p.image||'' , category_id:p.category_id??p.category, badge:p.badge_text||null }))
      setProds(list)
    }catch{}
  })() },[])

  const filtered = useMemo(()=>{
    const t=q.trim().toLowerCase()
    const byBadge=(a,b)=>((b.badge?1:0)-(a.badge?1:0))||String(a.title).localeCompare(b.title)
    return prods.filter(p=>{
      const catOK = active==='all' || String(p.category_id)===String(active)
      const txtOK = !t || (p.title||'').toLowerCase().includes(t)
      return catOK && txtOK
    }).sort(byBadge)
  },[prods,active,q])

  function onAdd(p){
    const payload = { id:p.id, name:p.title, price_cents:p.price_cents, image_url:p.image }
    if (addItem) addItem(payload, 1)
    else if (window.addToCart) window.addToCart(payload, 1)
    // kleiner Pulse auf der Topbar
    try{
      const el = document.getElementById('pf-top-cart')
      if (el){ el.classList.add('ring-2','ring-emerald-400'); setTimeout(()=>el.classList.remove('ring-2','ring-emerald-400'), 450) }
    }catch{}
  }

  return (
    <div className="pf-pt-safe pf-pb-safe p-3 space-y-4">
      {/* Kopf */}
      <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-violet-600/10 via-fuchsia-600/10 to-rose-600/10">
        <div className="text-xl font-extrabold">Menü</div>
        <div className="text-xs opacity-70 mt-1">Mobilfreundlich - Warenkorb als Topbar, untere Navbar bleibt frei.</div>
      </div>

      {/* Sticky TOP Checkout */}
      <div className="sticky top-[calc(env(safe-area-inset-top)+6px)] z-30" id="pf-top-cart">
        <div className="rounded-2xl border border-emerald-600/50 bg-emerald-500/15 px-3 py-2 flex items-center gap-2 shadow-sm backdrop-blur">
          <ShoppingCart size={16} className="opacity-80"/>
          <div className="text-sm font-semibold">Warenkorb: {count} Artikel</div>
          <div className="text-sm ml-auto font-bold">{euro(totalCents)}</div>
          <button onClick={()=>{ window.location.hash='#/checkout' }} className="btn ml-2">Zur Kasse</button>
        </div>
      </div>

      {/* Kategorien + Suche */}
      <div className="flex items-center gap-2 overflow-x-auto py-2">
        <button onClick={()=>setActive('all')}
                className={`px-3 py-2 text-sm rounded-xl border ${active==='all'?'border-emerald-500 bg-emerald-500/15':'border-slate-800 bg-slate-900/60'}`}>Alle</button>
        {cats.map(c=>(
          <button key={c.id} onClick={()=>setActive(String(c.id))}
                  className={`px-3 py-2 text-sm rounded-xl border whitespace-nowrap ${String(active)===String(c.id)?'border-emerald-500 bg-emerald-500/15':'border-slate-800 bg-slate-900/60'}`}>
            {c.name}
          </button>
        ))}
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Suche…"
               className="px-3 py-2 text-sm rounded-xl border border-slate-800 bg-slate-900/60 ml-auto"/>
      </div>

      {/* Grid */}
      {filtered.length===0
        ? <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center text-sm opacity-80">Keine Produkte gefunden.</div>
        : <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map(p=>(
              <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden group">
                <div className="aspect-[4/3] bg-slate-800/40"
                     style={p.image?{backgroundImage:`url(${p.image})`,backgroundSize:'cover',backgroundPosition:'center'}:{}}/>
                <div className="p-2 space-y-1">
                  <div className="text-sm font-semibold line-clamp-2">{p.title}</div>
                  {p.badge && (
                    <div className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800/60">
                      <Tag size={12}/><span>{p.badge}</span>
                    </div>
                  )}
                  <div className="pt-1 flex items-center justify-between">
                    <div className="text-sm font-bold text-emerald-400">{euro(p.price_cents)}</div>
                    <button className="btn" onClick={()=>onAdd(p)}>In den Warenkorb</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  )
}
