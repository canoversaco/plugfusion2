import React, { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { useAuth } from '../auth/AuthContext.jsx'

export default function ChatWindow({ orderId, onClose }){
  const { fetchWithAuth, token, user } = useAuth()
  const [msgs,setMsgs]=useState([]); const [text,setText]=useState(''); const sc=useRef(null)
  const room=`order-${orderId}`

  const scroll=()=> setTimeout(()=>{ try{ sc.current.scrollTop=sc.current.scrollHeight }catch{} },10)
  const j = async (u,init)=>{ try{ const r=await fetchWithAuth(u,{headers:{'accept':'application/json'}, ...(init||{})}); if(!r.ok) return null; return await r.json() }catch{ return null } }

  async function load(){
    const d = await j(`/api/orders/${orderId}/messages`) || await j(`/api/chat/history?room=${encodeURIComponent(room)}`)
    const arr = d?.messages || d?.rows || d?.items || []
    setMsgs(arr); scroll()
  }
  async function send(){
    const body={ text, room }
    const ok = (await fetchWithAuth(`/api/orders/${orderId}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).ok
          || (await fetchWithAuth(`/api/chat/send`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).ok
    if(ok){ setText(''); load() }
  }

  useEffect(()=>{ load() },[orderId])
  useEffect(()=>{ const sses=[ `/api/orders/${orderId}/stream${token?`?t=${encodeURIComponent(token)}`:''}`, `/api/chat/stream?room=${encodeURIComponent(room)}${token?`&t=${encodeURIComponent(token)}`:''}` ]; let es;
    for (const u of sses){ try{ es=new EventSource(u); break }catch{} }
    if(!es) return; es.onmessage=(ev)=>{ try{ const j=JSON.parse(ev.data||'{}'); if(j.kind==='message'||j.type==='chat'||j.text) load() }catch{} }; return ()=> es.close()
  },[orderId, token])

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-2 z-50" onClick={onClose}>
      <div className="w-full md:w-[640px] h-[70vh] bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden" onClick={e=>e.stopPropagation()}>
        <div className="p-2 border-b border-slate-800 flex items-center">
          <div className="font-semibold">Chat - Bestellung #{orderId}</div>
          <div className="ml-auto text-xs opacity-70">{user?.username||''}</div>
          <button onClick={onClose} className="ml-2 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700">Schließen</button>
        </div>
        <div ref={sc} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
          {msgs.map((m,i)=>(
            <div key={m.id||i} className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${m.mine?'ml-auto bg-violet-600 text-white':'bg-slate-800 text-slate-100'}`}>
              <div className="text-[11px] opacity-70">{m.sender_username||m.author||'User'}</div>
              <div>{m.text||m.message}</div>
              <div className="text-[10px] opacity-50 mt-1">{(m.created_at||'').replace('T',' ').slice(0,16)}</div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-slate-800 flex gap-2">
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==='Enter') send() }}
                 className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="Nachricht…"/>
          <button onClick={send} className="btn inline-flex items-center gap-2"><Send size={16}/> Senden</button>
        </div>
      </div>
    </div>
  )
}
