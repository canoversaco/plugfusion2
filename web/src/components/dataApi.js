import { useAuth } from '../auth/AuthContext.jsx'

export function useApi(){
  const { fetchWithAuth } = useAuth()
  const j = async (u, init)=>{ try{ const r=await fetchWithAuth(u,{ credentials:'include', ...(init||{}), headers:{ 'accept':'application/json', ...(init?.headers||{}) } }); if(!r.ok) return null; return await r.json() }catch{ return null } }

  const categories = async ()=>{
    const tries = ['/api/categories','/api/menu/categories','/api/catalog/categories','/api/admin/categories']
    for (const u of tries){ const d = await j(u); const arr = d?.categories || (Array.isArray(d)?d:null); if (Array.isArray(arr)) return arr.map(c=>({ id:c.id??c.category_id??c.slug??c.name, name:c.name||c.title||c.slug||String(c.id) })) }
    return []
  }

  const products = async (categoryId='all')=>{
    const qs = categoryId && categoryId!=='all' ? `?category=${encodeURIComponent(categoryId)}` : ''
    const tries = [`/api/menu/products${qs}`, `/api/products${qs}`, `/api/catalog/products${qs}`, `/api/products`]
    for (const u of tries){
      const d = await j(u); const list = d?.products || (Array.isArray(d)?d:null)
      if (Array.isArray(list)){
        return list.map(p=>({
          id: p.id ?? p.product_id,
          title: p.name ?? p.title ?? `#${p.id}`,
          image: p.image_url ?? p.image ?? p.banner_image_url ?? null,
          price_cents: Number(p.sale_price_cents ?? p.price_cents ?? Math.round((p.price ?? p.unit_price ?? p.cost ?? 0)*100))||0,
          category_id: p.category_id ?? p.cat_id ?? p.category ?? null,
          in_stock: (p.in_stock ?? p.stock ?? 1) !== 0,
          badge: p.badge_text || null,
          badge_color: p.badge_color || null,
          desc: p.description || p.desc || ''
        }))
      }
    }
    return []
  }

  const parseItems = (o)=>{
    const tryParse=(k)=>{ try{ return JSON.parse(o[k]||'null')||null }catch{ return null } }
    const from=(arr)=> (Array.isArray(arr)?arr:[]).map(x=>({
      id:x.id??x.item_id??x.product_id,
      name:x.name||x.title||x.product_name||`#${x.product_id||x.id}`,
      qty:Number(x.qty??x.quantity??x.count??1)||1,
      price_cents:Number(x.price_cents ?? Math.round((x.price ?? x.unit_price ?? 0)*100))||0
    }))
    return from(o.items) || from(o.lines) || from(tryParse('items_json')?.items) || from(tryParse('cart_json')?.items) || from(tryParse('products_json')) || []
  }

  const myOrders = async ()=>{
    const tries=['/api/my/orders','/api/orders?scope=me','/api/orders']
    for (const u of tries){
      const d = await j(u); const list = d?.orders || (Array.isArray(d)?d:null)
      if (Array.isArray(list)){
        return list.map(o=>({ id:o.id??o.order_id, status:String(o.status||'').toLowerCase(), created_at:o.created_at||o.createdAt||null, items: parseItems(o), total_cents: Number(o.total_cents ?? o.total ?? o.sum ?? 0) }))
      }
    }
    return []
  }

  const courierOrders = async ()=>{
    const tries=['/api/courier/orders','/api/orders?scope=courier','/api/orders','/api/admin/orders']
    for (const u of tries){
      const d = await j(u); const list = d?.orders || (Array.isArray(d)?d:null)
      if (Array.isArray(list)){
        return list.map(o=>({ id:o.id??o.order_id, status:String(o.status||'').toLowerCase(), created_at:o.created_at||o.createdAt||null, customer:o.customer||o.customer_name||o.username||'', address:o.address||o.delivery_address||'', total_cents:Number(o.total_cents ?? o.total ?? o.sum ?? 0), mine: !!(o._mine||o.mine||o.assigned_to_me) }))
      }
    }
    return []
  }

  const postAny = async (urls, body)=>{
    for (const u of urls){
      const r = await j(u, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body||{}) })
      if (r!==null) return true
    }
    return false
  }

  return { j, categories, products, myOrders, courierOrders, postAny }
}
