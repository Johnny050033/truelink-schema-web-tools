# 產品願景：社群可用的 Schema 工具與可選私人雲端

狀態：方向文件。此 repo 現在是 TypeScript 工具骨架，**不是**完整的
Schema.org 編輯器、瀏覽器擴充功能、桌面安裝程式、Google 帳號整合或雲端服務。
任何後續功能都必須以獨立原始碼、測試與驗收證據交付，不能由本文件推論已可用。

## 我們想解決的問題

讓個人、團隊與開源社群可以在本機建立、檢查、保存與匯出自己的結構化資料，
不必先加入帳號，也不應被迫傳送文件到雲端。MIT 授權允許採用、fork 和自架；
它不要求使用者放 attribution link、不強迫 telemetry，也不等於授予 TrueLink
商標、第三方資料集或雲端容量的使用權。

社群可透過 GitHub [Issues](https://github.com/Johnny050033/truelink-schema-web-tools/issues)
提出需求，並依 [CONTRIBUTING.md](../CONTRIBUTING.md) 提交合成測試與 PR。初始
整合規劃在 [PR #1](https://github.com/Johnny050033/truelink-schema-web-tools/pull/1)，
但 PR 不代表版本發行、商店上架或雲端服務已完成。

## 三個清楚分離的選擇

1. **本機工具（預設）**：匯入、編輯、檢查與匯出 JSON-LD。資料留在使用者選擇的
   本機位置或未來 extension 的 `storage.local`；應有大小限制與匯出／刪除提示。
2. **可選私人雲端**：使用者主動連結 TrueLink 帳號後，才可把選定草稿同步到
   專用、可撤權的 private-draft API。Google-linked 登入若提供，只是經審核的
   帳號連結方式，不取得 Drive、Gmail 或其他不必要 scope。
3. **明確公開快照**：公開、撤回、認證或發行是另一個二次確認動作。按「儲存」
   絕不能自動建立公開 URL、寫入 CDN 資產、修改正式帳戶資料或改變認證狀態。

私人 API 的 server 端要從已驗證的 session/token 推導 owner/workspace，做 scope、
撤權、revision/ETag、冪等重試、配額和 A/B 帳號隔離。client 不能自稱 owner；
不得把 token 放 URL，也不得在 repo、extension 或 installer 放 service key、OAuth
client secret、App Check debug token 或長期憑證。詳細安全契約見
[CLOUD_SYNC_ROADMAP.md](CLOUD_SYNC_ROADMAP.md)。

## 發布與官方入口

官方、可多語系的說明與下載入口建議為
`https://truelink-group.com/downloads/schema-tools/`（**PLANNED**）。該頁屬 TrueLink 主站
工作範圍；本 repo 不會自行發布、部署或宣稱它已上線。未來 landing page 應清楚
分列本機免費核心、可選帳號／雲端、資料保留與刪除、各平台實際支援範圍，以及
正式下載／商店連結的驗證時間。

未來 Chrome、Edge、Firefox、Safari 的 extension 會是獨立交付物；必須完成
runtime、可重現封裝、實機驗收、隱私揭露和各商店審核，才可稱「可安裝」。目前
沒有 extension ZIP、store listing、下載 badge 或 Trust/Schema certification。

## 不做的事

- 不把平面 `validateSchema` 假稱為完整 Schema.org、Google rich-result 或安全認證。
- 不把頁面品質、JSON-LD 可解析、未查到風險訊號或未認證，說成安全、官方或可被
  搜尋引擎／AI 保證收錄。
- 不把既有 TrueLink Trust Check、私有 SaaS 資料、第三方 blocklist、客服／帳戶資料
  或品牌素材自動搬入 MIT repo。
- 不用任意第三方 host 當同步 endpoint，也不以背景傳輸、強制登入或廣泛瀏覽器權限
  交換便利性。
