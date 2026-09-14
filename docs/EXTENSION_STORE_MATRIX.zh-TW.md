# 擴充商店發行矩陣與驗收

核對日期：2026-09-15。這是計畫，**沒有實際送審編號或已上架連結**。
商店帳戶是否已存在尚未查核；不要因舊文件寫「需創辦人」就重建帳號。

## 先後順序

| 平台 | 建議路徑 | 必須取得的證據 |
|---|---|---|
| Chrome | MV3，Chrome Web Store 發行 | 發行帳戶、2FA、包件、隱私、送審結果、乾淨安裝 |
| Edge | 共用 Chromium 原始碼，獨立測試與 Partner Center 送審 | Edge 專屬清單、包件、審核與正式 listing |
| Firefox | 同核心、Firefox manifest/API 差異處理 | AMO 簽章、資料傳輸聲明、重現建置來源及實機測試 |
| Safari（Mac／iPhone／iPad） | App Store Connect 封裝或 Xcode 路徑 | Developer 帳戶、相容性、TestFlight／裝置測試與 App Store 審核 |

建議先完成 Chrome／Edge／Firefox 的本機版核心，再完成帳號／私人同步，
以完整整合版送審。Safari 並行做相容性盤點，不保證相同 ZIP 不需調整。
使用者若要先發行本機版，須縮減商店宣稱，不把尚未完成的雲端當已提供。

官方規則核對：

- Chrome 要求功能目的清楚、資料處理與隱私揭露一致，MV3 不可載入外部
  executable code；發行者須啟用 2FA。只把使用者送到另一網頁、不提供本機
  實質功能，不是合適的上架成品。
  [Chrome 政策](https://developer.chrome.com/docs/webstore/program-policies/policies)
- Edge 透過 Partner Center 上傳與送審，通過後才成為商店可取得產品。
  [Edge 發行流程](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)
- Firefox 已有內建資料傳輸同意機制。沿用 hostname 查詢或增加雲端同步時，
  不能填「none」。最低版本、資料類別與同意流程要對實際封裝驗證。
  [Firefox 資料同意](https://extensionworkshop.com/documentation/develop/firefox-builtin-data-consent/)
  · [送審／原始碼](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/)
- **修訂舊認知**：Apple 現在支援透過瀏覽器在 App Store Connect 封裝 Safari
  Web Extension，不必有 Mac／Xcode 才能封裝；仍需 Apple Developer Program，
  且封裝不等於通過裝置測試或商店審核。
  [Apple 封裝與發行](https://developer.apple.com/documentation/safariservices/packaging-and-distributing-safari-web-extensions-with-app-store-connect)

不要宣稱「所有手機瀏覽器皆可安裝」：逐一列實際支援的瀏覽器、平台與版本，
例如 Safari iOS 與 Firefox Android 必須分開測試，不能由桌面通過推論。

## 權限預算（建議，尚非有效 manifest）

| 權限／能力 | 用途 | 邊界 |
|---|---|---|
| `activeTab` | 使用者要求時檢查目前分頁 | 不掃歷史、不監控所有分頁 |
| `scripting` | 執行打包在外掛內的本機收集器 | 不讀表單值、不注入下載的程式 |
| `storage` | 本機草稿、設定 | 草稿不使用瀏覽器自動同步；需限制容量 |
| 精確 optional host | 明確啟用線上查證或雲端服務 | 不預設 `<all_urls>`；只申請实际必要來源 |
| side panel | 可選的桌面便利入口 | 各平台可替代，完整編輯頁不依賴它 |

不預設申請 cookies、history、webRequest、debugger、unlimitedStorage、
檔案系統或 nativeMessaging。授權或 API 不支援時明示原因，不能靜默換廣權限。

首版未啟用線上查證時不帶其 host permission。日後 TrueLink 雲端只允許
經確認的固定 HTTPS origin：`https://app.truelink-group.com`，API 路由和
版本待 SaaS 接口審查，不提供任意伺服器 URL 輸入。變更 origin 必須發行
新設定與更新隱私揭露，不能由不可信遠端設定悄悄更換。
Chrome／Edge、Firefox、Safari 各測試申請／取消／撤回 host 權限；遇到
無相同 optional 機制的平台，停用雲端並保留本機功能，不擴大權限。

本機處理資料也要揭露：頁面 metadata、標題、連結及 JSON-LD；不包括
表單輸入值。上限與 quota-exceeded 保留原稿行為見整合藍圖，實作後用
超量合成案例、重啟與卸載警告驗收，不能只測成功路徑。

## 開源與發布前清单

- [ ] 原始碼來源清單：路徑／來源 commit／作者權利／授權與第三方 notice。
- [ ] 僅使用 synthetic 測試資料；無帳戶／客戶 Schema、金鑰、token、歷史操作資料。
- [ ] MIT 程式與品牌商標、名單資料使用權分離；不打包既有 SaaS 後端。
- [ ] 固定 lockfile、乾淨環境重現建置、local tests、包件 SHA256。
- [ ] ZIP 採 runtime allowlist，不含 .git、node_modules、.env、內部文件或測試素材。
- [ ] Chrome／Edge／Firefox 實際安裝、重啟、離線、本機留存、匯出與取消測試。
- [ ] 新舊 extension ID 與資料遷移規劃；未封裝 ID 不當作正式商店 ID。
- [ ] 不自動卸載舊版，不用不同商店產品互相覆蓋 local storage。
- [ ] 真帳號同步：登入過期、換帳號、撤權、多裝置衝突、本機與公開資料隔離。
- [ ] 隱私政策涵蓋本機處理、hostname 查詢、回報文字、選用雲端、刪除與留存。
- [ ] 若付費，清楚描述免費核心與需帳號／付費範圍；尚未定價不先承諾。
- [ ] 各商店上傳真實畫面、reviewer 說明與必要測試帳號；不提交管理員帳號。
- [ ] 確認申請人／組織及商店條款；需帳戶本人操作的簽署或付款不代為猜填。
- [ ] 保存 submission ID／version／package hash／狀態／listing／核對時間。
- [ ] 每家商店正式 listing 的乾淨安裝與端到端功能完成後，才在網站標「可安裝」。

## 不可偽造的發行階段

`設計 → 原始碼完成 → 可重現封裝 → 實機驗收 → 已送審 → 已核准 → 正式可安裝`

任一步缺收據則列未驗證。GitHub PR、單元測試或商店上傳成功不能代替後面步驟。
本 repo 目前只有工具骨架和此設計，尚沒有完整擴充功能 runtime／商店 ZIP。
