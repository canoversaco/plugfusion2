import React, { useEffect, useMemo, useState } from "react";

function euro(cents){ return ((Number(cents||0))/100).toFixed(2) + " €"; }

async function fetchAll(page=1, limit=50){
  const res = await fetch(`/api/courier/all-orders?page=${page}&limit=${limit}`, { headers:{ "cache-control":"no-cache" }});
  if (!res.ok) throw new Error("http_"+res.status);
  return res.json();
}

function OrderCard({o}) {
  const created = (o.created_at||"").toString().replace("T"," ").replace("Z","");
  const status = String(o.status||"?");
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">Order #{o.id}</div>
        <div className="text-sm text-zinc-400">{created}</div>
      </div>
      <div className="text-sm text-zinc-300 mt-1">
        Status: <span className="font-medium">{status}</span> ·
        Summe: <span className="font-medium">{euro(o.total_cents||0)}</span> ·
        Zahlung: <span className="font-medium">{o.payment_method || "-"}</span>
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
          {o.items.slice(0,6).map((it, idx)=>(
            <span key={idx} className="inline-block mr-2">#{it.product_id} × {it.qty}</span>
          ))}
          {o.items.length>6 ? <span>…</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function CourierPanel(){
  const [orders, setOrders] = useState([]);
  const [total, setTotal]   = useState(0);
  const [page, setPage]     = useState(1);
  const [limit]             = useState(50);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadFirst(){
    setLoading(true);
    try{
      const j = await fetchAll(1, limit);
      setOrders(Array.isArray(j.orders)? j.orders : []);
      setTotal(Number(j.total||0)); setPage(1);
    } finally { setLoading(false); }
  }
  async function loadMore(){
    if (orders.length >= total) return;
    setLoadingMore(true);
    try{
      const j = await fetchAll(page+1, limit);
      setOrders(prev => [...prev, ...(Array.isArray(j.orders)? j.orders : [])]);
      setTotal(Number(j.total||0)); setPage(p=>p+1);
    } finally { setLoadingMore(false); }
  }

  useEffect(()=>{ loadFirst(); }, []);

  // gleiche Gruppierung wie Admin-UX
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

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3">Kurier</h1>

      {loading ? (
        <div className="text-zinc-400">Lade Bestellungen…</div>
      ) : (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Eingehend</h2>
            {groups.ing.length===0
              ? <div className="text-zinc-400">Keine offenen Bestellungen.</div>
              : <div className="grid gap-3">{groups.ing.map(o=> <OrderCard key={o.id} o={o} />)}</div>}
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Aktiv</h2>
            {groups.aktiv.length===0
              ? <div className="text-zinc-400">Nichts aktiv.</div>
              : <div className="grid gap-3">{groups.aktiv.map(o=> <OrderCard key={o.id} o={o} />)}</div>}
          </div>

          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">Abgeschlossen</h2>
            {groups.done.length===0
              ? <div className="text-zinc-400">Noch keine erledigt.</div>
              : <div className="grid gap-3">{groups.done.map(o=> <OrderCard key={o.id} o={o} />)}</div>}
          </div>

          <div className="flex justify-center">
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
