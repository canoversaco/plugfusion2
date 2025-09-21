import React, { useEffect, useMemo, useState } from "react";

function useCourierOrders() {
  const [orders, setOrders] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [status, setStatus] = useState("all"); // all | open | akzeptiert | storniert | ...

  async function fetchPage(p=1, s=status) {
    const res = await fetch(`/api/courier/orders?page=${p}&limit=${limit}&status=${encodeURIComponent(s)}`, { headers: { "cache-control":"no-cache" }});
    if (!res.ok) throw new Error("http_"+res.status);
    const j = await res.json();
    setTotal(Number(j.total||0));
    if (p===1) setOrders(Array.isArray(j.orders)? j.orders : []);
    else setOrders(prev => [...prev, ...(Array.isArray(j.orders)? j.orders : [])]);
    setPage(p);
  }

  useEffect(() => {
    (async () => {
      try { setLoading(true); await fetchPage(1, status); }
      catch(e){ console.error(e); }
      finally { setLoading(false); }
    })();
  }, [status]);

  async function loadMore(){
    if (orders.length >= total) return;
    try { setLoadingMore(true); await fetchPage(page+1, status); }
    catch(e){ console.error(e); }
    finally { setLoadingMore(false); }
  }

  return { orders, total, page, status, setStatus, loading, loadingMore, loadMore, reload: ()=>fetchPage(1, status) };
}

function Section({ title, empty, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      {empty ? <div className="text-zinc-400">{empty}</div> : <div className="grid gap-3">{children}</div>}
    </div>
  );
}

function OrderCard({o, highlight, onAccept, onDecline, busy}){
  const cls = "rounded-xl border p-3 " + (highlight ? "card-open bg-zinc-900/70 border-emerald-400/40" : "bg-zinc-900/60 border-zinc-800");
  return (
    <div className={cls}>
      <div className="flex items-center justify-between">
        <div className="font-semibold">Order #{o.id}</div>
        <div className="text-sm text-zinc-400">{(o.created_at||"").toString().replace("T"," ").replace("Z","")}</div>
      </div>
      <div className="text-sm text-zinc-300 mt-1">
        Status: <span className="font-medium">{o.status || "?"}</span> ·
        Summe: <span className="font-medium">{((o.total_cents||0)/100).toFixed(2)} €</span> ·
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
      {highlight ? (
        <div className="mt-3 flex gap-2">
          <button
            onClick={()=>onAccept(o.id)}
            disabled={busy===o.id}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 font-semibold disabled:opacity-60">
            {busy===o.id ? "Annehmen…" : "Annehmen"}
          </button>
          <button
            onClick={()=>onDecline(o.id)}
            disabled={busy===o.id}
            className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 border border-rose-400 font-semibold disabled:opacity-60">
            {busy===o.id ? "Storniert…" : "Ablehnen/Stornieren"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

async function apiAccept(id){
  const token = (typeof localStorage!=="undefined" && (localStorage.getItem("token")||localStorage.getItem("jwt")||localStorage.getItem("authToken"))) || "";
  const headers = { "content-type":"application/json" };
  if (token) headers.authorization = /^Bearer\s+/i.test(token) ? token : ("Bearer " + token);
  const res = await fetch(`/api/courier/orders/${id}/accept`, { method:"POST", headers, body:"{}" });
  if (!res.ok) throw new Error("accept_failed_"+res.status);
  return res.json();
}
async function apiDecline(id){
  const token = (typeof localStorage!=="undefined" && (localStorage.getItem("token")||localStorage.getItem("jwt")||localStorage.getItem("authToken"))) || "";
  const headers = { "content-type":"application/json" };
  if (token) headers.authorization = /^Bearer\s+/i.test(token) ? token : ("Bearer " + token);
  const res = await fetch(`/api/courier/orders/${id}/decline`, { method:"POST", headers, body:"{}" });
  if (!res.ok) throw new Error("decline_failed_"+res.status);
  return res.json();
}

export default function KurierView(){
  const { orders, total, status, setStatus, loading, loadMore, reload } = useCourierOrders();
  const [busyId, setBusyId] = useState(null);

  const groups = useMemo(() => {
    const ing = [], aktiv = [], done = [];
    for (const o of orders) {
      const s = String(o.status||"").toLowerCase();
      if (s === "wartet_bestätigung" || s === "wartet_bestaetigung") ing.push(o);
      else if (s === "akzeptiert" || s === "in arbeit" || s === "in_arbeit") aktiv.push(o);
      else if (s === "abgeschlossen" || s === "storniert") done.push(o);
      else aktiv.push(o);
    }
    return { ing, aktiv, done };
  }, [orders]);

  async function onAccept(id){
    try{ setBusyId(id); await apiAccept(id); await reload(); }
    catch(e){ console.error(e); alert("Annehmen fehlgeschlagen"); }
    finally{ setBusyId(null); }
  }
  async function onDecline(id){
    if (!confirm("Bestellung wirklich sofort stornieren?")) return;
    try{ setBusyId(id); await apiDecline(id); await reload(); }
    catch(e){ console.error(e); alert("Ablehnen/Stornieren fehlgeschlagen"); }
    finally{ setBusyId(null); }
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center gap-2 mb-3">
        <input
          type="text"
          readOnly
          placeholder="Suche (ID/Name)…"
          className="flex-1 px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-200"
        />
        <select
          className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800"
          value={status}
          onChange={(e)=>setStatus(e.target.value)}
        >
          <option value="all">Alle</option>
          <option value="open">Eingehend</option>
          <option value="akzeptiert">Akzeptiert</option>
          <option value="storniert">Storniert</option>
          <option value="abgeschlossen">Abgeschlossen</option>
        </select>
        <button onClick={reload} className="px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700">Aktualisieren</button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Lade Bestellungen…</div>
      ) : (
        <>
          <Section title="Eingehend" empty="Keine offenen Bestellungen.">
            {groups.ing.map(o => (
              <OrderCard key={o.id} o={o} highlight onAccept={onAccept} onDecline={onDecline} busy={busyId} />
            ))}
          </Section>

          <Section title="Aktiv" empty="Nichts aktiv.">
            {groups.aktiv.map(o => (
              <OrderCard key={o.id} o={o} onAccept={onAccept} onDecline={onDecline} busy={busyId} />
            ))}
          </Section>

          <Section title="Abgeschlossen" empty="Noch keine erledigt.">
            {groups.done.map(o => (
              <OrderCard key={o.id} o={o} onAccept={onAccept} onDecline={onDecline} busy={busyId} />
            ))}
          </Section>

          <div className="flex justify-center mt-4">
            {orders.length < total ? (
              <button onClick={loadMore} className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-600">
                Mehr laden
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
