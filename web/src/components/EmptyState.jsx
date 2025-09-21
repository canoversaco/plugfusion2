import React from 'react'
export default function EmptyState({ title="Nichts gefunden", note=null, action=null }){
  return (
    <div className="card text-center py-10">
      <div className="text-lg font-extrabold mb-1">{title}</div>
      {note ? <div className="opacity-70 text-sm mb-3">{note}</div> : null}
      {action}
    </div>
  )
}
