import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useCart } from '../cart/CartContext.jsx'

function calcFromLocal(){
  try{
    const arr = JSON.parse(localStorage.getItem('plug.cart.v1')||'[]')
    const count = arr.reduce((a,b)=>a+(b.qty||1),0)
    const total = arr.reduce((a,b)=>a+(Number(b.price||0)*(b.qty||1)),0)
    return { count, totalCents: Math.round(total*100) }
  }catch{ return {count:0,totalCents:0} }
}
function detectBottomNavHeight(){
  const sels = [
    '[data-bottom-nav]', '.bottom-nav', 'nav[aria-label="bottom"]',
    '.MobileNav', '.mobile-nav', '#bottom-nav', '.app-bottom-nav'
  ]
  for (const s of sels){
    const el = document.querySelector(s)
    if (el) return Math.ceil(el.getBoundingClientRect().height||0)
  }
  return 0
}

export default function StickyCheckoutBar({ spacer=true }){
  const cart = (()=>{ try{ return useCart() }catch{ return null } })()
  const meta = useMemo(()=>{
    if (cart && ('count' in cart)) {
      const cents = 'totalCents' in cart ? cart.totalCents : Math.round((cart.total||0)*100)
      return { count: cart.count||0, totalCents: cents }
    }
    return calcFromLocal()
  }, [cart?.count, cart?.total, cart?.totalCents])
  const euro = (c)=>(Number(c||0)/100).toFixed(2).replace('.',',')+' €'

  const [navH,setNavH]=useState(0)
  const [barH,setBarH]=useState(0)
  const barRef = useRef(null)

  useEffect(()=>{
    function measure(){
      setNavH(detectBottomNavHeight())
      try{ setBarH(Math.ceil(barRef.current?.getBoundingClientRect?.().height||64)) }catch{}
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(document.documentElement); window.addEventListener('resize',measure); window.addEventListener('orientationchange',measure)
    const t=setInterval(measure,800)
    return ()=>{ try{ro.disconnect()}catch{}; window.removeEventListener('resize',measure); window.removeEventListener('orientationchange',measure); clearInterval(t) }
  },[])

  const bottomOffset = `calc(${navH}px + env(safe-area-inset-bottom) + 8px)`
  const spacerH = spacer ? (navH + barH + 14) : 0

  return (
    <>
      <div className="fixed left-0 right-0 z-50 pointer-events-none" style={{ bottom: bottomOffset }}>
        <div className="px-3 pointer-events-none">
          <div className="max-w-screen-md mx-auto pointer-events-auto" ref={barRef}>
            <button
              onClick={()=>{ window.location.hash='#/checkout' }}
              className="w-full rounded-2xl border border-emerald-500 bg-emerald-500/20 text-emerald-100 font-bold px-4 py-3 shadow-lg flex items-center justify-center gap-2"
              style={{backdropFilter:'saturate(140%) blur(6px)'}}
            >
              <ShoppingCart size={18}/> Zur Kasse ({meta.count}) · {euro(meta.totalCents)}
            </button>
          </div>
        </div>
      </div>
      {spacer && <div style={{height: spacerH}} aria-hidden="true" />}
    </>
  )
}
