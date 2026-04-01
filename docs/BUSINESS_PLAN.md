# GoSavor 藥妝比價生態系 — 完整計畫

---

## 一、商業模型

核心邏輯：用低價衝量 → 用戶自帶 Key 免費幫你建資料庫 → 資料變成護城河

收入來源：
- 1. 終身版 $199 TWD（自帶 Key，零成本，100% 毛利）
- 2. 5天旅遊包 $150 TWD（系統 Key，96% 毛利）
- 3. 點數包 $99 TWD = 100 點（系統 Key，97% 毛利）
- 4. B2B 藥妝資料授權（Year 2+）

---

## 二、方案定價

| 方案 | 價格 | API Key | 日額度 | 硬上限 |
|------|------|---------|--------|--------|
| 免費版 | $0 | 自帶 | 10 次 | 10 次 |
| 終身版 | $199 | 自帶 | 20 次 | 50 次 |
| 5天旅遊包 | $150 | 系統 | 不限 | 80 次 |
| 點數包 | $99 | 系統 | 用到完 | 80 次 |
| 測試期（Phase 0）| $0 | 系統 | 10 次 | 10 次 |

- 所有方案都自動收集 priceReport ✓
- 點數包 🎁 送 5 天藥妝情報 VIP
- 超過硬上限 → 當天封頂，明天 00:00 重置
- 測試期限定 GPS 日本，$300 額度

---

## 三、競爭優勢 vs Kuli Kuli

| | Kuli Kuli | GoSavor |
|--|-----------|---------|
| 終身價 | $690-990 | **$199** |
| 菜單翻譯 | 文字列表 | 圖片精準對位編號 |
| 藥妝翻譯 | 有 | 有 + 比價資料庫 |
| 收據翻譯 | 有 | 有 + 自動記帳 |
| 語音對話翻譯 | **無** | Apple Speech 原生 |
| 離線翻譯 | **無** | Apple Translation |
| 比價功能 | **無** | 獨家護城河 |
| API | 他們的 | 用戶自帶（零成本）|
| 用戶規模 | 200萬 | 目標 Year 1: 1萬 |
| App Store 編輯精選 | 有 | 目標爭取 |

---

## 四、技術架構

```
用戶在日本掃描
    │
    ▼
GPS 檢查（日本：24-46°N，122-154°E）
    │
    ├── 不在日本 → 只能用自帶 Key
    │
    └── 在日本 ✓
         │
         ▼
    Apple Vision OCR（本機，免費）
    產出：文字 blocks + bounding boxes
         │
         ▼
    有自帶 Key？
        │
        ├── 有 → App 直連 Gemini（你的成本 = $0）
        │         │
        │         └── 掃完 → 上傳 priceReport → Firestore
        │
        └── 沒有 → 檢查今日額度
                    │
                    ├── 有額度 → OCR 文字 + 縮圖
                    │             → Cloudflare Worker
                    │             → 系統 Key call Gemini
                    │             → 扣次數 → 回傳結果
                    │             → 上傳 priceReport
                    │
                    └── 沒額度 → 彈出購買 Modal
                                 ├── 終身版 $199
                                 ├── 5天旅遊包 $150
                                 └── 點數包 $99
```

---

## 五、安全架構

### 第一層：系統 Key 保護
- Key 只存在 Cloudflare Worker 環境變數
- 絕對不放在 App / client 代碼中
- 定期 rotate

### 第二層：身份驗證
- signInAnonymously() → 每個用戶有 Firebase uid
- 每個 request 帶 Firebase ID Token
- Worker 用 Firebase Admin 驗證

### 第三層：地理圍欄
- GPS 座標檢查（日本範圍）
- 拒絕定位 → 不給用系統 Key
- 未來可加 IP 交叉驗證

### 第四層：用量控制（Server-side，不信任 client）
- Firestore 記錄 dailyUsage + lastResetDate
- Worker 每次 request 先查再扣（原子操作）
- 硬上限：免費/終身 50 次，系統 Key 80 次
- Rate limit：連續間隔 ≥ 3 秒，每小時 ≤ 日上限÷3

### 第五層：異常偵測
- 10 分鐘內 > 20 次 → 暫停 30 分鐘
- 同一張圖重複掃 → 不扣次數（image hash）
- 監控 dashboard：日花費 > $10 → 自動降額

---

## 六、資料庫結構

### Firestore Collections

```typescript
// 用戶（已有，擴充）
users/{uid}
├── ...existing fields...
├── dailyUsage: 0
├── lastResetDate: "2026-04-02"
├── credits: 0
├── plan: "free" | "lifetime"
├── priceReportCount: 0
└── nickname: "藥妝新手"

// 價格回報（新建，核心資產）
priceReports/{auto-id}
├── productName: "アリナミンEXプラス"
├── translatedName: "合利他命EX Plus"
├── normalizedKey: "アリナミンexプラス"
├── price: 5980
├── currency: "JPY"
├── storeName: "ココカラファイン"
├── storeBranch: "銀座4丁目店"
├── isTaxFree: true
├── date: "2026-04-01"
├── userId: "anon_xxx"
└── createdAt: timestamp

// 商品摘要（Phase 1 再做，或即時 query）
productSummary/{normalizedKey}
├── productName, translatedName
├── avgPrice, minPrice, maxPrice
├── reportCount
├── stores: [...]
└── updatedAt: timestamp
```

### Firestore Rules
```
priceReports:
├── read: 任何人
├── create: 已登入（含匿名）
└── update/delete: 不允許
```

---

## 七、商品名正規化

```typescript
function normalizeProductName(name: string): string {
  return name
    .normalize('NFKC')              // 半形→全形統一
    .toLowerCase()
    .replace(/[\s\-\_\.・]/g, '')   // 去空白符號
    .replace(/[０-９]/g, m =>       // 全形數字→半形
      String.fromCharCode(m.charCodeAt(0) - 0xFEE0))
}

// "ｱﾘﾅﾐﾝEXﾌﾟﾗｽ" → "アリナミンexプラス"
// "アリナミンEXプラス" → "アリナミンexプラス" ✅ 同一個 key
```

---

## 八、費用推估

### Gemini 2.5 Flash 單次成本
- GoSavor (有 Apple Vision)：$0.00072/次
- jptg2026 (PWA，無 Vision)：$0.001/次

### 測試期（$300 額度）
| 活躍用戶 | 日花費 | 可撐天數 |
|---------|--------|---------|
| 500 × 40% | $1.4/天 | 214 天 |
| 1,000 × 40% | $2.9/天 | 103 天 |
| 3,000 × 40% | $8.6/天 | 34 天 |

### 正式收費後月成本
| 項目 | 費用 |
|------|------|
| Gemini API | $60-300/月 |
| Cloudflare Worker | $0-5/月 |
| Firebase Firestore | $2-15/月 |
| Apple Developer | $99 USD/年 |
| 自帶 Key 用戶 | $0 |

---

## 九、收入預估（正式收費後 12 個月）

| | 保守 | 中等 | 爆發 |
|--|------|------|------|
| 下載量 | 10K | 50K | 200K |
| 活躍用戶 | 2,500 | 12,000 | 48,000 |
| 付費用戶 | 600 | 2,600 | 10,500 |
| 終身版 $199 | $49,750 | $238,800 | $995,000 |
| 5天旅遊包 $150 | $30,000 | $120,000 | $450,000 |
| 點數包 $99 | $14,850 | $59,400 | $247,500 |
| 點數回購 | $15,840 | $59,400 | $237,600 |
| **年收入 (TWD)** | **$110,440** | **$477,600** | **$1,930,100** |
| 年成本 (TWD) | $4,000 | $37,000 | $119,400 |
| **淨利 (TWD)** | **$106,440** | **$440,600** | **$1,810,700** |
| 毛利率 | 96% | 92% | 94% |
| 藥妝資料 B2B（Year 2+）| — | $180,000/年 | $600,000/年 |

---

## 十、階段時程

### Phase 0｜現在 → 第 1 個月｜基礎建設

**App 改動：**
- signInAnonymously() 自動建 uid
- GPS 日本圍欄檢查
- usageService：用量追蹤 + 每日重置
- handleAnalyze() 改造：
  - 有自帶 Key → 直連 Gemini（不變）
  - 沒 Key + 在日本 → 走 Worker proxy
- 掃完收據 → 自動上傳 priceReport
- 商品名正規化 normalizeProductName()
- Firestore rules 更新

**Server：**
- Cloudflare Worker 部署
- /api/v1/scan endpoint
- Firebase Token 驗證
- GPS 座標驗證
- 系統 Key 環境變數

**測試期規則：**
- 所有用戶 10 次/天免費（系統 Key，$300 額度）
- GPS 限定日本
- 有自帶 Key → 無上限、不限地區
- 開始收集 priceReport

### Phase 1｜第 1-2 個月｜比價功能
- 基本比價搜尋 UI（搜商品 → 各店價格）
- 藥妝情報頁面
- 用量顯示 UI（今日剩餘 X 次）
- 購買 Modal UI（先做好，暫不開放）
- priceReport 資料品質監控
- 目標：累積 5,000+ 筆價格資料

### Phase 2｜第 2-3 個月｜收網準備
- 開放終身版 $199 預購（早鳥）
- 點數購買功能上線
- 進階比價（歷史趨勢、最佳購買時機）
- 推送：「感謝測試！正式版即將上線」
- 目標：驗證付費轉換率

### Phase 3｜第 3 個月｜正式收費
- 完整方案上線：
  - 免費版：10 次/天（自帶 Key）
  - 終身版 $199：20 次/天（自帶 Key）
  - 5天旅遊包 $150：80 次硬上限（系統 Key）
  - 點數包 $99 = 100 點 + 送 5 天藥妝情報
- 比價功能成為主要賣點
- ASO 優化 + 社群推廣
- 目標：1,000+ 活躍用戶、10,000+ 筆價格資料

### Phase 4｜第 4-6 個月｜擴張
- jptg2026 PWA 也接入同一個資料庫
- 藥妝情報 B2B 試水（代購平台、旅遊部落客）
- 排行榜功能（消費排行、貢獻排行）
- 「出發前查價」功能 → 吸引還沒到日本的用戶
- 爭取 App Store 編輯精選

### Phase 5｜第 7-12 個月｜生態系
- 價格資料 API 開放（B2B 授權）
- 擴展到韓國、泰國等其他旅遊目的地
- 商品推薦系統（根據你的消費習慣）
- 店家合作（優惠券 + 導流）

---

## 十一、核心飛輪

```
$199 終身版（零成本）
        │
        ▼
用戶自帶 Key 掃描 → 免費幫你建資料庫
        │
        ▼
資料越多 → 比價越準
        │
        ▼
比價越準 → 更多人下載
        │
        ▼
更多人下載 → 更多 $199 + 更多資料
        │
        ▼
資料夠大 → B2B 賣資料（額外收入）
        │
        ▼
Kuli Kuli 追不上（他們沒有收集資料）
```

---

## 十二、待補功能（vs Kuli Kuli）

### 優先補上
| 優先級 | 功能 | 說明 | 狀態 |
|--------|------|------|------|
| 1 | 藥品標籤翻譯 | 拍藥盒→功效、成分、用法 | 待做 |
| 2 | 零食/美妝包裝翻譯 | 代購必備 | 待做 |
| 3 | 並排翻譯視圖 | 原文+譯文並列 | 收據已有 |
| 4 | App Store 精美截圖 | 上架必備 | 待做 |
| 5 | Landing Page | 行銷必備 | 待做 |

### 我們獨有（他們沒有）
| 功能 | 價值 |
|------|------|
| 即時對話翻譯（Apple 原生）| 殺手級 |
| 點餐系統 + 日語語音 | 殺手級 |
| 店員溝通模式 | 殺手級 |
| 記帳簿 | 高 |
| 旅遊日記 + 旅程管理 | 高 |
| GPS + 天氣首頁 | 中 |
| 聯盟行銷推薦 1056 商品 | 營收 |
| 藥妝比價資料庫 | 護城河 |
