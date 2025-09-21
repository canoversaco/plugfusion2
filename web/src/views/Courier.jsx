import React, { useEffect, useRef, useState } from "react";
const euro = (c) => ((Number(c || 0)) / 100).toFixed(2) + " €";

export default function Courier() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const didLoad = useRef(false);

  async function loadOnce() {
    if (didLoad.current) return;
    didLoad.current = true;
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/orders?ts=" + Date.now(), {
        headers: { accept: "application/json", "cache-control":"no-cache" }
      });
      if (!r.ok) throw new Error("HTTP_" + r.status);
      const j = await r.json();
      setOrders(Array.isArray(j.orders) ? j.orders : []);
    } catch (e) {
      setErr(String(e.message || e));
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadOnce(); }, []);

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">Kurier</h1>
      {err && <div className="mb-3 text-sm text-rose-400">Fehler: {err}</div>}
      {loading ? (
        <div className="text-zinc-400">Lade Bestellungen…</div>
      ) : orders.length === 0 ? (
        <div className="text-zinc-400">Keine Bestellungen vorhanden.</div>
      ) : (
        <div className="grid gap-3">
          {orders.map((o) => (
            <div key={o.id}
              className={`rounded-xl border p-3 ${String(o.status||"").toLowerCase().includes("wartet")
                ? "card-open bg-zinc-900/70 border-emerald-400/40"
                : "bg-zinc-900/60 border-zinc-800"}`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold">Order #{o.id}</div>
                <div className="text-sm text-zinc-400">
                  {(o.created_at||"").toString().replace("T"," ").replace("Z","")}
                </div>
              </div>
              <div className="text-sm text-zinc-300 mt-1">
                Status: <span className="font-medium">{o.status||"?"}</span> ·
                Summe: <span className="font-medium">{euro(o.total_cents||0)}</span> ·
                Zahlung: <span className="font-medium">{o.payment_method||"-"}</span>
              </div>
              {Array.isArray(o.items)&&o.items.length ? (
                <div className="mt-2 text-sm text-zinc-400">
                  {o.items.slice(0,8).map((it,i)=>(
                    <span key={i} className="inline-block mr-2">#{it.product_id} × {it.qty}</span>
                  ))}
                  {o.items.length>8 ? <span>…</span> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
