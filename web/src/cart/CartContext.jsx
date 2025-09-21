import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

const Ctx = createContext(null)

const norm = (x={})=>{
  const id = x.id ?? x.product_id
  return {
    id,
    name: x.name ?? x.title ?? ('#'+id),
    price_cents: Number(x.price_cents ?? Math.round((x.price ?? x.unit_price ?? 0)*100)) || 0,
    image_url: x.image_url ?? x.image ?? '',
    qty: Number(x.qty ?? x.quantity ?? 1) || 1,
  }
}

export function CartProvider({ children }){
  const { fetchWithAuth } = useAuth()
  const [items, setItems] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('plug.cart.v1')||'[]').map(norm) } catch { return [] }
  })

  // Persist local
  useEffect(()=>{ try{ localStorage.setItem('plug.cart.v1', JSON.stringify(items)) }catch{} }, [items])

  // Initial server sync (falls API existiert)
  useEffect(()=>{ (async()=>{
    try{
      const r = await fetchWithAuth('/api/cart', { headers:{'accept':'application/json'} })
      if (!r.ok) return
      const d = await r.json().catch(()=>({}))
      const arr = d.items || d.cart?.items || d.rows || []
      if (Array.isArray(arr) && arr.length) setItems(arr.map(norm))
    }catch{}
  })() }, [fetchWithAuth])

  const count = useMemo(()=> items.reduce((a,b)=> a + (b.qty||1), 0), [items])
  const totalCents = useMemo(()=> items.reduce((a,b)=> a + (b.price_cents||0)*(b.qty||1), 0), [items])

  const addItem = (raw, qty=1)=>{
    const it = norm({ ...raw, qty })
    setItems(prev=>{
      const i = prev.findIndex(p=> String(p.id)===String(it.id))
      if (i>=0){ const c=[...prev]; c[i] = { ...c[i], qty:(c[i].qty||1)+(it.qty||1) }; return c }
      return [...prev, it]
    })
    // best-effort Server-Sync
    try{ fetchWithAuth('/api/cart/add', { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify({ product_id: it.id, qty: it.qty }) }) }catch{}
    // Signal für UI-Effekte
    try{ window.dispatchEvent(new Event('pf:addToCart')) }catch{}
  }

  const removeItem = (id)=> setItems(prev=> prev.filter(p=> String(p.id)!==String(id)))
  const clear = ()=> { setItems([]); try{ fetchWithAuth('/api/cart/clear', { method:'POST' }) }catch{} }

  const value = { items, addItem, removeItem, clear, count, totalCents }

  // Globale Fallback-API (für alte Buttons)
  useEffect(()=>{
    window.__cartApi = value
    return ()=>{ if(window.__cartApi===value) delete window.__cartApi }
  }, [value])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useCart = ()=> useContext(Ctx)
