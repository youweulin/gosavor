# GoSavor 版本更新記錄

## v0.8.8 (2026-04-04)

### 帳號系統
- 新增 Email 登入/註冊（Supabase Auth）
- 強制登入 Modal（不可關閉）
- 移除 Firebase 依賴，全面改用 Supabase Auth
- 匿名登入自動登出，要求真實帳號
- Settings 帳號區塊（Email、方案、登出）
- Apple Sign In 準備好（等 Developer Program 審核）

### 定價與兌換碼
- 新增 beta 方案（公測版，兌換碼開通）
- 免費版：AI 翻譯鎖定，需兌換碼
- 公測版：自帶 Key，iOS 50次/天、PWA 30次/天
- 贊助版：自帶 Key，無限
- 每日 50 次 client-side 限額
- 系統 API 暫時關閉（程式碼保留）
- 平台差異化顯示（iOS vs PWA）

### 多頁菜單翻譯
- 支援最多 4 頁菜單照片
- 每頁獨立翻譯，頁籤切換
- 跨頁點餐記憶（數量不會消失）
- 結帳合併所有頁菜品
- iOS 原生 picker + PWA label/input 加頁
- 圖片標記跟隨頁籤切換

### AI 模型
- Gemini 2.5 Flash → 3.1 Flash Lite fallback（429 quota）
- PWA 菜單也加入 fallback（之前沒有）
- 3.1 Lite boundingBox 設為 required
- bounding box scale 自動偵測修正（0-1/0-100/0-1000）
- 改進 3.1 Lite 的 bounding box prompt

### 旅遊日記重新設計
- 時間軸 UI（左側橘色線 + 彩色圓點）
- 不同類型卡片（美食/購物/地標/對話/AR）
- 每日統計（餐數/購物/翻譯/對話）
- 對話翻譯可儲存到日記
- 首頁旅遊日記摘要整合到 HomeCard

### UI 改進
- Settings：語言 + 貨幣並排
- Settings：API Key 教學獨立頁面
- Settings：匯率日期精簡
- 底部 Tab：AI翻譯（Bot icon）、AR（掃描框+A）
- HomeCard：旅程名稱 + 地點天氣置中
- 結帳 ↔ 對話翻譯互相切換
- 推薦系統 GPS 定位
- 移除分享按鈕（暫時）
- 位置列固定高度防跳動

### 修復
- PWA 菜單模式 autoAnalyze 殘留問題
- PWA 選圖後清除舊翻譯結果
- PWA file input Safari 相容（label 包 input）

---

## v0.8.1 (之前版本)
- 基礎菜單/收據/萬用翻譯
- AR 即時翻譯
- 對話翻譯
- 匿名登入（Supabase）
- Firebase Auth（未使用）
- 旅遊日記基礎版
- 記帳簿
- 點餐系統
