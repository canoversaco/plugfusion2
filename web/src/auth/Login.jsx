import React, { useState } from 'react'
import { useAuth } from './AuthContext.jsx'

export default function Login(){
  const { login } = useAuth()
  const [username,setUsername]=useState('')
  const [password,setPassword]=useState('')
  const [loading,setLoading]=useState(false)
  const [err,setErr]=useState('')

  const submit = async(e)=>{
    e?.preventDefault?.()
    setErr(''); setLoading(true)
    try{
      await login(username.trim(), password)
      const target = sessionStorage.getItem('pf.afterLogin') || '#/menu'
      sessionStorage.removeItem('pf.afterLogin')
      window.location.hash = target
    }catch(ex){
      setErr(ex?.message || 'Login fehlgeschlagen')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
        <div className="text-xl font-extrabold text-center">Anmelden</div>
        <div className="text-xs opacity-70 text-center mb-4">Bitte einloggen, um fortzufahren.</div>
        {err && <div className="mb-3 text-xs rounded-lg border border-rose-500/40 bg-rose-500/10 p-2">{err}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="text-xs opacity-80">Benutzername</label>
            <input autoFocus value={username} onChange={e=>setUsername(e.target.value)} className="w-full px-3 py-2 mt-1 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="username"/>
          </div>
          <div>
            <label className="text-xs opacity-80">Passwort</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-3 py-2 mt-1 rounded-xl bg-slate-950 border border-slate-700 text-sm" placeholder="••••••••"/>
          </div>
          <button disabled={loading} className="w-full rounded-xl border border-emerald-600 bg-emerald-500/20 text-emerald-100 font-bold px-4 py-2">
            {loading?'Anmelden…':'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
