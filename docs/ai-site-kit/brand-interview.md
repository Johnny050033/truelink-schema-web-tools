# Brand interview / 品牌訪談

Keep completed answers in your own private project. This is an empty interview guide, not
an upload form. Separate **confirmed and approved for the site**, **needs confirmation** and
**private / omit**. Leave an unknown answer blank; do not let an assistant invent it.

填好的答案先留在私有專案。每項標記「已確認且可公開」「待確認」「私有／省略」，並記錄資料來源與
核對日期。這不是上傳表單；沒有答案時列為待補，不以範例或 AI 推測冒充品牌事實。

## 1. Website purpose / 網站目的

| Ask | 中文題目 |
| --- | --- |
| What should a visitor understand or do first? | 訪客最先應了解或完成哪一件事？ |
| Who is the audience, and what problem brings them here? | 主要服務誰？他們帶著什麼問題來？ |
| Which pages are needed now, and which can wait? | 這次需要哪些頁面？哪些可留待之後？ |
| What language, device and accessibility needs should be considered? | 需要哪些語言、裝置與無障礙支援？ |
| Which framework or existing site must this fit, and who maintains it? | 要接在哪個網站框架或既有網站？由誰維護？ |

These are project notes, not Schema fields. Do not put them into a `SchemaDocumentRecord`
envelope as new top-level keys.

## 2. Identity and public facts / 品牌身分與公開事實

Start with the existing [brand wizard's four field groups](../../apps/web/src/features/brand/BrandPage.tsx).
Collect only the details relevant to the chosen template; never request identity documents
or an account password as evidence.

| Group | Ask / 題目 | Evidence and privacy |
| --- | --- | --- |
| Basics | What are the public name, official site and short description? / 公開名稱、官網及簡短介紹是什麼？ | Link the owner-approved source; distinguish legal name from display name |
| Contact | Which business contact, service area or address should appear? / 哪些業務聯絡方式、服務地區或地址可公開？ | An individual can omit a home address or personal phone; choose approved business contact only |
| Official profiles | Which profiles are controlled by this brand? / 哪些社群或外部頁面確實由品牌控制？ | Record exact URLs; an ordinary mention is not an official `sameAs` profile |
| Authority | Which founding dates, expertise, awards or identifiers are both true and appropriate to share? / 哪些創立日期、專長、獎項或識別資料真實且適合公開？ | Request a public source and approval; omit unverified or private claims |

For each proposed fact, keep a simple private note: value, source, date checked, who confirmed
it and whether it may appear on the site. Those review notes are not a public template payload.
Never turn an answer such as “we aim to be trusted” into a certification or customer rating.

## 3. Voice and visual choices / 語氣與視覺

| Ask | 中文題目 |
| --- | --- |
| What value do you provide, in one factual sentence? | 用一句符合事實的話說明提供什麼價值。 |
| Which real example demonstrates that value? | 有哪個可公開的真實做法或例子支持這個價值？ |
| Which words should the brand sound like, and which should it avoid? | 希望品牌呈現哪些語氣？有哪些應避免的用詞？ |
| Which existing colors, typefaces, images or logos are approved for reuse? | 哪些既有色彩、字體、圖片或標誌已獲准使用？ |
| Who owns each asset, and what does its license allow? | 每項素材由誰擁有？授權允許哪些用途？ |
| Are there references you like, without copying their identity or claims? | 有哪些喜歡的參考方向？如何避免照搬其識別或宣稱？ |

Visual preferences are design inputs, not verified business facts or structured-data credentials.
Use the customer's own licensed assets. The library's MIT license does not grant rights to
TrueLink's brand assets; see [TRADEMARKS.md](../../TRADEMARKS.md).

## 4. Content to prepare / 準備頁面內容

Choose existing [Schema templates](../../packages/schema-document/src/templates/index.ts) only
when the matching facts exist. For example, product facts need real product information;
an Event needs an actual event; a FAQ must match questions and answers visible on the page.
The generic Thing template is not a way to invent missing evidence.

Ask who owns each text, image and testimonial; what visitors can verify; and which content
must stay private. Do not invent prices, reviews, testimonials, dates, statistics, citations
or certification. Write an unresolved-content list instead of publishing placeholders as facts.

## 5. Approve the public subset / 確認可公開範圍

Before the site is published, the content owner reviews the visible pages, public contact
details, asset rights and corresponding JSON-LD. Record any unresolved items and remove
them from the public version. Saving a draft or answering this interview is not consent to
publish or to enable an account integration. Continue with [acceptance.md](acceptance.md).
