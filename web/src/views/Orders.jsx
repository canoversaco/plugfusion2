import React, { useEffect, useMemo, useState } from 'react'
import LiveTracker from '../components/LiveTracker.jsx'
import ChatWindow from '../components/ChatWindow.jsx'
import { useApi } from '../components/dataApi.js'

const euro = c => (Number(c||0)/100).toFixed(2).replace('.',',')+' €'
const isDone = s => ['completed','abgeschlossen','fertig','delivered','done','complete'].includes(String(s||'').toLowerCase())

export default function Orders(){
  const api = useApi()
  const [orders,setOrders]=useState([]); const [openChat,setOpenChat]=useState(null)

  async function load(){ setOrders(await api.myOrders()) }
  useEffect(()=>{ load() },[])

  const groups = useMemo(()=>{
    const a=[], b=[]; for(const o of orders){ (isDone(o.status)?b:a).push(o) } return { active:a, past:b }
  },[orders])

  function Stars({value,setValue,label}) {
    return (
      <div className="flex items-center gap-2">
        <div className="text-xs opacity-70 w-20">{label}</div>
        {[1,2,3,4,5].map(n=>
          <button key={n} onClick={()=>setValue(n)} className={`text-lg ${n<=value?'text-yellow-400':'text-slate-600'}`}>★</button>
        )}
      </div>
    )
  }
  async function submitRating(orderId,{quality,wait,service}){
    await api.postAny(
      [`/api/orders/${orderId}/rate`,`/api/orders/${orderId}/review`,`/api/reviews`],
      { order_id:orderId, quality, wait, service }
    )
  }

  const OrderCard = ({o})=>{
    const [q,setQ]=useState(5),[w,setW]=useState(5),[s,setS]=useState(5),[ok,setOk]=useState(false)
    const total = (o.items||[]).reduce((a,x)=>a+(Number(x.price_cents||0)*(x.qty||1)),0)
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="font-semibold">#{o.id}</div>
          {!isDone(o.status) && <LiveTracker orderId={o.id}/>}
        </div>
        <div className="text-xs opacity-70">{(o.created_at||'').replace('T',' ').slice(0,16)} • {o.status}</div>

        <div className="space-y-1 text-sm">
          {(o.items||[]).length ? o.items.map((it,idx)=>(
            <div key={idx} className="flex items-center justify-between">
              <div>{(it.qty||1)}× {it.name||it.title}</div>
              <div className="opacity-80">{euro((it.price_cents||0)*(it.qty||1))}</div>
            </div>
          )) : <div className="text-xs opacity-60">Keine Positionen vorhanden.</div>}
          <div className="pt-2 mt-1 border-t border-slate-800 flex items-center justify-between font-semibold">
            <div>Gesamt</div><div>{euro(total)}</div>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <button className="btn-ghost" onClick={()=>setOpenChat(o.id)}>Chat</button>
        </div>

        {isDone(o.status) && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-2">
            <div className="text-xs opacity-80 mb-1">Bestellung bewerten</div>
            <Stars value={q} setValue={setQ} label="Qualität" />
            <Stars value={w} setValue={setW} label="Wartezeit" />
            <Stars value={s} setValue={setS} label="Service" />
            <button className="btn mt-1" onClick={async()=>{ await submitRating(o.id,{quality:q,wait:w,service:s}); setOk(true) }}>
              Bewertung absenden
            </button>
            {ok && <div className="text-xs text-emerald-400">Danke für die Bewertung!</div>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="pf-pt-safe pf-pb-safe p-3 space-y-4">
      <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-emerald-600/10 via-cyan-600/10 to-fuchsia-600/10">
        <div className="text-xl font-extrabold">Meine Bestellungen</div>
        <div className="text-xs opacity-70 mt-1">Live verfolgen, chatten & bewerten</div>
      </div>

      <section className="space-y-2">
        <div className="text-sm opacity-80">Aktiv</div>
        {groups.active.length===0 ? <div className="text-xs opacity-60">Keine aktiven Bestellungen.</div> : groups.active.map(o=><OrderCard key={o.id} o={o}/>)}
      </section>

      <section className="space-y-2">
        <div className="text-sm opacity-80">Vergangen</div>
        {groups.past.length===0 ? <div className="text-xs opacity-60">Noch keine abgeschlossenen Bestellungen.</div> : groups.past.map(o=><OrderCard key={o.id} o={o}/>)}
      </section>

      {openChat && <ChatWindow orderId={openChat} onClose={()=>setOpenChat(null)}/>}
    </div>
  )
}
