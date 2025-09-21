import React, { useEffect, useState } from "react";
import { useCart } from "../cart/CartContext.jsx";
import TreffpunktSelector from "../components/TreffpunktSelector.jsx";

export default function Checkout() {
  const cart = useCart();
  const items = (cart && cart.items) ? cart.items : [];
  const [payment, setPayment] = useState("cash"); // 'wallet' | 'cash'
  const [balance, setBalance] = useState(0);      // cents
  const [point, setPoint] = useState(null);       // {lat,lng,desc}
  const [busy, setBusy] = useState(false);

  const euro = (cents) => (Number(cents || 0) / 100).toFixed(2) + " €";
  const totalCents = ("totalCents" in (cart || {}))
    ? Number(cart.totalCents || 0)
    : Math.round(Number((cart && cart.total) || 0) * 100);

  // Wallet-Guthaben laden
  useEffect(() => {
    (async () => {
      try {
        const token = (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";
        const r = await fetch("/api/wallet/profile", {
          headers: token ? { Authorization: "Bearer " + token } : {}
        });
        if (r.ok) {
          const j = await r.json();
          const cents = Number(j && j.balance_cents != null
            ? j.balance_cents
            : Math.round(Number(j && j.balance ? j.balance : 0) * 100));
          setBalance(isFinite(cents) ? cents : 0);
        }
      } catch (_) {}
    })();
  }, []);

  async function submit() {
    if (!items.length) return;
    if (payment === "wallet" && balance < totalCents) {
      alert("Guthaben reicht nicht aus.");
      return;
    }
    setBusy(true);
    try {
      const token = (typeof localStorage !== "undefined" && localStorage.getItem("token")) || "";
      const body = {
        items: items.map((it) => ({
          product_id: it.id,
          qty: Number(it.qty || 1),
          grams: Number(it.grams || 1)
        })),
        payment: payment,                   // 'wallet' | 'cash'
        pay_with_wallet: payment === "wallet",
        meeting_point: point || null,      // {lat,lng,desc}
        mode: "pickup"
      };

      
      const headers = (function(){
        const h = { "content-type": "application/json" };
        let t = "";
        try {
          const keys = ["token","jwt","authToken","plug_token","TOKEN","JWT"];
          for (const k of keys) {
            const v = (typeof localStorage!=="undefined" && localStorage.getItem(k)) || "";
            if (v && v.length > t.length) t = v;
          }
        } catch(_) {}
        if (t) {
          // Falls bereits "Bearer " enthalten: unverändert nutzen
          if (/^Bearer\s+/i.test(t)) h["Authorization"] = t;
          else h["Authorization"] = "Bearer " + t;
        }
        return h;
      })();


      const res = await fetch("/api/orders", { headers, 
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        let msg = "HTTP " + res.status;
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch(_) {}
        throw new Error(msg);
      }
      const j = await res.json();
      if (j && j.order_id) {
        try { localStorage.setItem("last_order_id", String(j.order_id)); } catch(_) {}
      }
      if (cart && typeof cart.clear === "function") cart.clear();
      location.hash = "#/orders";
    } catch (e) {
      console.error(e);
      alert("Bestellung fehlgeschlagen: " + (e && e.message ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-3 py-4 space-y-4">
      <h1 className="text-xl font-semibold">Zur Kasse</h1>

      {items.length === 0 ? (
        <div className="text-zinc-400">Dein Warenkorb ist leer.</div>
      ) : (
        <>
          {/* Items */}
          <div className="space-y-2">
            {items.map((it) => {
              const priceCents = Number(
                it && it.price_cents != null
                  ? it.price_cents
                  : Math.round(Number(it && it.price ? it.price : 0) * 100)
              ) || 0;
              const img = (it && (it.image || it.image_url)) || null;
              return (
                <div key={it.id} className="flex items-center gap-3 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  {img ? <img src={img} className="w-12 h-12 rounded-md object-cover" /> : null}
                  <div className="flex-1">
                    <div className="font-medium">{it.title || it.name || ("#" + it.id)}</div>
                    <div className="text-xs text-zinc-400">
                      {euro(priceCents)} · Menge
                      <input
                        type="number"
                        min="1"
                        value={it.qty || 1}
                        onChange={(e) => cart.setQty(it.id, Number(e.target.value))}
                        className="ml-2 w-16 px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-sm"
                      />
                    </div>
                  </div>
                  <button
                    onClick={() => cart.remove(it.id)}
                    className="text-xs px-2 py-1 rounded bg-rose-700 hover:bg-rose-600"
                  >
                    Entfernen
                  </button>
                </div>
              );
            })}
          </div>

          {/* Payment */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="font-medium mb-2">Zahlungsart</div>
            <label className="flex items-center gap-2 mb-1">
              <input
                type="radio"
                name="pay"
                checked={payment === "wallet"}
                onChange={() => setPayment("wallet")}
              />
              <span>Guthaben verwenden ({euro(balance)})</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="pay"
                checked={payment === "cash"}
                onChange={() => setPayment("cash")}
              />
              <span>Barzahlung</span>
            </label>
            {payment === "wallet" && balance < totalCents ? (
              <div className="text-amber-400 text-sm mt-2">
                Hinweis: Guthaben reicht nicht fuer die Gesamtsumme.
              </div>
            ) : null}
          </div>

          {/* Treffpunkt */}
          <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div className="font-medium mb-2">Treffpunkt auswaehlen</div>
            <TreffpunktSelector value={point} onChange={setPoint} />
            {point ? (
              <div className="text-xs text-zinc-400 mt-2">
                Gewaehlt: {(point.lat && point.lat.toFixed) ? point.lat.toFixed(5) : point.lat},{" "}
                {(point.lng && point.lng.toFixed) ? point.lng.toFixed(5) : point.lng}
                {point.desc ? (" - " + point.desc) : ""}
              </div>
            ) : null}
          </div>

          {/* Summe */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
            <div>Zwischensumme</div>
            <div className="font-semibold">{euro(totalCents)}</div>
          </div>

          <button
            disabled={busy || (payment === "wallet" && balance < totalCents)}
            onClick={submit}
            className="w-full px-4 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 border border-emerald-400 font-semibold disabled:opacity-60"
          >
            {busy ? "Sende Bestellung..." : "Bestellung abschliessen"}
          </button>
        </>
      )}
    </div>
  );
}
