# 工作紀錄與交接（2026-09-24）

本文件記錄 Schema Studio、共用核心與 GitHub 曝光這一輪的成果、決策、待辦與驗證方式，讓下一個
session 或協作者不必重讀對話就能接手。

架構說明見 [ARCHITECTURE.md](ARCHITECTURE.md)（英文），多平台策略見
[PLATFORM_STRATEGY.zh-TW.md](PLATFORM_STRATEGY.zh-TW.md)，驗證紀錄見 [VERIFICATION.md](VERIFICATION.md)。

## 1. 目前狀態

| 項目 | 狀態 |
| --- | --- |
| `main` | 已合併 [PR #2](https://github.com/Johnny050033/truelink-schema-web-tools/pull/2)（`1c99b01`），CI 通過 |
| 共用核心 `truelink-schema-document` | 0.3.0（`CORE_VERSION` 與 package 版本由測試綁定） |
| GitHub Pages | 擁有者已開啟（Source：GitHub Actions）。本文件所在 PR 合併時的 push 會觸發第一次部署 |
| 線上試用版 | https://johnny050033.github.io/truelink-schema-web-tools/ |
| 翻譯審閱 issue | [#3 日本語](https://github.com/Johnny050033/truelink-schema-web-tools/issues/3)、[#4 Español](https://github.com/Johnny050033/truelink-schema-web-tools/issues/4)、[#5 Português](https://github.com/Johnny050033/truelink-schema-web-tools/issues/5)、[#6 Bahasa Indonesia](https://github.com/Johnny050033/truelink-schema-web-tools/issues/6)（標籤：`translation`、`good first issue`、`help wanted`） |
| 檢查 | `pnpm check` 全部通過。核心庫 67、共用核心 112、雲端協定 19、Studio 51 項測試；兩個套件的 bundle smoke 6/6、3/3 |

## 2. 已完成的工作（PR #2 的 commits）

| Commit | 內容 |
| --- | --- |
| `33821a2` | Schema Studio PWA 與 Schema.org 文件套件 |
| `926061d` | 對齊 TrueLink 官方 CI、共用文件格式 `SchemaDocumentRecord`、雲端協定 `truelink-schema-cloud`、跨工具同步 |
| `423347f` | 給 TrueLink 其他工具用的 CommonJS 與網頁 bundle |
| `ffc5a78` | 7 種語言的架構（核心 0.3.0、翻譯目錄、Studio 語言選單），以及 GitHub 曝光套件 |
| `0ed4cef`、`7b30478`、`7c150ec` | 簡中、日本語、Español、Português (Brasil)、Bahasa Indonesia 翻譯 |
| `678ced9` | 依翻譯審稿與手機版面 QA 修正（見第 4 節） |
| `48240a6` | Pages 尚未開啟時跳過部署並留下提示，避免 `main` 出現紅叉 |

## 3. 重要決策與原因

- **英文優先**：Schema／SEO 的國際專業社群多用英文。Studio 依瀏覽器語言自動選擇，找不到支援的語言時用英文。
  `index.html`、manifest 與 README 都以英文為主。
- **7 種語言**：English、繁中為原文；簡中、日本語、Español、Português (Brasil)、Bahasa Indonesia 由 AI 協助翻譯，
  在 App 中標示 **Beta**。母語人士審閱完一種語言後，把 `LOCALE_INFO` 的 `status` 改成 `reviewed`，
  Beta 標示就會消失。
- **翻譯目錄的 key**：核心文字用英文原文當 key，簡中例外，用繁中原文當 key。這樣簡中能保留中文語序，
  也能區分英文相同、中文不同的詞。Studio 介面文字用訊息 id 當 key。
- **句子模板**：有數值的句子用 `{slot}` 模板，各語言可以自己調整語序。`{aLabel}`、`{aJob}` 內含英文冠詞，
  只給英文使用。
- **複數**：Studio 訊息可以加 `key.one` 等複數形式，用 `Intl.PluralRules` 選擇。沒有加時，使用與數量無關的寫法。
- **台灣名稱與中國大陸市場**：簡中的國家清單維持「台湾（TW）」。擁有者 2026-09-24 決定先不經營中國大陸
  （當地不太使用 Google），所以不做任何配合大陸的調整。簡中介面保留給新加坡、馬來西亞與海外華人使用。
- **不做保證**：所有語言都不承諾排名、複合式結果或 AI 引用，翻譯檢查會擋下保證用語。
- **本機優先與隱私**：不做追蹤；連結不帶 Schema 資料、個資、token 或推薦碼；存檔不等於發布。
- **預設幣別**：第一次填價格時，依文件的國家、再依介面語言自動帶入幣別，不再固定 TWD。
- **品牌規範**：只用官方盾牌，每個畫面最多一顆金色主要按鈕。TrueLink 名稱與圖示不在 MIT 授權內，
  見 [TRADEMARKS.md](../TRADEMARKS.md)。

## 4. 翻譯審稿的重點（供母語審閱者參考）

五位翻譯者都用實際產生的句子檢查過，每種組合都讀得通。

- **簡中**：大陸用語與全形標點；“” 引號；使用「你」；範例改為 +86、CNY、上海地址。
  「統一編號」改為「税号」，「職稱」改為「职位」。
- **日本語**：句子用です／ます，標籤用簡潔名詞。句子片段的語序有調整，例如商品句把供應狀態放在價格前面。
  範例改為澀谷地址、+81、JPY。
- **Español**：中性國際西班牙文，使用 tú。為了避免陰陽性一致的問題，句型改成「figura como {label}」。
  使用 Google 的西文官方名稱，範例用西班牙。
- **Português (Brasil)**：使用 você，句型避開陰陽性（例如「é do tipo {label}」）。
  採用 Google 的巴葡名稱：「Central da Pesquisa Google」「Navegação estrutural」。
- **Bahasa Indonesia**：使用 Anda，採用 Google 用語「hasil kaya」。範例改為 +62、雅加達、印尼盾。
- **審稿後已修正的來源問題**：
  - 繁中文章句「由X撰寫、文章」與服務句缺動詞。
  - 通用模板把自己寫成「其他類型」類型的項目。
  - 原始 Schema.org 類型名與縮寫被轉成小寫。
  - 國家與幣別清單缺印尼、巴西、墨西哥等（已補 16 國、14 幣別）。
  - 預設幣別固定 TWD；英文「1 documents」沒有單數。
  - 拉丁字母地址在中日文介面被黏在一起；英文拼字與中文文章連結沒有標示語言。

## 5. 擁有者待辦（GitHub 設定，需在網頁上操作）

這個 session 在雲端執行，連不到擁有者的電腦與已登入的 Chrome。GitHub 連線也沒有修改 repo 設定
與啟動 workflow 的權限。以下需要擁有者操作，或改在擁有者電腦上的 Claude session（Claude Desktop 或
`claude remote-control`）用瀏覽器完成：

1. **About**（repo 首頁右側 ⚙️）：
   - Description：`Free, open-source Schema.org JSON-LD workspace for brands: guided forms, instant checks and a preview of what search engines and AI can read. 7 languages, local-first PWA by TrueLink.`
   - Website：`https://johnny050033.github.io/truelink-schema-web-tools/`
   - Topics：`schema-org json-ld structured-data seo geo pwa local-first i18n react typescript hacktoberfest`
2. **Social preview**：Settings → General → Social preview，上傳 `docs/assets/social-preview.png`。
3. **Private vulnerability reporting**：Settings → Security → Enable。
4. **（可選）** Discussions；建立 `template` 標籤，給「新模板」issue 表單使用。

## 6. 接下來的工作

| 優先 | 項目 | 說明 |
| --- | --- | --- |
| P0 | TrueLink SaaS 整合 | host 頁面 `/studio/host.html`、草稿後端函式、私有草稿的資料庫規則、把 Studio 部署到 `/studio/`、網頁工具改用共用核心 bundle。這些在**私有** SaaS repo 進行。本 session 修改 SaaS 檔案的操作被權限擋下，需要擁有者開放後再做。審查時發現的安全性修正與完整計畫，已另外以私人檔案交給擁有者，**刻意不放在這個公開 repo** |
| P0 | 確認 Pages 部署 | 合併後在 Actions → Pages 確認 `deploy` 成功，打開線上試用版 |
| P1 | 母語審閱 | 追蹤 #3–#6；審閱完成的語言改為 `reviewed` |
| P1 | SaaS 的圖示 | TL 圖示集缺 9 個（plus、x、check、chevrons、arrows、more、menu、cloud），部署 `/studio/` 前要補齊 |
| P1 | CDN 快取時間 | 目前 24 小時並依 Referer 區分；建議 1 小時，待擁有者決定（成本考量） |
| P2 | 發布到 npm | 套件目前是 `private: true`；決定後再發布 `truelink-schema-document` 與 `truelink-schema-cloud` |
| P2 | 更多瀏覽器 | Safari、Firefox、實機與螢幕報讀器尚未驗證 |

## 7. 如何驗證

```sh
pnpm install --frozen-lockfile
pnpm check                                          # 型別、翻譯、測試、建置、bundle smoke
node packages/schema-document/scripts/i18n.mjs --todo ja   # 列出未翻譯的核心文字
node apps/web/scripts/i18n.mjs --todo ja                   # 列出未翻譯的介面訊息
```

多語版面 QA（7 種語言 × 桌機 1440px、手機 390px × 8 個畫面，檢查溢出、被截斷的按鈕、未填入的 slot 與 console 錯誤）：

```sh
pnpm --filter truelink-schema-studio build
pnpm --filter truelink-schema-studio preview &      # http://localhost:4173/
node apps/web/scripts/qa-locales.mjs                # 需要 Playwright；截圖存在 OUT（預設為暫存資料夾）
```

## 8. 擁有者在本輪的指示（摘要）

- 把工具做成有 TrueLink 風格 UI／UX 的 App，並吸引使用者註冊。
- App 與 `/tools/schema/` 共用模組與資料庫；網站、App、網頁工具、公開 git repo 等多平台都要宣傳 TrueLink 的工具與理念。
- `/tools/schema/` 更新時，所有連動的工具要同步更新。
- 同意在 SaaS repo 開分支修安全性問題並建草稿後端、host bridge、`/studio/`，Studio 網址為 `app.truelink-group.com/studio/`。
- 要 GitHub 曝光套件與 Pages 展示版，並支援多國語言，英文優先。
- 中國大陸市場先放棄；授權操作 GitHub；在額度用完前把紀錄寫回 repo 與 PR。
