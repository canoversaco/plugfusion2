import React, { useEffect, useMemo, useRef, useState } from "react";

const euro = (c) => ((Number(c||0))/100).toFixed(2) + " €";
const authHeaders = () => {
  const t = (typeof localStorage!=="undefined" && (localStorage.getItem("token")||localStorage.getItem("jwt")||localStorage.getItem("authToken"))) || "";
  const h = { "content-type":"application/json" };
  if (t) h.authorization = /^Bearer\s+/i.test(t) ? t : ("Bearer "+t);
  return h;
};

async function listOrders({page=1, limit=50, q="", status="all"}){
  const u = `/api/courier/panel/orders?page=${page}&limit=${limit}&status=${encodeURIComponent(status)}&q=${encodeURIComponent(q)}`;
  const res = await fetch(u, { headers: { "cache-control":"no-cache" }});
  if (!res.ok) throw new Error("http_"+res.status);
  return res.json();
}
async function acceptOrder(id){
  const res = await fetch(`/api/courier/panel/orders/${id}/accept`, { method:"POST", headers: authHeaders(), body:"{}" });
  if (!res.ok) throw new Error("accept_"+res.status);
  return res.json();
}
async function declineOrder(id){
  const res = await fetch(`/api/courier/panel/orders/${id}/decline`, { method:"POST", headers: authHeaders(), body:"{}" });
  if (!res.ok) throw new Error("decline_"+res.status);
  return res.json();
}

function OrderCard({o, highlight, busy, onAccept, onDecline}){
  const created = (o.created_at||"").toString().replace("T"," ").replace("Z","");
  const cls = "rounded-xl border p-3 " + (highlight ? "card-open bg-zinc-900/70 border-emerald-400/40" : "bg-zinc-900/60 border-zinc-800");
  return (
    <div className={cls}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">Order #{o.id}</div>
        <div className="text-sm text-zinc-400">{created}</div>
      </div>
      <div className="text-sm text-zinc-300 mt-1">
        Status: <span className="font-medium">{o.status||"?"}</span> ·
        Summe: <span className="font-medium">{euro(o.total_cents||0)}</span> ·
        Zahlung: <span className="font-medium">{o.payment_method||"-"}</span>
      </div>
      {o.meeting_status ? (
        <div className="text-sm text-zinc-300 mt-1">
          Treffpunkt: {o.meeting_lat?.toFixed?.(5)}, {o.meeting_lng?.toFixed?.(5)}
          {o.meeting_desc ? (" - " + o.meeting_desc) : ""} ·
          Status: <span className="font-medium">{o.meeting_status}</span>
        </div>
      ) : null}
      {Array.isArray(o.items) && o.items.length ? (
        <div className="mt-2 text-sm text-zinc-400">
          {o.items.slice(0,6).map((it,i)=>(
            <span key={i} className="inline-block mr-2">#{it.product_id} × {it.qty}</span>
          ))}
          {o.items.length>6 ? <span>…</span> : null}
        </div>
      ) : null}

      {highlight ? (
        <div className="mt-3 flex gap-2">
          <button onClick={()=>onAccept(o.id)} disabled={busy===o.id}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 font-semibold disabled:opacity-60">
            {busy===o.id ? "Annehmen…" : "Annehmen"}
          </button>
          <button onClick={()=>onDecline(o.id)} disabled={busy===o.id}
                  className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-400 font-semibold disabled:opacity-60">
            {busy===o.id ? "Storniert…" : "Ablehnen/Stornieren"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Section({title, empty, children}){
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {React.Children.count(children) ? <div className="grid gap-3">{children}</div> : <div className="text-zinc-400">{empty||"Nichts vorhanden."}</div>}
    </div>
  );
}

export default function CourierPanel(){
  const [orders, setOrders]   = useState([]);
  const [total, setTotal]     = useState(0);
  const [page, setPage]       = useState(1);
  const [limit]               = useState(50);
  const [q, setQ]             = useState("");
  const [status, setStatus]   = useState("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId]   = useState(null);
  const pollRef = useRef(null);

  async function loadFirst(){
    setLoading(true);
    try{
      const j = await listOrders({page:1, limit, q, status});
      setOrders(Array.isArray(j.orders)? j.orders : []);
      setTotal(Number(j.total||0));
      setPage(1);
    } finally { setLoading(false); }
  }
  async function loadMore(){
    if (orders.length>=total) return;
    setLoadingMore(true);
    try{
      const j = await listOrders({page:page+1, limit, q, status});
      setOrders(prev => [...prev, ...(Array.isArray(j.orders)? j.orders : [])]);
      setTotal(Number(j.total||0));
      setPage(p=>p+1);
    } finally { setLoadingMore(false); }
  }

  useEffect(()=>{
    loadFirst();
    // Poll alle 5s
    pollRef.current = setInterval(()=>{ listOrders({page:1, limit, q, status}).then(j=>{
      setOrders(Array.isArray(j.orders)? j.orders : []);
      setTotal(Number(j.total||0));
      setPage(1);
    }).catch(()=>{}); }, 5000);
    return ()=> { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, q]);

  const groups = useMemo(()=>{
    const ing=[], aktiv=[], done=[];
    for (const o of orders){
      const s = String(o.status||"").toLowerCase();
      if (s==="wartet_bestätigung"||s==="wartet_bestaetigung") ing.push(o);
      else if (s==="akzeptiert"||s==="in arbeit"||s==="in_arbeit") aktiv.push(o);
      else if (s==="abgeschlossen"||s==="storniert") done.push(o);
      else aktiv.push(o);
    }
    return { ing, aktiv, done };
  }, [orders]);

  async function onAccept(id){
    try { setBusyId(id); await acceptOrder(id); await loadFirst(); }
    catch(e){ console.error(e); alert("Annehmen fehlgeschlagen"); }
    finally { setBusyId(null); }
  }
  async function onDecline(id){
    if (!confirm("Bestellung sofort stornieren?")) return;
    try { setBusyId(id); await declineOrder(id); await loadFirst(); }
    catch(e){ console.error(e); alert("Ablehnen/Stornieren fehlgeschlagen"); }
    finally { setBusyId(null); }
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3">Kurier</h1>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          onKeyDown={(e)=>{ if (e.key==='Enter') loadFirst(); }}
          placeholder="Suche (ID/Treffpunkt)…"
          className="flex-1 min-w-[240px] px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200"
        />
        <select value={status} onChange={(e)=>setStatus(e.target.value)}
                className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800">
          <option value="all">Alle</option>
          <option value="open">Eingehend</option>
          <option value="akzeptiert">Akzeptiert</option>
          <option value="in arbeit">In Arbeit</option>
          <option value="abgeschlossen">Abgeschlossen</option>
          <option value="storniert">Storniert</option>
        </select>
        <button onClick={loadFirst} className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700">Aktualisieren</button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Lade Bestellungen…</div>
      ) : (
        <>
          <Section title="Eingehend" empty="Keine offenen Bestellungen.">
            {groups.ing.map(o=>(
              <OrderCard key={o.id} o={o} highlight busy={busyId} onAccept={onAccept} onDecline={onDecline} />
            ))}
          </Section>

          <Section title="Aktiv" empty="Nichts aktiv.">
            {groups.aktiv.map(o=>(
              <OrderCard key={o.id} o={o} busy={busyId} onAccept={onAccept} onDecline={onDecline} />
            ))}
          </Section>

          <Section title="Abgeschlossen" empty="Noch keine erledigt.">
            {groups.done.map(o=>(
              <OrderCard key={o.id} o={o} busy={busyId} onAccept={onAccept} onDecline={onDecline} />
            ))}
          </Section>

          <div className="flex justify-center mt-4">
            {orders.length < total ? (
              <button onClick={loadMore} disabled={loadingMore}
                      className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600">
                {loadingMore ? "Lade…" : "Mehr laden"}
              </button>
            ) : (
              <div className="text-zinc-500 text-sm">Alle {total} Bestellungen geladen.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
