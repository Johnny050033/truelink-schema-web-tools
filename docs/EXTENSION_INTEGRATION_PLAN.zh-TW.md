# TrueLink 瀏覽器工具與 Schema 整合藍圖

更新：2026-09-15。狀態：**設計與來源盤點完成；整合版尚未實作、未送審、未上架**。

本文件是新開源 repo 的產品計畫，不是 TrueLink-SaaS 的部署指令。
本次不修改原 SaaS、登入修復、正式資料庫或已安裝的舊擴充功能。

## 建議產品方向

採「一個開源專案、共用核心、各瀏覽器獨立封裝」。對使用者的主用途是：
**檢查網站的身分與結構化資料，管理自己的 Schema，選擇是否同步至 TrueLink。**

- 不登入也能本機檢查、建立、儲存與匯出自己的 Schema。
- 加入 TrueLink 帳號後，才可自行啟用私人雲端同步。
- 「儲存私人草稿」「公開 Schema」「申請認證」是三個不同動作。
- Schema 完整度、網站風險訊號、TrueLink 認證，各有獨立的結果與依據。
- 沒有認證、未查到資料、服務離線，都不等於詐騙或安全。
- 不把商城、O2O、音樂、付費掃描等無關操作塞進外掛。

這能共用測試與程式，但不代表四家商店只需一次送審。Chrome 要求目的明確，
若後續反詐功能擴張為另一個獨立用途，應重新評估是否拆商店產品，仍可共用
此 repo；不得只換名稱重複上架相同體驗。
[Chrome 政策](https://developer.chrome.com/docs/webstore/program-policies/policies)

**首版建議範圍**：先共用程式庫與品牌，商店版聚焦「本機結構化資料檢查＋
自己的 Schema 文件管理」。既有 Trust Check 不下架、不卸載；它的反詐、
深度查證、群眾回報及認證查詢先不自動遷入新外掛。是否在後續合成一個
商店產品，需以實際 UI／權限通過單一用途與隱私評估；若無法清楚成立，
採同 repo 的兩個明確產品，不能把「放在不同分頁」當作合規保證。

## 目前核對到什麼

來源是本次唯讀工作區的檔案，不是正式站或商店驗收。

| 項目 | 本次觀察 | 不可推論的事 |
|---|---|---|
| 使用者提供的擴充功能畫面 | 顯示 TrueLink 信任檢查 0.4.0、未封裝載入 | 不代表商店已上架，也未重新讀取瀏覽器現況 |
| 既有 `extension/manifest.json` | 0.5.0、Manifest V3、Chrome/Edge sidePanel | 不代表使用者已安裝此版本 |
| 既有 `extension/manifest.firefox.json` | 0.5.0、Firefox 封裝差異已存在 | 不代表 AMO 已簽章或通過新版政策 |
| 既有 `extension/popup.js` | 本機頁面檢查、公開認證查詢、深度查證、網站回報 | 尚無 Schema 草稿儲存或帳號同步實作 |
| 本 repo 初版 | TypeScript、pnpm、Vitest、欄位驗證與安全靜態 embed | 不是完整 Schema.org 編輯器，也不是可安裝外掛 |
| 商店現況 | 未登入商店後台核對，沒有可驗證的商店 listing 或審核收據 | 舊文件「未上架」也不能當今天的即時狀態 |

既有唯讀參考：`docs/BROWSER_EXTENSION_MASTER_PLAN_2026.md`、
`docs/BROWSER_EXTENSION_STORE_CHECKLIST.md`、`extension/README.md`。
舊版文件有版本、權限與平台要求差異，後續以 exact commit 和實測為準。

## 必須先修正的儲存邊界

本次讀到既有 `public/tools/schema/js/schema-engine.js` 的 `saveToCloud`：
先呼叫 `deploySchemaApi`，再呼叫 `saveSchemaOfficial`。
`functions/routes/schema.js` 的 `deploySchemaApi` 會寫入公開資產 bucket 的
`schema_apis/<owner>.js`；`saveSchemaOfficial` 則會更新正式 Schema 與部分帳號資料。

**不能把這整段流程直接當作私人草稿同步。** 新外掛不能在使用者只按
「儲存」時就發行公開檔案、改公司資料、領獎勵或改官方認證狀態。
以上是原始碼觀察，未送出請求，也未查正式帳戶或 bucket 的實際資料。

應另設私人草稿 API／adapter，與公開快照的動作分離。正式 API 接線需要
另一次有範圍的 SaaS 變更與權限測試；本 PR 不更改 SaaS 的「禁止修改」邊界。
詳見 [雲端同步設計](CLOUD_SYNC_ROADMAP.md)。

## 模組與開源界線

| 模組 | 建議位置（未建立） | 開源／服務界線 |
|---|---|---|
| 純欄位驗證與安全 embed | 現有 `src/` | 已有 MIT 原創骨架；不是完整 Schema.org 規範驗證 |
| Schema.org 文件模型 | `packages/schema-document/` | JSON-LD 匯入、版本、界限、原樣匯出；不執行其中內容 |
| 頁面稽核 | `packages/page-audit/` | 從既有本機模組挑選、保留限量／截斷資訊與測試 |
| 跨瀏覽器外掛 | `apps/extension/` | popup 摘要＋獨立工作頁；不把 DOM 工具塞進核心 validator |
| 雲端 adapter | `packages/cloud-client/` | 公開協定與客戶端；不含私鑰、管理權限、付費 API key |
| 認證／風險資料服務 | 原 TrueLink SaaS | 查核、限流、名單授權、帳號、計費與官方分數留在服務端 |

可評估重用：既有 `extension/risk/*.js` 的純函式、
`extension/audit/page-audit.js` 的有界 DOM 收集器、synthetic 測試。
遷移前須列出檔案與來源 commit、確認權利人／第三方授權，去除品牌特例的
「通用安全」宣稱。既有來源沒有明確的擴充功能 LICENSE；`private: true`
本身也不是授權判斷。使用者已要求開源，但不能因此把第三方素材和資料名單
一併改成 MIT。

不整包複製私有 repo、客服紀錄、真實 Schema、帳戶／回報資料或歷史內部文件。
品牌標誌與資料集的使用條件分開記錄；MIT 程式授權不等於授予商標冒用權。
舊測試素材若含淘汰來源，需重建合成案例，不作新產品或即時資料的證據。

## 資料流與安全契約

```text
使用者點選檢查目前分頁
  → 有界本機解析 → 呈現來源／限制／未查項目
  → 自行選擇匯入的 JSON-LD → 本機私人草稿 → 匯出 JSON-LD
                                      │
                           明確登入＋同意同步
                                      ↓
                         私人草稿 API（尚未建立）
                                      │
                           另外確認公開／撤回
                                      ↓
                             可撤回公開快照
```

- 本機僅使用 `storage.local`，不以瀏覽器 `storage.sync` 冒充 TrueLink 雲端。
  清除擴充功能或換裝置可能失去本機資料，必須提供匯出與說明。
- 不讀 cookies／密碼／表單值，不自動巡覽歷史、不常駐追蹤所有分頁。
- 限制 JSON-LD bytes、區塊數、深度、節點、文件數；超限明示不完整。
  未知 Schema.org 屬性可保留但標示「尚未驗證」，不可套用平面 API
  unknown-field 規則刪掉合法擴充屬性；儲存 API envelope 則採嚴格 allowlist。
- JSON-LD 是不可信資料：純文字呈現、不載入其 scripts／外部 context／URLs，
  不依任意遠端指令執行程式。手動複製用的 JSON-LD script 標籤與一般 web
  embed 是不同輸出，不可放寬現有 embed 的 script 禁令。
- 即使從其他網站匯入資料，也不能自動宣稱使用者擁有該網站或通過身分驗證。
- 雲端 owner／workspace／正式分數／revision 由伺服器核定；不得由前端冒填。
  採版本衝突保留、冪等重試、分頁、配額、撤權及匯出／刪除測試。
- 儲存帳號與本機裝置分開：登出不漏顯示上個帳號的雲端快取；切換帳號不
  自動把裝置草稿上傳给新帳號。登入過期不丟稿，也不假顯示同步成功。
- 資料庫管理金鑰、OAuth client secret、App Check debug token 不進客戶端。
  不複製既有瀏覽器 session／refresh token；設計經審核的帳號連結協定。

首版建議應用上限：每份 JSON-LD 100 KiB UTF-8、20 份本機文件、序列化
儲存總量 3 MiB；JSON 深度 20、節點 2,000。匯入最多 20 個區塊，整次
收集 JSON-LD 合計 300 KiB。這些是待實作的契約，不是已有效設定。
先檢查瀏覽器實際剩餘容量；任一上限先到即拒絕新寫入、保留原稿及編輯器
內容，提供匯出／刪除選擇，不自動清稿或申請 unlimitedStorage。

## 現有網路行為不能漏寫

現有 popup 的認證查詢會傳 hostname；深度查證是按鈕觸發的 hostname 請求；
回報會送出 hostname、原因、選填說明、本機判斷級別、語言與外掛版本。
因此沿用這些功能時，**不能宣稱完全離線或零資料傳輸**。
新版本建議首次提示、由使用者自行啟用線上查證；草稿同步另行同意，
不同意仍可使用本機功能。這是新設計，尚未改變舊外掛。

## 分期與完成定義

| 階段 | 實作內容 | 完成證據 | 此次狀態 |
|---|---|---|---|
| 0 | 現況盤點、開源界線、設計與商店規劃 | 本文件與獨立覆核 | 已建立文件，見 PR |
| 1 | 來源授權清單、共用 audit／文件核心、跨瀏覽器封裝 | exact SHA、synthetic 測試、可重現 ZIP | 未實作 |
| 2 | Schema 工作頁、本機 CRUD、匯入／匯出、登入／註冊入口 | 真外掛 E2E；重啟後草稿存在；無背景外傳 | 未實作 |
| 3 | TrueLink 私人雲端同步與獨立公開動作 | A/B 帳號隔離、斷網／撤權／重試／衝突驗收 | 需另一個 SaaS 有範圍 PR；未實作 |
| 4 | 四家商店發行 | 包件 SHA、隱私／素材、送審編號、listing、乾淨安裝 | 尚未送審／未驗證 |

文件合併、ZIP 產生、商店送審、正式可安裝是不同狀態。未收齊上一階段
證據時，不在網站放「已上架」徽章，也不把 beta 當正式版覆蓋原安裝。

下一步見 [UI／UX 規格](EXTENSION_UX_SPEC.zh-TW.md) 與
[商店發行矩陣](EXTENSION_STORE_MATRIX.zh-TW.md)。
