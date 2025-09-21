import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { CartProvider } from './cart/CartContext.jsx'
import './index.css'
import './components/cartBridge.js'

function Gate(){
  const { user, token, logout } = useAuth()
  const [route,setRoute] = useState(()=> window.location.hash || '#/menu')

  useEffect(()=>{
    const onHash = ()=>{
      const h = window.location.hash || '#/menu'
      if (!user || !token){
        sessionStorage.setItem('pf.afterLogin', h)
        if (h !== '#/login') window.location.hash = '#/login'
      }
      setRoute(window.location.hash || '#/menu')
    }
    window.addEventListener('hashchange', onHash)
    onHash()
    return ()=> window.removeEventListener('hashchange', onHash)
  }, [user, token])

  useEffect(()=>{
    if ((window.location.hash||'') === '#/logout'){
      logout()
      window.location.hash = '#/login'
    }
  }, [route])

  if (!user || !token || (window.location.hash||'')==='#/login'){
    const Login = require('./auth/Login.jsx').default
    return <Login/>
  }
  return (
    <CartProvider>
      <App/>
    </CartProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <Gate/>
    </AuthProvider>
  </React.StrictMode>
)
