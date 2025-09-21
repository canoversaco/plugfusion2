import React, { useEffect, useState } from 'react'
import { useCart } from '../cart/CartContext.jsx'

export default function MenuView(){
  const { addItem } = useCart()
  const [products,setProducts]=useState([])

  useEffect(()=>{ (async()=>{
    try{
      const r=await fetch('/api/products',{headers:{'accept':'application/json'}})
      const d=await r.json().catch(()=>({}))
      const list = d.products || d || []
      setProducts(Array.isArray(list)?list:[])
    }catch{}
  })() },[])

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3">
      {products.map(raw=>{
        const p = {
          id: raw?.id ?? raw?.product_id,
          name: raw?.name ?? raw?.title ?? 'Produkt',
          price_cents: Number(raw?.price_cents ?? Math.round((raw?.price ?? raw?.unit_price ?? 0)*100)) || 0,
          image_url: raw?.image_url ?? raw?.image ?? ''
        }
        return (
          <div key={p.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="aspect-[4/3] bg-slate-800/40" style={p.image_url?{backgroundImage:`url(${p.image_url})`,backgroundSize:'cover',backgroundPosition:'center'}:{}}/>
            <div className="p-2">
              <div className="text-sm font-semibold line-clamp-2">{p.name}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-sm font-bold text-emerald-400">{(p.price_cents/100).toFixed(2).replace('.',',')} €</div>
                <button className="btn" onClick={()=>addItem(p,1)}>In den Warenkorb</button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
