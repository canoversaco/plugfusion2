import React from 'react'
export default class ErrorBoundary extends React.Component{
  constructor(p){ super(p); this.state={err:null} }
  static getDerivedStateFromError(err){ return {err} }
  componentDidCatch(err,info){ console.error('UI Error:', err, info) }
  render(){
    if(this.state.err){
      return (
        <div className="min-h-screen p-4 bg-slate-950 text-slate-100">
          <div className="max-w-xl mx-auto rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
            <div className="font-bold mb-2">Es ist ein Fehler aufgetreten.</div>
            <pre className="text-xs whitespace-pre-wrap opacity-90">{String(this.state.err?.message||this.state.err)}</pre>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
