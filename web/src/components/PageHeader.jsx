import React from 'react'
export default function PageHeader({ title, subtitle=null, right=null }){
  return (
    <div className="rounded-2xl p-4 border border-slate-800 bg-gradient-to-r from-emerald-600/10 via-cyan-600/10 to-fuchsia-600/10">
      <div className="flex items-center gap-2">
        <div className="text-xl font-extrabold">{title}</div>
        {right ? <div className="ml-auto">{right}</div> : null}
      </div>
      {subtitle ? <div className="text-xs opacity-80 mt-1">{subtitle}</div> : null}
    </div>
  )
}
