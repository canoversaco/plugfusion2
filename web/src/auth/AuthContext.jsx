import React, { createContext, useContext, useMemo, useState } from 'react'

const Ctx = createContext(null)

export function AuthProvider({ children }){
  const [user, setUser] = useState(()=>{ try{ return JSON.parse(localStorage.getItem('pf_user')||'null') }catch{ return null } })
  const [token, setToken] = useState(()=> localStorage.getItem('pf_token') || '')

  async function tryLogin(path, body){
    try{
      const r = await fetch(path, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) })
      if(!r.ok) return null
      return await r.json()
    }catch{ return null }
  }

  const login = async (username, password)=>{
    const body = { username, password }
    const attempts = ['/api/login','/api/auth/login','/api/auth/local/login']
    let d=null
    for (const p of attempts){ d = await tryLogin(p, body); if (d) break }
    if (!d) throw new Error('Login fehlgeschlagen')

    const u = d.user || d.profile || { username: d.username || username, role: d.role || 'user' }
    const t = d.token || d.access_token || d.jwt || ''
    setUser(u); setToken(t)
    localStorage.setItem('pf_user', JSON.stringify(u))
    if (t) localStorage.setItem('pf_token', t)
    return { user:u, token:t }
  }

  const logout = ()=>{
    setUser(null); setToken('')
    localStorage.removeItem('pf_user'); localStorage.removeItem('pf_token')
    try{ fetch('/api/logout', { method:'POST' }) }catch{}
  }

  const fetchWithAuth = (input, init = {})=>{
    const headers = new Headers(init.headers || {})
    if (token) headers.set('Authorization','Bearer '+token)
    if (!headers.has('content-type') && init.body) headers.set('content-type','application/json')
    return fetch(input, { ...init, headers, credentials: init.credentials || 'include' })
  }

  const value = useMemo(()=>({ user, token, login, logout, fetchWithAuth }), [user, token])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useAuth = ()=> useContext(Ctx)
