# TrueLink 多平台策略：一個核心、多個入口

狀態：2026-09-24。第 1 階段（本 repo 的共用模組與 Studio 同步介面）已完成；第 2 階段需要在
TrueLink SaaS 實作並部署，本文件只描述架構與介面，不包含私有程式碼、憑證或內部設定。

## 0. 一句話

所有入口使用**同一份 Schema 文件格式、同一套輸出與檢查規則、同一套品牌規範**；資料以
TrueLink 帳號（工作區）為中心；每個入口最後都回到同一個理念：**讓 AI 與搜尋引擎能驗證
「你是誰」**（The AI Trust Engine）。

## 1. 目標

1. **共用模組**：Schema Studio 與 TrueLink 網頁工具（`/tools/schema/`）使用同一個開源核心。
2. **共用資料庫**：同一個帳號在任何入口看到同一批草稿與同一份公開 Schema。
3. **多平台推廣**：App、網站、網頁工具、開源 repo 與開發者／AI 工具，全部把人帶回 TrueLink。

## 2. 架構：開源核心 + TrueLink 服務

| 模組 | 位置 | 授權 | 負責 |
| --- | --- | --- | --- |
| `truelink-schema-web-tools` | 本 repo 根目錄 | MIT | 平面物件驗證、沙箱靜態嵌入 |
| `truelink-schema-document` | `packages/schema-document` | MIT | Schema.org 範本、安全匯入、`<script>` 跳脫輸出、建議性健檢、**共用文件格式 `SchemaDocumentRecord`**、與網頁工具資料格式的雙向轉換 |
| `truelink-schema-cloud` | `packages/cloud-client` | MIT | **host bridge 協定**：客戶端、host 端分派器、參考 host（行為規格） |
| Schema Studio | `apps/web` | MIT（品牌素材除外，見 [TRADEMARKS.md](../TRADEMARKS.md)） | 可安裝的本機優先 PWA；有 host 時提供雲端草稿與發布 |
| TrueLink 網頁工具 | TrueLink SaaS | 私有 | 現有編輯器與會員功能 |
| 帳號、工作區、權限 | TrueLink SaaS | 私有 | 登入、共同管理、能力（capability）檢查 |
| 草稿儲存、發布、官方評分、CDN 腳本 | TrueLink SaaS | 私有 | 伺服器端的權威資料與計算 |
| host 頁面（例如 `/studio/host.html`） | TrueLink SaaS | 私有 | 實作 `HostImplementation`，把協定接到後端函式 |

```text
          開源（本 repo，MIT）                                   TrueLink 服務（私有）
┌──────────────────────────────────────────┐           ┌──────────────────────────────────────┐
│ truelink-schema-document                 │           │ 登入 / 工作區 / 權限                  │
│  範本 · 匯入 · 輸出 · 健檢 · 文件格式     │           │ 私有草稿（有版本號）                  │
│ truelink-schema-cloud                    │  同網域    │ 伺服器發布 → 公開 Schema + CDN 腳本   │
│  host bridge 協定                        │◀────────▶│ 官方評分、KYC、GEO／E-E-A-T 服務      │
│ Schema Studio（PWA）                     │ postMessage│ host 頁面（實作協定）                 │
└──────────────────────────────────────────┘           └──────────────────────────────────────┘
```

原則：開源核心負責「讓人願意用、讓開發者願意整合」；TrueLink 服務負責「只有帳號才有的價值」
（託管部署、官方分數、身分驗證、GEO 策略）。開源核心不含任何後端邏輯或憑證。

## 3. 共用資料：一種文件格式、兩種狀態

| 狀態 | 格式 | 可見性 | 誰可以寫 |
| --- | --- | --- | --- |
| **草稿** | `SchemaDocumentRecord`（每份文件一筆，含穩定 ID） | 私有：本人與有 Schema 權限的工作區成員 | 只經後端函式，帶版本號檢查 |
| **公開 Schema** | 網頁工具現有格式 `{ mainSchema, faqs, type, whitelistedDomains }` | 公開（託管腳本輸出） | 只由伺服器在「發布」時產生 |

- `SchemaDocumentRecord` 只包含使用者撰寫的內容：`id`、`title`、`templateId`、`data`（單一 JSON-LD
  節點）、`updatedAt`。擁有者、伺服器版本號、時間戳記、官方分數與發布狀態都由伺服器管理，
  客戶端送來的同名欄位一律拒絕。
- 轉換：`fromLegacyStoreObj()` 把網頁工具的資料讀成 Studio 文件；`toLegacyStoreObj()` 把 Studio
  文件寫成網頁工具的格式。兩者都不捏造資料，並有往返測試。Studio 的「匯入」也能直接貼上網頁
  工具的資料。

| 網頁工具 | Studio 範本 |
| --- | --- |
| Organization、NGO | 組織／品牌（`organization`） |
| LocalBusiness | 地方商家（`local-business`） |
| Person | 人物（`person`） |
| FAQ 列 | 另一份常見問答（`faq`）文件 |
| 網域白名單 | 部署設定，不屬於 Schema；發布時保留網站上的設定 |

**資料庫規則（給 SaaS 實作）**

1. 私有草稿不可以放在任何公開可讀的位置；建議放在每個工作區底下的私有子集合，客戶端不可直接寫入。
2. 發布只能由伺服器執行：讀取「已儲存且指定版本」的草稿 → 轉成公開格式 → **同一個動作**更新公開
   資料、重新計算官方分數、重新產生託管腳本。公開資料與腳本不應該有機會不一致。
3. 所有寫入都用版本號（expected revision）與冪等鍵（idempotency key）；衝突時回傳目前版本，
   不做「最後寫入者獲勝」。
4. 權限沿用既有的工作區能力：讀取／草稿／發布分開；目標帳號一律由伺服器從登入狀態推導。
5. 設定配額與大小上限（例如每個工作區的草稿數、每份文件 100 KiB），並有刪除與匯出路徑。

## 4. 一處更新、全部同步

目標：**TrueLink 網頁工具（`/tools/schema/`）更新時，所有聯動的工具一起更新。** 分成三層：

| 層次 | 唯一來源 | 怎麼傳到每個工具 | 使用者看到什麼 |
| --- | --- | --- | --- |
| 程式邏輯（範本、輸出與跳脫、匯入、健檢、資料格式轉換） | `truelink-schema-document`（本 repo） | 推送版本標籤 → 自動產生發行檔 → TrueLink 以同一個版本更新網頁工具、後端函式與 `/studio/` | 所有入口的輸出、檢查與欄位一致 |
| 官方評分 | TrueLink 伺服器 | 伺服器部署一次，所有入口透過同一個評分函式取得 | 同一份資料在哪裡看都是同一個官方分數 |
| 資料（草稿與公開 Schema） | TrueLink 資料庫 | 變更後即時通知開著的工具；公開資料一變更，伺服器重建所有輸出 | 在網頁工具改了，Studio 與網站上的輸出跟著更新 |
| 版本相容 | host 宣告的最低核心版本 | 舊版分頁在同步前被要求重新整理 | 不會有新舊版本混用而寫壞資料 |

**1. 程式邏輯只有一份**

- 網頁工具是不經打包的傳統 script，因此核心另外提供瀏覽器建置：
  `truelink-schema-document.global.js`（全域 `TrueLinkSchema`，約 31 KB gzip）與 ES module 版本。
  後端函式使用同版本的 npm 套件；Studio、擴充、CLI、MCP 都打包同一個套件。
- 之後要改善 Schema 的輸出、欄位或檢查，一律改在共用核心，而不是只改網頁工具；這樣改一次，所有工具一起得到改善。
- 發行流程：
  1. 本 repo 推送 `vX.Y.Z` 標籤（必須等於 `truelink-schema-document` 的版本）。
  2. Release workflow 執行全部檢查，產生瀏覽器建置、npm 套件、conformance 測資、單機版 Studio 與 `SHA256SUMS`，發布成 GitHub Release。
  3. TrueLink SaaS 的更新工作偵測到新版本，開一個 PR：同時更新網頁工具載入的核心檔、後端函式的套件版本與 `/studio/` 的建置（用 TrueLink 的 `VITE_TRUELINK_*` 設定重新建置）。
  4. PR 跑 conformance 測資（`conformance/legacy-store.json`）與 SaaS 自己的測試，通過後照既有流程部署。
- 版本規則：修正與新增功能升 minor／patch，可自動升級；資料格式的破壞性變更升 major，並提供遷移（文件格式另有 `RECORD_VERSION`）。

**2. 資料只有一份**

- 公開 Schema 以伺服器上的公開資料為唯一來源。不論是網頁工具儲存、Studio 發布、聊天確認或身分驗證更新，
  只要公開資料改變，伺服器就重建所有衍生輸出（託管腳本、API、徽章、WordPress 外掛讀取的資料）。
- host 頁面監聽草稿與公開資料的變更，透過 bridge 的 `changed` 通知開著的 Studio 立刻重新整理。
- Studio 對「已連結」的文件：這台裝置沒有未上傳的修改時，自動套用雲端的新版本並提示；有修改時絕不覆蓋，改成讓使用者選。
  從未下載過的雲端草稿只會出現在清單中，不會自動佔用本機空間。

**3. 版本一起前進**

- host 在 `ready` 訊息宣告 `minCoreVersion`。TrueLink 升級核心後，舊版 Studio 分頁會顯示「請重新整理」，重新整理前不能同步。
- Studio 的 service worker 在新版部署後提示重新整理；TrueLink App 的 WebView 直接載入網站最新版；
  擴充由商店自動更新；WordPress 外掛每次從伺服器讀取最新的公開資料。

## 5. 帳號與同步流程

Studio 部署在 TrueLink 同一個網域（建議 `https://app.truelink-group.com/studio/`，與網頁工具同一個
主機，登入狀態才會共用）。Studio 用隱藏 iframe 連到 host 頁面，雙方以 `postMessage` 溝通：

1. 使用者打開「帳號與同步」→ Studio 連線 host 頁面（不上傳任何東西）。
2. 未登入 → 「登入 TrueLink」→ 前往網站登入頁（只接受同網域網址），登入後回到 Studio。
3. 已登入 → 列出本機與雲端文件；**上傳一律由使用者逐份按下**，不會自動上傳。已連結的文件在本機沒有修改時，
   自動跟上雲端的新版本（見第 4 節）。
4. 兩邊都有修改 → 三選一：保留本機版本、改用雲端版本、兩份都保留。覆蓋前都有確認對話框。
5. 「發布到 TrueLink」→ 選一份已同步的組織／地方商家／人物（可加一份 FAQ）→ 確認 → 伺服器發布並
   回傳官方分數。

Studio 本身不載入 Firebase、不持有權杖，CSP 維持 `connect-src 'self'`。沒有設定 host（例如
GitHub Pages、自架）時，Studio 是純本機工具，所有雲端相關文字標示「規劃中」。

| 入口 | 身分來源 | 同步 |
| --- | --- | --- |
| 網站、Studio PWA、TrueLink App（WebView） | 網站既有登入 | host bridge（第 2 階段） |
| LINE LIFF | LINE Login 換成網站登入狀態（同網域） | host bridge（第 3 階段） |
| 瀏覽器擴充、CLI、MCP server | 需要新的授權設計（OAuth 2.0 + PKCE 或裝置授權流程） | 設計完成前只做本機功能 |

## 6. 部署到 TrueLink 網站（第 2 階段）

- 建置：`VITE_TRUELINK_HOST_URL=/studio/host.html VITE_TRUELINK_SIGNUP_URL=<註冊頁> pnpm app:build`，
  把 `apps/web/dist` 放到網站的 `/studio/`。以本 repo 的版本標籤為單位更新。
- 快取：`index.html`、`sw.js` 不快取；`assets/` 內含雜湊的檔案可以長期快取。
- Service worker：Studio 的 service worker 只處理自己的檔案（本次已修正，不會攔截 host 頁面或網站
  其他頁面）；網站自己的 service worker 也不應攔截 `/studio/`。
- host 頁面只回應 `window.parent` 且同網域的訊息，並設定 `frame-ancestors 'self'`。
- Studio 頁面自帶嚴格 CSP；host 頁面需要的後端連線只在 host 頁面的 CSP 開放。

## 7. 推廣管道（推薦組合）

| # | 管道 | 對象 | 在漏斗中的角色 | 共用模組 | 目前狀態 | 優先 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | TrueLink 網頁工具 `/tools/schema/` | 既有會員 | 主要轉換與付費功能 | 文件格式、匯入／匯出；之後改用共用輸出與檢查 | 已上線 | P0 |
| 2 | Schema Studio PWA `/studio/` | 新訪客、中小企業 | 免註冊先體驗 → 註冊 → 雲端草稿 | 全部 | 本 repo 完成，待部署 | P0 |
| 3 | GitHub 開源 repo ＋ GitHub Pages 展示 | 全球開發者、SEO 從業者 | 信任、反向連結、口碑、回饋 | 全部 | repo 已公開；英文 README、貢獻指南、issue 表單、Pages workflow 已就緒，待合併後開啟 Pages | P0 |
| 4 | 官網開源介紹頁 | 搜尋流量 | 說明與導流 | — | 已存在；需更新成 Studio 與雲端草稿的現況 | P0 |
| 5 | TrueLink App（Capacitor 殼） | 行動會員 | 行動入口 | Studio 網頁 | App 殼已存在；需加入口 | P1 |
| 6 | 瀏覽器擴充（Trust Check） | 行銷人員 | 「檢查這頁的 Schema → 在 Studio 修正」 | `truelink-schema-document`；Studio 可直接打包進側邊欄 | 擴充已存在 | P1 |
| 7 | WordPress 外掛 | 台灣中小企業網站 | 發布後自動在頁面輸出 | 公開 Schema（伺服器端輸出、正確跳脫） | 未開始 | P1 |
| 8 | npm 套件 ＋ CDN | 開發者 | 在自己的系統產生、檢查 JSON-LD | `truelink-schema-document` | 套件仍為 `private`，待發布 | P2 |
| 9 | CLI ／ GitHub Action | 工程團隊 | CI 中檢查 JSON-LD，報告連回 TrueLink 說明 | `truelink-schema-document` | 未開始 | P2 |
| 10 | MCP server | 使用 AI 助理的人 | 在 AI 工具裡產生、檢查品牌 Schema（最貼近 AI Trust 理念） | `truelink-schema-document`，之後加帳號授權 | 未開始 | P2 |
| 11 | LINE LIFF 小工具 | 台灣商家 | 在 LINE 裡快速建立品牌資料 | Studio ＋ LINE Login | 未開始 | P2 |
| 12 | Google Tag Manager 範本 | 行銷人員 | 免改程式安裝託管腳本 | 公開 Schema | 未開始 | P3 |
| 13 | Microsoft Store（PWA 封裝） | Windows 使用者 | 桌面安裝 | Studio | 未開始 | P3 |

補充：

- 用 JavaScript 動態插入的 JSON-LD 不一定會被所有爬蟲讀到，所以 WordPress 外掛、伺服器端輸出
  優先於純前端注入；GTM 只作為補充。
- 原生商店只維持**一個** TrueLink App，把 Studio 當成其中一個入口，品牌才不會分散。App 內涉及
  付費方案的連結要遵守商店的數位商品規範。
- 擴充、CLI、MCP 在帳號授權設計完成前只提供本機功能，不代使用者存取帳號資料。

### 7.1 GitHub 曝光與回饋

- **英文優先**：README 以英文為主並附繁中版。Schema／SEO 的國際社群多用英文，
  在 GitHub 搜尋 `schema-org`、`json-ld`、`structured-data` 時才找得到。
- **能馬上試用**：README 第一個連結是 GitHub Pages 線上版，不用安裝。
- **容易回饋**：issue 表單分成問題、功能、模板、翻譯四種，提醒不要貼私人資料。
  App 設定頁也有「回報問題／建議功能或模板／協助翻譯／在 GitHub 按星星」。
- **容易參與**：翻譯審閱是門檻最低的貢獻。每種 Beta 語言都可以開一則 good first issue，邀請母語人士檢查。
- **擁有者需在 GitHub 設定**：
  - 描述、網站與 topics（`schema-org`、`json-ld`、`structured-data`、`seo`、`geo`、`pwa`、`local-first`、`i18n`、`hacktoberfest`）
  - 上傳 social preview（`docs/assets/social-preview.png`）
  - 開啟 Discussions、Private vulnerability reporting 與 Pages（來源選 GitHub Actions）

## 8. 每個入口都要一致的理念與品牌

- **理念**：一致、可驗證的品牌實體資料，讓 AI 與搜尋引擎能確認「你是誰」；TrueLink 協助部署、
  維護並累積可驗證的信任證據。
- **品牌**：官方盾牌、色票與「每個畫面最多一個金色主要按鈕」的規則（見 `apps/web/src/styles/tokens.css`
  與 [TRADEMARKS.md](../TRADEMARKS.md)）。不要用通用盾牌圖示或純文字取代標誌。
- **用語**：不保證排名、複合式結果或 AI 引用；規劃中的功能要標示「規劃中」；本機優先與隱私承諾在
  每個入口的說法一致。
- **外連**：只帶乾淨網址，不附 Schema 內容、個資、權杖或推薦碼。若日後要加推薦計畫，需要另外設計與揭露。
- **回流**：每個入口都有「在 TrueLink 繼續」的下一步（Studio → 註冊／網頁工具；擴充 → Studio；
  CLI 報告 → 說明文件）。

## 9. 分階段交付與驗收

**第 1 階段：本 repo（已完成）**

- 官方 CI 對齊（色票、淺色預設、官方盾牌與字標、金色按鈕規則）。
- `SchemaDocumentRecord` 與網頁工具格式轉換、匯入網頁工具資料。
- `truelink-schema-cloud` 協定、參考 host 與測試；Studio 雲端草稿介面（明確上傳、衝突處理、確認後發布）與測試。
- 一處更新、全部同步：`changed` 即時通知、已連結文件自動跟上雲端、`minCoreVersion` 版本閘門、核心的瀏覽器建置、
  conformance 測資、CI 與版本發行 workflow。
- Studio service worker 只處理自己的檔案。
- 多國語言：English、繁中、简中、日本語、Español、Português (Brasil)、Bahasa Indonesia；英文優先、依瀏覽器語言自動選擇。
  AI 協助翻譯的語言標示 Beta，並邀請母語人士審閱。所有文字都經翻譯目錄，檢查會確保 slot 正確、不出現保證用語。
- GitHub 曝光套件：英文 README（含截圖與線上試用）、繁中 README、CONTRIBUTING（含翻譯流程）、行為準則、
  issue 表單（問題、功能、模板、翻譯）、PR 範本、GitHub Pages 展示 workflow、social preview 圖、App 內回饋與 GitHub 連結。

**第 2 階段：TrueLink SaaS 整合（待實作與部署）**

- host 頁面、草稿後端函式（列出／儲存／刪除，含版本號與冪等鍵）、私有草稿的資料庫規則；host 監聽變更並送出 `changed`。
- 伺服器端發布（單一動作更新公開資料、官方分數與託管腳本）；公開資料任何變更都自動重建衍生輸出。
- 網頁工具改用共用核心的瀏覽器建置；SaaS 的核心自動更新 PR 與 conformance 測試。
- 把 Studio 部署到 `/studio/`；網站 service worker 排除 `/studio/`；App 與網頁工具加入口；更新官網開源介紹頁。
- 驗收：
  - 帳號 A 無法讀取、列出、修改、刪除帳號 B 的草稿；工作區權限撤銷後立即失效。
  - 偽造的擁有者欄位、未知欄位與格式錯誤的內容一律被拒絕；草稿不會出現在任何公開讀取路徑。
  - 重複請求、並行修改、離線後重新連線、配額上限都有明確結果（與參考 host 的測試一致）。
  - 發布失敗時公開資料與託管腳本都維持舊版。
  - 資料庫規則有模擬器測試；在 iOS Safari、Android Chrome、桌面 Chrome／Edge 實機測試。

**第 3 階段：生態系**

- WordPress 外掛、擴充整合、npm 發布、CLI／GitHub Action、MCP server、LINE LIFF。
- 外部客戶端的帳號授權設計（OAuth 2.0 + PKCE／裝置授權），完成安全審查後才開放帳號功能。

## 10. 衡量（隱私優先）

- Studio 本身不追蹤、不載入分析程式。
- 在 TrueLink 端（使用者登入後）衡量：來自 `/studio/` 的註冊、上傳與發布次數、官方分數變化。
- 開發者管道：GitHub stars／forks、npm 下載數、官網開源頁流量。
- 若日後要在 Studio 加入分析，需要另外取得同意並調整 CSP，不在目前範圍。

## 11. 風險與取捨

| 風險 | 處理方式 |
| --- | --- |
| 兩個編輯器並存、資料分岔 | 共用文件格式與轉換；網頁工具逐步改用 `truelink-schema-document` 的瀏覽器建置，邏輯只維護一份 |
| 自動更新帶來非預期變化 | 版本標籤、conformance 測資、SaaS 端 PR 審查後才部署；破壞性變更升 major |
| 本機健檢與官方分數不同 | 介面分開標示「本機建議」與「TrueLink 官方分數」；官方分數只在伺服器計算 |
| 草稿外洩 | 私有儲存、伺服器推導擁有者、未知欄位拒絕、模擬器規則測試 |
| 發布不一致 | 伺服器單一動作發布，依指定版本 |
| 外部客戶端授權 | 設計與審查完成前不開放 |
| 品牌素材被分支沿用 | [TRADEMARKS.md](../TRADEMARKS.md)：程式碼 MIT，品牌素材不在授權範圍 |
