import React, { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function LiveTracker({ orderId }){
  const { fetchWithAuth, token } = useAuth()
  const [eta,setEta]=useState(null), [status,setStatus]=useState(null), [lastFix,setLastFix]=useState(null)
  const esRef = useRef(null)
  async function j(u){ try{ const r=await fetchWithAuth(u,{headers:{'accept':'application/json'}}); if(!r.ok) return null; return await r.json() }catch{ return null } }

  useEffect(()=>{ let opened=false;
    (async()=>{
      const candidates = [
        `/api/orders/${orderId}/stream${token?`?t=${encodeURIComponent(token)}`:''}`,
        `/api/orders-live/${orderId}/sse`,
        `/api/orders/${orderId}/sse`
      ]
      for (const u of candidates){
        try{
          const es = new EventSource(u); esRef.current=es; opened=true;
          es.onmessage = (ev)=>{ try{
            const d=JSON.parse(ev.data||'{}')
            if (d.type==='eta'||d.eta_minutes!=null) setEta(d.eta_minutes ?? d.eta ?? eta)
            if (d.type==='status'||d.status) setStatus(d.status||status)
            if (d.type==='location'||d.coords||d.lat) setLastFix(Date.now())
          }catch{} }
          break
        }catch{}
      }
    })()
    const poll=setInterval(async()=>{
      const x=await j(`/api/chat/order/${orderId}`)
      if(x?.order){ setEta(x.order.eta_minutes??eta); setStatus(x.order.status??status); }
    },20000)
    return ()=>{ clearInterval(poll); try{ esRef.current?.close() }catch{} }
  },[orderId, token])

  return (
    <div className="text-xs flex items-center gap-2">
      <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">{status||'-'}</span>
      <span className="opacity-70">ETA:</span> {eta!=null?`${eta} Min`:'-'}
      {lastFix && <span className="opacity-60">· {new Date(lastFix).toLocaleTimeString()}</span>}
    </div>
  )
}
