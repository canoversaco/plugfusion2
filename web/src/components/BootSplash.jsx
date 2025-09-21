import React from 'react'
export default function BootSplash({ text='Lade…' }){
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-sm opacity-80">{text}</div>
    </div>
  )
}
