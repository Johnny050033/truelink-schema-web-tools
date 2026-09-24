# TrueLink 認證 Schema API

[English](VERIFIED_SCHEMA_API.md) | 繁體中文

**完整的結構化資料，只在你的真官網提供，而且任何人都能查證。**

結構化資料（Schema.org JSON-LD）告訴搜尋引擎與 AI 助理「你是誰」，但任何人都能複製。
釣魚網站可以把你的公司名稱、Logo、電話與官方社群貼到自己的頁面，爬蟲無從分辨哪份才是真的。

TrueLink 認證 Schema 結合三件事解決這個問題：

1. **身分已認證**：以企業、專家或個人身分在 TrueLink 通過 KYC。
2. **綁定網域才提供**：TrueLink 從 API 提供你的 Schema，但只提供給你認證過的官方網域。
   其他網站就算複製了程式碼也拿不到資料，你還會收到警示。
3. **公開可查證**：任何人，包括訪客、爬蟲、AI 助理與 TrueLink 瀏覽器擴充，都能向 TrueLink 查詢某個網域是不是認證過的官方網站。

> **[免費註冊 TrueLink →](https://truelink-group.com/)** ·
> **[開始 KYC →](https://app.truelink-group.com/kyc/)**
>
> Schema Studio（本 repo）永遠免費、免註冊可用；認證 Schema 是 TrueLink 平台的服務。

## 運作流程

1. 品牌在 TrueLink 完成 KYC（企業／專家／個人），身分被記錄為已認證。
2. 綁定官方網域，子網域會一併涵蓋。
3. 在官網加入一行 TrueLink 程式碼（或由伺服器用 API 金鑰取得）。
4. 爬蟲讀取官網時，一併讀到這行程式碼，向 TrueLink 取得 Schema；請求會帶著網頁的來源網域。
5. TrueLink 在資料庫比對來源網域是否在認證網域清單中：
   - **是**：回傳完整、最新的 JSON-LD，爬蟲讀到的是經過認證的真實資料。
   - **否**（例如被複製到釣魚網站）：不提供任何資料，記錄這次嘗試並通知品牌。
6. （選用）爬蟲、AI 或訪客也可以用公開端點確認哪個才是真官網：`cert-status` 查單一網域，`verified-entities` 是認證實體清單。

## 兩種提供方式

| | 託管 Schema 腳本 | 認證 Schema API（金鑰） |
| --- | --- | --- |
| 設定 | 在 `<head>` 加一行 `<script>` | 由伺服器取得 Schema 並直接輸出在 HTML |
| 誰讀得到 | 會執行 JavaScript 的爬蟲（例如 Google） | 所有爬蟲，包含不執行 JavaScript 的爬蟲 |
| 網域綁定 | 有，只提供給認證網域 | 以 API 金鑰驗證你的伺服器；來自瀏覽器的請求另外比對認證網域 |
| 條件 | 已在 TrueLink 發布 Schema | KYC 通過**且**會員資格有效；任一失效立即停止提供 |
| 更新 | 在 TrueLink 發布，網站不必改程式 | 同左，下次取得時生效 |

### 託管 Schema 腳本

發布後，TrueLink 網頁工具與 Schema Studio 會顯示你的專屬程式碼（`YOUR_ACCOUNT_ID` 是你的帳號 ID）：

```html
<script src="https://app.truelink-group.com/schema_apis/YOUR_ACCOUNT_ID.js" defer></script>
```

這段腳本會把你的 JSON-LD 加到網頁中。來自認證清單以外網域的請求會被拒絕。

### 伺服器端金鑰 API

想讓最多爬蟲讀到，請由伺服器取得 Schema 並直接輸出在 HTML 裡，不執行 JavaScript 的爬蟲也讀得到。
回應是一段現成的 `<script type="application/ld+json">`（主要實體加上 FAQ），其中的 `<`、`>`、`&` 都已跳脫處理。

```sh
curl -H "X-TrueLink-Api-Key: $TRUELINK_API_KEY" "<TrueLink 後台顯示的端點網址>"
```

- 金鑰格式為 `tl_` 加 48 個十六進位字元。
- TrueLink 只保存雜湊值，金鑰只在建立或更換時顯示一次。
- 金鑰要放在 `X-TrueLink-Api-Key` 標頭；把金鑰放在網址的請求會被拒絕。
- 金鑰請存放在伺服器的機密設定中，絕不放進網頁程式碼。
- 回應不快取（`no-store`），更換或撤銷金鑰會立即生效。

## 公開查證端點（給爬蟲、AI 助理與開發者）

| 端點 | 內容 |
| --- | --- |
| `GET https://app.truelink-group.com/api/public/cert-status?domain=example.com` | 該網域是否屬於 TrueLink 認證實體，以及認證等級與日期 |
| `GET https://app.truelink-group.com/api/public/verified-entities.jsonld` | 目前有效的認證實體（Schema.org `ItemList`）。每筆由 TrueLink 以第三方查核方身分發出；撤銷後即移除 |

共用核心（[`truelink-schema-document`](../packages/schema-document/README.md)）會產生這些網址，並套用與平台相同的網域規則：

```ts
import { certStatusUrl, hostedSchemaEmbed, hostedSchemaScriptUrl, isAllowedHost, verifiedEntitiesUrl } from 'truelink-schema-document';

isAllowedHost('https://shop.example.com/page', ['example.com']);   // true：子網域也算
isAllowedHost('https://example.com.evil.net/', ['example.com']);   // false：仿冒網域一律不符合
certStatusUrl('https://www.example.com/');                          // …/api/public/cert-status?domain=example.com
verifiedEntitiesUrl();                                              // …/api/public/verified-entities.jsonld
hostedSchemaEmbed(hostedSchemaScriptUrl('YOUR_ACCOUNT_ID')!);       // <script src="…/schema_apis/YOUR_ACCOUNT_ID.js" defer></script>
```

平台、Schema Studio 與其他工具用同一份程式判斷網域，一處更新、全部一致。

**網域規則**：

- 網域本身與所有子網域都算；開頭的 `www.` 不影響比對。
- 比對前會移除連接埠、帳密、路徑與結尾的點。
- 國際化網域以 punycode 比對。
- 不是可註冊網域名稱的輸入一律不符合。
- 每個品牌最多綁定 12 個網域。

## Schema Studio 裡的樣子

Studio 由 TrueLink 提供且你已登入時，「帳號與同步 → 認證 Schema API」會顯示：

- KYC 與會員狀態
- 認證網域；品牌網址不在清單時會提醒
- 公開查證頁
- 嵌入程式碼
- API 金鑰的建立、更換與撤銷（每把金鑰只顯示一次）

按「開啟 KYC 頁面」會前往 TrueLink 的 KYC 頁。**身分文件在那裡上傳，絕不經過 Studio。**
KYC 審核有結果時，TrueLink 會通知 Studio 立即更新狀態。

在其他地方（包括公開展示版），Studio 會說明這項服務，並提供前往 TrueLink 的連結。
背後的橋接方法（`verification.get`、`verification.startUrl`、`apiKey.issue`、`apiKey.revoke` 與 `verification` 變更通知）
的規格見 [`packages/cloud-client`](../packages/cloud-client/README.md)。

## 能做到與做不到的事

- **能幫助機器確認真偽**：被複製到其他網站的 Schema 不會由 TrueLink 提供，任何人都能查證哪些網域是認證過的。
- **無法阻止有人手動把你的資料打在假網站上**：但那個頁面不會有你的認證 Schema，仿冒網域也可以透過 TrueLink 擴充回報。
- **JavaScript 的差別**：託管腳本需要會執行 JavaScript 的爬蟲；想讓所有爬蟲都讀到資料，請用伺服器端金鑰 API。
- **不做保證**：認證讓你的身分更容易被確認，但不保證排名、複合式結果或 AI 引用。

## 開始認證

1. [免費註冊 TrueLink](https://truelink-group.com/)。
2. [完成 KYC](https://app.truelink-group.com/kyc/)（企業、專家或個人）。
3. 綁定官方網域並發布 Schema（TrueLink 網頁工具或 Schema Studio 都可以）。
4. 在官網加入一行嵌入程式碼，或在伺服器設定金鑰 API。

有問題？歡迎開 [討論或 issue](https://github.com/Johnny050033/truelink-schema-web-tools/issues/new/choose)，
或透過 [truelink-group.com](https://truelink-group.com/) 聯絡 TrueLink。
