import "leaflet/dist/leaflet.css";
import React, { Suspense, useEffect, useState, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuth } from './auth/AuthContext.jsx'
import { CartProvider } from './cart/CartContext.jsx'
import BootSplash from './components/BootSplash.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './components/cartBridge.js'

// Lazy Imports (ESM-sicher)
const App = lazy(()=>import('./App.jsx'))
const Login = lazy(()=>import('./auth/Login.jsx'))

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
    window.addEventListener('hashchange', onHash); onHash()
    return ()=> window.removeEventListener('hashchange', onHash)
  }, [user, token])

  useEffect(()=>{
    if ((window.location.hash||'') === '#/logout'){ logout(); window.location.hash = '#/login' }
  }, [route])

  const needsLogin = (!user || !token || (window.location.hash||'')==='#/login')
  if (needsLogin){
    return (
      <Suspense fallback={<BootSplash text="Lade Login…"/>}>
        <Login/>
      </Suspense>
    )
  }
  return (
    <CartProvider>
      <Suspense fallback={<BootSplash text="Lade App…"/>}>
        <App/>
      </Suspense>
    </CartProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <Gate/>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
