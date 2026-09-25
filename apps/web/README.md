# TrueLink Schema Studio（`apps/web`）

可安裝的本機優先 Schema.org 結構化資料（JSON-LD）工作台，是一個 PWA。
使用者不用註冊就能建立品牌資料、編輯 10 種 Schema 範本，即時看到健檢分數和
「AI 可能如何描述你」的示意預覽，再複製程式碼貼到網站。需要託管部署或 GEO／E-E-A-T
服務時，再從 App 內前往 TrueLink 註冊。

> 本工具不會把資料送到任何伺服器，也沒有追蹤或分析程式。雲端同步與帳號連結目前只是
> **規劃**，介面上都會明確標示。

## 開發

需要 Node.js 22.13 以上與 pnpm 11.19.0（版本鎖定在根目錄的 `package.json`）。

```sh
pnpm install --frozen-lockfile
pnpm dev          # 在根目錄執行，會開啟 http://localhost:5173
pnpm app:build    # 產生 apps/web/dist（含 sw.js 與 CSP）
pnpm app:preview  # 預覽正式建置（可測試安裝與離線）
pnpm check        # 核心庫、schema-document 與 App 的型別檢查、測試與建置
```

## 功能與畫面

| 區塊 | 內容 |
| --- | --- |
| 首頁 | 價值主張、範例 AI 解讀卡、品牌完整度、快速開始、最近編輯、TrueLink 推廣帶 |
| 品牌資料精靈 | 4 個步驟：基本資料、聯絡與地址、官方連結（每個平台一個欄位，填了就亮起）、專業與信任；右側即時顯示 AI 描述與實體卡 |
| Schema 編輯器 | 表單與 JSON-LD 雙模式（不會丟掉未知屬性）、完整度分數環、健檢清單（可直接跳到欄位）、搜尋結果示意、程式碼與安裝步驟、文件狀態 |
| 我的 Schema | 搜尋、依類型篩選、完整度進度條；接近本機上限時提示 |
| 匯入與匯出 | 貼上 JSON-LD 或整段 HTML（以 DOMParser 解析，內容不會執行），先預覽再匯入；合併成 `@graph`；備份與還原 |
| 帳號與同步 | 註冊導流頁：目前狀態、TrueLink 權益、本機與帳號比較表、隱私承諾。部署在 TrueLink 網站並設定 host 時，另有「TrueLink 雲端草稿」：逐份上傳、已連結文件自動跟上雲端、衝突三選一、確認後發布到 TrueLink |
| 設定 | 淺色（預設）／深色／跟隨系統、7 種介面語言（Beta 標示與協助翻譯連結）、安裝 App、本機儲存用量、清除資料、意見回饋與 GitHub 連結 |

範本包括：組織／品牌、地方商家、人物、網站、服務、產品、文章、FAQ、活動、麵包屑，
以及保留任意類型的「其他類型」。

### 註冊導流設計（讓使用者想註冊）

1. **先給價值再邀請**：所有編輯功能都不必註冊。
2. **品牌資料精靈**：填一次，所有 Schema 自動帶入。完整度分數和「還缺少這些資訊」
   的提示會讓使用者想把資料補齊。
3. **看得見的成果**：AI 描述卡把結構化資料組成一段自然語言（會標示為示意）。
4. **在對的時機提示**：第 1 次和之後每第 5 次複製或下載程式碼時，才出現一張可關閉的
   TrueLink 提示卡；關閉後 3 天內不再出現。另外在完成品牌精靈、程式碼面板、文件狀態
   和接近本機上限時放置情境化 CTA。
5. **誠實**：規劃中的功能都標「規劃中」。前往 TrueLink 時網址不附帶任何資料，
   也不加推薦碼。

## 多國語言

介面支援 English、繁體中文、简体中文、日本語、Español、Português (Brasil)、Bahasa Indonesia，
預設依瀏覽器語言選擇，找不到支援的語言時使用英文。由 TrueLink 提供的版本（以 `VITE_TRUELINK_HOST_URL` 建置）
改由 TrueLink 的語言設定（`window.TLLocale`）決定：先用會員在 TrueLink 選的語言，再用 TrueLink 的建議。
TrueLink 全站只保留一個瀏覽器語言偵測，所以這個版本的建置不含 Studio 自己的偵測。

- **原文**：英文與繁中，打包在主程式裡。
- **其他語言**：第一次使用時才下載，service worker 會預先快取，離線也能切換。
  已儲存的語言會在第一次畫面出現前載入，不會先閃過英文。
- **介面文字**：`src/i18n/locales/<locale>.json`，以訊息 id 為 key，`en.json` 是原文。
  模板、健檢與描述文字來自核心套件的 `locales/`。
- **Beta**：AI 協助翻譯、尚未經母語人士審閱的語言顯示 Beta 標示，並附上「協助翻譯」連結。
- **檢查**：`pnpm --filter truelink-schema-studio i18n:check` 檢查 slot、承諾用語與多餘的 key；
  `node scripts/i18n.mjs --todo ja` 列出還沒翻譯的訊息。

## 設定 TrueLink 連結與品牌素材

在建置時以環境變數設定，只接受 HTTPS：

| 變數 | 用途 | 預設值 |
| --- | --- | --- |
| `VITE_TRUELINK_SIGNUP_URL` | 「註冊 TrueLink 帳號」按鈕（繁中） | `https://truelink-group.com/` |
| `VITE_TRUELINK_SIGNUP_URL_EN` | 英文版註冊頁 | `https://truelink-group.com/en/` |
| `VITE_TRUELINK_APP_URL` | 「開啟 TrueLink 網頁工具」 | 官網首頁 |
| `VITE_TRUELINK_HOST_URL` | TrueLink host 頁面的**同網域路徑**（例如 `/studio/host.html`），設定後啟用雲端草稿，第一次開啟的語言改由 TrueLink 的語言設定決定 | 未設定＝純本機模式 |

範例：`VITE_TRUELINK_SIGNUP_URL=https://truelink-group.com/<註冊頁> pnpm app:build`

- 目前的註冊網址預設為官網首頁，**上線前請改成實際的註冊頁**。如果註冊是免費的，
  可以把 `src/i18n/messages.ts` 裡的 `account.cta.register` 改成「免費註冊」。
### 品牌規範（對齊 TrueLink 官方 CI）

- **色票**：`src/styles/tokens.css` 的基礎色階照抄官方設計系統 `tl-tokens.css`
  （品牌海軍藍 `#1B4C92`、綠 `#2EA572`、金 `#E0B84C`，UI 金 `#D4AF37`）。元件只使用語意層
  變數（`--primary`、`--accent`…）。官方色票更新時，請同步這個檔案。
- **主題**：預設淺色，不跟隨系統深色（與官網 `tl-theme.js` 相同）；深色以
  `<html data-tl-theme="dark">` 套用。和 TrueLink 網站部署在同一個網域時，首次開啟會沿用
  網站的 `tl_theme` 選擇（只讀取，不會寫回）。
- **按鈕**：主要按鈕是海軍藍；金色只用在每個畫面**唯一**的主要行動（例如首頁的「從品牌
  資料開始」、帳號頁的「註冊 TrueLink 帳號」）。控制項圓角 6px、卡片 12px。
- **強調色用法**：只用 3–4px 左邊框或淡色圖示底，不做整張卡片染色或漸層。
- **標誌**：導覽列使用官方盾牌加「True**Link**」字標（與官網導覽列同一種組法）；深色背景
  改用官方單色母檔 `shield-mono.svg` 做成的反白版。不要用通用盾牌圖示或純文字取代標誌。
- **素材來源**：`src/assets/brand/` 的盾牌與 `public/icons/`、`public/favicon.ico` 都從
  TrueLink 品牌素材庫原封不動複製。`scripts/render-icons.mjs` 只把 512px 圖示縮成 192px
  （需要本機的 Playwright 與 Chromium，說明寫在檔案開頭）。
- **商標**：這些素材**不在 MIT 授權範圍內**，詳見根目錄的 [TRADEMARKS.md](../../TRADEMARKS.md)。
  發布非 TrueLink 營運的分支時，請換成自己的名稱與圖示。

## TrueLink 雲端草稿（host bridge）

- 只有在 TrueLink 網站同網域部署、並設定 `VITE_TRUELINK_HOST_URL` 時才會出現。Studio 以隱藏 iframe
  連到 host 頁面，透過 [`truelink-schema-cloud`](../../packages/cloud-client/README.md) 協定交換
  `SchemaDocumentRecord`；Studio 不載入 Firebase、不持有權杖，CSP 仍是 `connect-src 'self'`。
- 上傳一律逐份手動；已連結的文件在這台裝置沒有修改時，會自動套用 TrueLink 上的新版本（例如在
  網頁工具或其他裝置改過）；兩邊都有修改時讓使用者選擇，覆蓋前都會確認。
- 發布只接受已同步的組織、地方商家或人物（可加一份常見問答），並固定在使用者看過的版本。
- TrueLink 升級共用核心後，舊版分頁會被要求重新整理才能同步。
- 同步紀錄存在 `truelink-schema-studio:v1:sync`（每份文件最後確認的雲端版本號與內容雜湊）。

## 本機儲存與資料安全

- 文件、品牌資料和設定存在 `localStorage`（`truelink-schema-studio:v1:*`）。
  上限：20 份文件、每份 100 KiB、總共 3 MiB。超過上限時會**拒絕寫入並保留編輯中的內容**，
  同時提示使用者下載備份，不會自動刪除任何資料。
- 讀取時會嚴格驗證資料：文件外層用核心庫的 `validateSchema`（未知欄位直接拒絕），
  JSON-LD 內容用 `checkJsonValue` 檢查深度、節點數、大小和原型相關鍵名。無法讀取的
  資料會另存到 `:corrupt` 鍵，不會被刪掉。
- 正式建置會加入 CSP：`default-src 'self'`，沒有任何第三方來源、`connect-src 'self'`、
  `object-src 'none'`、`base-uri 'none'`。`frame-ancestors` 無法用 meta 設定，請在
  託管端的回應標頭設定。
- 複製或下載的 `<script type="application/ld+json">` 會把 `<`、`>`、`&` 跳脫成
  `<` 之類的形式，字串內容無法提前關閉 script 標籤。
- 預覽畫面一律以文字呈現，不載入使用者或匯入資料中的外部圖片和網址。

## 做成 App：目前進度與下一步

| 平台 | 狀態 |
| --- | --- |
| 桌面（Chrome／Edge） | ✅ PWA 可安裝（manifest、捷徑、離線 service worker、更新提示） |
| Android（Chrome） | ✅ 可安裝，支援 maskable 圖示 |
| iPhone／iPad（Safari） | ✅ 可「加入主畫面」；設定頁有操作說明 |
| App Store／Google Play | ⏳ 未封裝。建議以 Capacitor 包裝同一份 `dist`，需要開發者帳號與實機測試 |
| 桌面安裝檔 | ⏳ 未封裝。可評估 Tauri；需要簽章與實機測試 |
| 瀏覽器擴充 | ⏳ 可以沿用 `truelink-schema-document` 與本 App 的工作頁；整體規劃見 [多平台策略](../../docs/PLATFORM_STRATEGY.zh-TW.md) |

部署：`dist/` 是純靜態檔案，採用 hash 路由與相對路徑，可以放在任何子路徑
（例如 Firebase Hosting、GitHub Pages、Netlify），不需要改寫規則。更新時新版 service
worker 會先等待，由使用者點「重新整理」才切換，不會中斷正在編輯的內容。Service worker 只
處理 Studio 自己的檔案，不會攔截同網域的其他頁面（例如 TrueLink host 頁面）。多平台與部署規劃見
[多平台策略](../../docs/PLATFORM_STRATEGY.zh-TW.md)。
