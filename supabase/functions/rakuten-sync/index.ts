import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RAKUTEN_APP_ID = '40c15934-1373-4dc0-a3f6-e9fffa2f83c3'
const RAKUTEN_ACCESS_KEY = 'pk_cnZ5aZt4XZnrTXsxrB0beaUrh9jeDjbJ1ek762viGfR'
const SYNC_SECRET = 'gosavor-sync-2026'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function searchRakuten(keyword: string) {
  const url = `https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20220601?format=json&applicationId=${RAKUTEN_APP_ID}&accessKey=${RAKUTEN_ACCESS_KEY}&keyword=${encodeURIComponent(keyword)}&hits=1`
  const res = await fetch(url, {
    headers: { 'Referer': 'https://gosavor.zeabur.app/' },
  })
  if (!res.ok) return null
  const data = await res.json()
  if (data.errors || data.error) return null
  return data.Items || []
}

function extractJAN(caption: string): string | null {
  if (!caption) return null
  const m = caption.match(/JAN[:\s]?(\d{13})/i) || caption.match(/(49\d{11}|45\d{11})/)
  return m ? m[1] : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const url = new URL(req.url)
  const key = url.searchParams.get('key')
  if (key !== SYNC_SECRET) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const batch = parseInt(url.searchParams.get('batch') || '10')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // 1. 撈 price_reports
  const { data: reports } = await supabase
    .from('price_reports')
    .select('product_name, jan_code')
    .order('created_at', { ascending: false })
    .limit(batch * 3)

  if (!reports || reports.length === 0) {
    return new Response(JSON.stringify({ message: 'No products' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 去重
  const seen = new Set<string>()
  const unique = reports.filter((r: any) => {
    const k = r.jan_code || r.product_name
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })

  // 2. 檢查已在 products 表
  const { data: existing } = await supabase.from('products').select('name, jan_code').limit(1000)
  const existNames = new Set((existing || []).map((p: any) => p.name))
  const existJANs = new Set((existing || []).filter((p: any) => p.jan_code).map((p: any) => p.jan_code))

  const toProcess = unique.filter((p: any) => {
    if (p.jan_code && existJANs.has(p.jan_code)) return false
    if (existNames.has(p.product_name)) return false
    return true
  }).slice(0, batch)

  if (toProcess.length === 0) {
    return new Response(JSON.stringify({ message: 'All products already have data' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. 搜尋楽天
  const results: any[] = []
  for (const product of toProcess) {
    const fullName = (product as any).product_name.replace(/[\s\-_\.・]/g, ' ').substring(0, 30)
    const shortName = (product as any).product_name.replace(/[\d\s\-_\.・]+[錠包枚個入g粒ml本袋箱]+$/g, '').substring(0, 20)
    const keywords = [fullName, shortName].filter((v, i, a) => v && a.indexOf(v) === i)

    let found = false
    for (const kw of keywords) {
      try {
        const items = await searchRakuten(kw)
        if (!items || items.length === 0) {
          await new Promise(r => setTimeout(r, 1100))
          continue
        }

        const item = items[0].Item
        const imageUrl = (item.mediumImageUrls?.[0]?.imageUrl || '').replace('?_ex=128x128', '?_ex=300x300')
        const jan = (product as any).jan_code || extractJAN(item.itemCaption)

        await supabase.from('products').upsert({
          jan_code: jan,
          name: (product as any).product_name,
          image_url: imageUrl,
          rakuten_price: item.itemPrice || null,
          rakuten_url: item.itemUrl || null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'jan_code' })

        results.push({ name: kw, status: 'ok', image: !!imageUrl, jan })
        found = true
        break
      } catch (err) {
        results.push({ name: kw, status: 'error', error: String(err) })
      }
      await new Promise(r => setTimeout(r, 1100))
    }

    if (!found && results[results.length - 1]?.status !== 'error') {
      results.push({ name: fullName, status: 'not_found' })
    }
    await new Promise(r => setTimeout(r, 1100))
  }

  return new Response(JSON.stringify({ message: `Processed ${results.length}`, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
