import React, { useState } from "react";
import LiveTracker from "../components/LiveTracker.jsx";
import ChatWindow from "../components/ChatWindow.jsx";

export default function OrderView({ order }) {
  const [openChat, setOpenChat] = useState(false);
  const oid = order?.id || order?.order_id;
  return (
    <div className="p-3 rounded-xl bg-zinc-900/60 border border-zinc-800">
      <div className="flex items-center gap-2 mb-2">
        <div className="font-medium">Bestellung #{oid}</div>
        <div className="text-xs text-zinc-500">• {order?.status || "-"}</div>
        <button onClick={()=>setOpenChat(true)} className="ml-auto text-xs px-3 py-1 rounded bg-zinc-700 hover:bg-zinc-600">Chat</button>
      </div>
      <LiveTracker orderId={oid} canPublish={false} />
      {openChat && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-2" onClick={()=>setOpenChat(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-full md:w-[640px] h-[70vh] bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
            <ChatWindow roomId={`order-${oid}`} onClose={()=>setOpenChat(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
