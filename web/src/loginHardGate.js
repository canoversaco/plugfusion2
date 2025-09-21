/**
 * Harte Weiterleitung auf #/login, wenn kein Token vorhanden ist.
 * Läuft, bevor die App gemountet wird (in index.html eingebunden).
 */
try{
  const t = localStorage.getItem('pf_token')
  if (!t && location.hash !== '#/login') {
    // ursprüngliches Ziel merken
    if (location.hash) sessionStorage.setItem('pf.afterLogin', location.hash)
    location.hash = '#/login'
  }
}catch{}
