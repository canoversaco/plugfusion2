(function(){
  function fallbackAdd(product){
    try{
      const key='plug.cart.v1'
      const arr = JSON.parse(localStorage.getItem(key)||'[]')
      const id = product?.id ?? product?.product_id
      const title = product?.name ?? product?.title ?? ('#'+id)
      const price = Number(product?.price ?? (product?.price_cents/100) ?? 0)
      const idx = arr.findIndex(x=>String(x.id)===String(id))
      if (idx>=0) arr[idx].qty=(arr[idx].qty||1)+1; else arr.push({id, title, price, qty:1, image:product?.image_url||product?.image||''})
      localStorage.setItem(key, JSON.stringify(arr))
      window.dispatchEvent(new Event('storage'))
    }catch{}
  }
  window.addToCart = function(product, qty){
    if (window.__cartApi?.addItem) return window.__cartApi.addItem(product, qty||1)
    return fallbackAdd(product)
  }
  window.addEventListener('pf:addToCart:payload', (ev)=>{
    const p = ev.detail?.product; const q = ev.detail?.qty||1
    window.addToCart(p,q)
  })
})();
