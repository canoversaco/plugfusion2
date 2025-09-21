import React from 'react'
import { useCart } from '../cart/CartContext.jsx'

export default function ProductCard({ product }){
  const { addItem } = useCart()
  const p = {
    id: product?.id ?? product?.product_id,
    name: product?.name ?? product?.title ?? 'Produkt',
    price_cents: Number(product?.price_cents ?? Math.round((product?.price ?? product?.unit_price ?? 0)*100)) || 0,
    image_url: product?.image_url ?? product?.image ?? ''
  }
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
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
}
