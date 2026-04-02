# GoSavor Worker 部署指南

## 1. 安裝 Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

## 2. 部署 Worker
```bash
cd worker
wrangler deploy
```

## 3. 設定環境變數（Secrets）
```bash
wrangler secret put GEMINI_API_KEY
# 輸入你的 Gemini API Key

wrangler secret put SUPABASE_URL
# 輸入: https://pwexugipwqmucomqusyu.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# 輸入你的 Supabase anon key

wrangler secret put SUPABASE_JWT_SECRET
# 從 Supabase Dashboard → Settings → API → JWT Secret 複製
```

## 4. 取得 Worker URL
部署後會顯示 URL，像是：
```
https://gosavor-api.youweulin.workers.dev
```

## 5. 更新 App 設定
把 Worker URL 加到 `.env.local`：
```
VITE_WORKER_URL=https://gosavor-api.youweulin.workers.dev
```

## 6. 執行 Supabase SQL
在 Supabase SQL Editor 執行 `supabase-usage.sql`

## 7. 重新 Build
```bash
npm run build  # 或 npx vite build
npx cap sync ios
```
