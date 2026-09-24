import { t } from '../formats.js';
import { getAt, isJsonObject } from '../json.js';
import type { FieldOption, Importance, JsonObject, LearnMoreLink, ScalarField } from '../types.js';

type FieldOverrides = Partial<Omit<ScalarField, 'id' | 'kind' | 'path'>>;

export function field(id: string, kind: ScalarField['kind'], path: readonly string[], base: Omit<ScalarField, 'id' | 'kind' | 'path'>, overrides: FieldOverrides = {}): ScalarField {
  return { id, kind, path, ...base, ...overrides } as ScalarField;
}

export function prefixed(prefix: readonly string[], fields: readonly ScalarField[], idPrefix: string): ScalarField[] {
  return fields.map((item) => ({ ...item, id: `${idPrefix}.${item.id}`, path: [...prefix, ...item.path] }));
}

/** Suggests `https://example.com/#<fragment>` from the node's own URL. */
export function idFromUrl(fragment: string): (node: JsonObject) => string | undefined {
  return (node) => {
    const url = getAt(node, ['url']);
    if (typeof url !== 'string') return undefined;
    try {
      const parsed = new URL(url.trim());
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
      return `${parsed.origin}${parsed.pathname}#${fragment}`;
    } catch {
      return undefined;
    }
  };
}

export const fields = {
  name(importance: Importance = 'required', overrides: FieldOverrides = {}): ScalarField {
    return field('name', 'text', ['name'], {
      label: t('名稱', 'Name'),
      importance,
      maxLength: 150,
      help: t('使用對外一致的正式名稱，與網站、招牌及社群頁面相同。', 'Use the same public name that appears on your site, signage and social profiles.'),
    }, overrides);
  },
  alternateName(overrides: FieldOverrides = {}): ScalarField {
    return field('alternateName', 'text', ['alternateName'], {
      label: t('其他名稱／英文名稱', 'Alternate name'),
      importance: 'optional',
      maxLength: 150,
      placeholder: t('例：Morning Light Coffee', 'e.g. MLC'),
      help: t('品牌簡稱、英文名稱或常見別名，協助搜尋引擎把不同稱呼對應到同一個品牌。', 'Short names, translations or common aliases that refer to the same entity.'),
    }, overrides);
  },
  url(importance: Importance = 'recommended', overrides: FieldOverrides = {}): ScalarField {
    return field('url', 'url', ['url'], {
      label: t('官方網址', 'Official URL'),
      importance,
      placeholder: t('https://example.com', 'https://example.com'),
      help: t('請填完整網址（含 https://），通常是官網首頁。', 'Enter the full address including https://, usually your homepage.'),
      why: t('官方網址是搜尋引擎與 AI 確認「哪個網站代表你」的主要依據。', 'The official URL is the primary signal of which website represents you.'),
    }, overrides);
  },
  id(fragment: string, overrides: FieldOverrides = {}): ScalarField {
    return field('@id', 'id', ['@id'], {
      label: t('實體識別碼（@id）', 'Entity identifier (@id)'),
      importance: 'recommended',
      placeholder: t(`https://example.com/#${fragment}`, `https://example.com/#${fragment}`),
      help: t('用一個固定網址代表同一個實體，讓不同頁面的結構化資料能互相連結。建議使用「官網網址#' + fragment + '」。', `A stable URL that identifies this entity across pages. A common pattern is "https://your-site/#${fragment}".`),
      why: t('固定的 @id 讓搜尋引擎與 AI 把各頁資料合併成同一個實體。', 'A stable @id lets engines merge data from many pages into one entity.'),
      suggest: idFromUrl(fragment),
    }, overrides);
  },
  description(importance: Importance = 'recommended', overrides: FieldOverrides = {}): ScalarField {
    return field('description', 'textarea', ['description'], {
      label: t('簡介', 'Description'),
      importance,
      maxLength: 5000,
      placeholder: t('用 2–3 句話說明你是誰、提供什麼、服務哪些對象。', 'In 2–3 sentences: who you are, what you offer and who you serve.'),
      help: t('具體描述比形容詞更有用：寫出主要產品／服務、地區與對象。', 'Specific facts beat adjectives: name your main offering, area and audience.'),
      why: t('清楚的簡介能幫助 AI 用你的說法介紹你。', 'A clear description helps AI describe you in your own words.'),
    }, overrides);
  },
  image(importance: Importance = 'recommended', overrides: FieldOverrides = {}): ScalarField {
    return field('image', 'url', ['image'], {
      label: t('代表圖片網址', 'Image URL'),
      importance,
      placeholder: t('https://example.com/images/cover.jpg', 'https://example.com/images/cover.jpg'),
      help: t('可公開存取的圖片完整網址。本工具不會下載或預覽外部圖片。', 'A publicly reachable image URL. This tool never downloads or previews remote images.'),
      why: t('圖片可能用於搜尋結果與知識面板的視覺呈現。', 'Images may be used for visual search features.'),
    }, overrides);
  },
  logo(importance: Importance = 'recommended', overrides: FieldOverrides = {}): ScalarField {
    return field('logo', 'url', ['logo'], {
      label: t('標誌（Logo）網址', 'Logo URL'),
      importance,
      placeholder: t('https://example.com/logo.png', 'https://example.com/logo.png'),
      help: t('建議使用至少 112×112 像素、背景單純的方形或橫式標誌。', 'Use a logo at least 112×112 px on a plain background.'),
      why: t('標誌可協助搜尋引擎在結果與知識面板中辨識你的品牌。', 'A logo helps search engines recognize your brand in results and panels.'),
    }, overrides);
  },
  telephone(importance: Importance = 'recommended', overrides: FieldOverrides = {}): ScalarField {
    return field('telephone', 'tel', ['telephone'], {
      label: t('電話', 'Telephone'),
      importance,
      placeholder: t('+886-2-2345-6789', '+1-555-010-0199'),
      help: t('建議使用含國碼的國際格式，例如 +886-2-2345-6789。', 'International format with country code is recommended.'),
      why: t('聯絡電話是確認實體真實存在的重要訊號。', 'A contact number is a strong signal that the entity is real and reachable.'),
    }, overrides);
  },
  email(importance: Importance = 'optional', overrides: FieldOverrides = {}): ScalarField {
    return field('email', 'email', ['email'], {
      label: t('電子郵件', 'Email'),
      importance,
      placeholder: t('hello@example.com', 'hello@example.com'),
      help: t('建議使用公開的客服或服務信箱，避免個人信箱。', 'Use a public service mailbox rather than a personal address.'),
    }, overrides);
  },
  sameAs(overrides: FieldOverrides = {}): ScalarField {
    return field('sameAs', 'url', ['sameAs'], {
      label: t('官方社群與權威連結（sameAs）', 'Official profiles (sameAs)'),
      importance: 'recommended',
      multiple: true,
      placeholder: t('https://www.facebook.com/your-page', 'https://www.linkedin.com/company/your-company'),
      help: t('填入由你經營或描述你的官方頁面：Facebook、Instagram、LinkedIn、YouTube、Google 商家檔案、維基百科等。', 'Profiles you own or that describe you: Facebook, Instagram, LinkedIn, YouTube, Google Business Profile, Wikipedia and more.'),
      why: t('搜尋引擎與 AI 可透過這些連結交叉比對，確認不同平台上的是同一個品牌。', 'Engines can cross-reference these links to confirm that profiles belong to the same entity.'),
    }, overrides);
  },
  knowsAbout(overrides: FieldOverrides = {}): ScalarField {
    return field('knowsAbout', 'text', ['knowsAbout'], {
      label: t('專業領域（knowsAbout）', 'Expertise (knowsAbout)'),
      importance: 'recommended',
      multiple: true,
      maxLength: 120,
      placeholder: t('例：精品咖啡烘焙', 'e.g. specialty coffee roasting'),
      help: t('每格填一個主題，例如「結構化資料」「在地行銷」。', 'One topic per entry, e.g. "structured data" or "local marketing".'),
      why: t('專業領域是 E-E-A-T 中「專業性」的直接線索。', 'Declared expertise is a direct signal for the E-E-A-T “expertise” dimension.'),
    }, overrides);
  },
};

export const addressFields: readonly ScalarField[] = [
  field('streetAddress', 'text', ['streetAddress'], {
    label: t('街道地址', 'Street address'),
    importance: 'recommended',
    maxLength: 200,
    placeholder: t('例：忠孝東路四段 100 號 8 樓', 'e.g. 100 Main Street, Suite 8'),
  }),
  field('addressLocality', 'text', ['addressLocality'], {
    label: t('鄉鎮市區', 'City / locality'),
    importance: 'recommended',
    maxLength: 100,
    placeholder: t('例：大安區', 'e.g. Springfield'),
  }),
  field('addressRegion', 'text', ['addressRegion'], {
    label: t('縣市', 'State / region'),
    importance: 'recommended',
    maxLength: 100,
    placeholder: t('例：臺北市', 'e.g. IL'),
  }),
  field('postalCode', 'text', ['postalCode'], {
    label: t('郵遞區號', 'Postal code'),
    importance: 'optional',
    maxLength: 20,
    placeholder: t('例：106', 'e.g. 62701'),
  }),
  field('addressCountry', 'country', ['addressCountry'], {
    label: t('國家', 'Country'),
    importance: 'recommended',
    help: t('使用 ISO 3166-1 兩碼國家代碼，台灣為 TW。', 'ISO 3166-1 alpha-2 code, e.g. TW or US.'),
  }),
];

export const countryOptions: readonly FieldOption[] = [
  { value: 'TW', label: t('台灣（TW）', 'Taiwan (TW)') },
  { value: 'HK', label: t('香港（HK）', 'Hong Kong (HK)') },
  { value: 'MO', label: t('澳門（MO）', 'Macao (MO)') },
  { value: 'JP', label: t('日本（JP）', 'Japan (JP)') },
  { value: 'KR', label: t('韓國（KR）', 'South Korea (KR)') },
  { value: 'SG', label: t('新加坡（SG）', 'Singapore (SG)') },
  { value: 'MY', label: t('馬來西亞（MY）', 'Malaysia (MY)') },
  { value: 'TH', label: t('泰國（TH）', 'Thailand (TH)') },
  { value: 'VN', label: t('越南（VN）', 'Vietnam (VN)') },
  { value: 'CN', label: t('中國（CN）', 'China (CN)') },
  { value: 'US', label: t('美國（US）', 'United States (US)') },
  { value: 'CA', label: t('加拿大（CA）', 'Canada (CA)') },
  { value: 'GB', label: t('英國（GB）', 'United Kingdom (GB)') },
  { value: 'AU', label: t('澳洲（AU）', 'Australia (AU)') },
  { value: 'DE', label: t('德國（DE）', 'Germany (DE)') },
  { value: 'FR', label: t('法國（FR）', 'France (FR)') },
];

export const currencyOptions: readonly FieldOption[] = [
  { value: 'TWD', label: t('新台幣（TWD）', 'New Taiwan dollar (TWD)') },
  { value: 'USD', label: t('美元（USD）', 'US dollar (USD)') },
  { value: 'HKD', label: t('港幣（HKD）', 'Hong Kong dollar (HKD)') },
  { value: 'JPY', label: t('日圓（JPY）', 'Japanese yen (JPY)') },
  { value: 'CNY', label: t('人民幣（CNY）', 'Chinese yuan (CNY)') },
  { value: 'SGD', label: t('新加坡幣（SGD）', 'Singapore dollar (SGD)') },
  { value: 'MYR', label: t('馬幣（MYR）', 'Malaysian ringgit (MYR)') },
  { value: 'KRW', label: t('韓圜（KRW）', 'South Korean won (KRW)') },
  { value: 'EUR', label: t('歐元（EUR）', 'Euro (EUR)') },
  { value: 'GBP', label: t('英鎊（GBP）', 'Pound sterling (GBP)') },
  { value: 'AUD', label: t('澳幣（AUD）', 'Australian dollar (AUD)') },
];

export const languageOptions: readonly FieldOption[] = [
  { value: 'zh-TW', label: t('繁體中文（zh-TW）', 'Traditional Chinese (zh-TW)') },
  { value: 'zh-HK', label: t('繁體中文－香港（zh-HK）', 'Chinese – Hong Kong (zh-HK)') },
  { value: 'zh-CN', label: t('簡體中文（zh-CN）', 'Simplified Chinese (zh-CN)') },
  { value: 'en', label: t('英文（en）', 'English (en)') },
  { value: 'ja', label: t('日文（ja）', 'Japanese (ja)') },
  { value: 'ko', label: t('韓文（ko）', 'Korean (ko)') },
  { value: 'vi', label: t('越南文（vi）', 'Vietnamese (vi)') },
  { value: 'th', label: t('泰文（th）', 'Thai (th)') },
];

export const availabilityOptions: readonly FieldOption[] = [
  { value: 'https://schema.org/InStock', label: t('有現貨', 'In stock') },
  { value: 'https://schema.org/LimitedAvailability', label: t('數量有限', 'Limited availability') },
  { value: 'https://schema.org/PreOrder', label: t('預購', 'Pre-order') },
  { value: 'https://schema.org/BackOrder', label: t('補貨中可預訂', 'Back order') },
  { value: 'https://schema.org/OnlineOnly', label: t('僅限線上', 'Online only') },
  { value: 'https://schema.org/OutOfStock', label: t('缺貨', 'Out of stock') },
  { value: 'https://schema.org/SoldOut', label: t('已售完', 'Sold out') },
  { value: 'https://schema.org/Discontinued', label: t('已停售', 'Discontinued') },
];

export const dayOptions: readonly FieldOption[] = [
  { value: 'Monday', label: t('週一', 'Mon') },
  { value: 'Tuesday', label: t('週二', 'Tue') },
  { value: 'Wednesday', label: t('週三', 'Wed') },
  { value: 'Thursday', label: t('週四', 'Thu') },
  { value: 'Friday', label: t('週五', 'Fri') },
  { value: 'Saturday', label: t('週六', 'Sat') },
  { value: 'Sunday', label: t('週日', 'Sun') },
];

export function offerFields(prefix: readonly string[], importance: Importance): ScalarField[] {
  return prefixed(prefix, [
    field('price', 'price', ['price'], {
      label: t('價格', 'Price'),
      importance,
      placeholder: t('例：1200', 'e.g. 49.99'),
      help: t('只填數字與小數點，不要包含「NT$」或逗號。', 'Digits and a decimal point only — no currency symbols or separators.'),
      why: t('明確的價格是產品與活動複合式結果常見的必要資訊。', 'A clear price is commonly required for product and event rich results.'),
      companion: { path: [...prefix, 'priceCurrency'], value: 'TWD' },
    }),
    field('priceCurrency', 'currency', ['priceCurrency'], {
      label: t('幣別', 'Currency'),
      importance,
      options: currencyOptions,
      help: t('ISO 4217 三碼幣別，新台幣為 TWD。', 'ISO 4217 code, e.g. TWD or USD.'),
    }),
    field('availability', 'select', ['availability'], {
      label: t('供貨狀態', 'Availability'),
      importance: 'recommended',
      options: availabilityOptions,
    }),
    field('url', 'url', ['url'], {
      label: t('購買／報名網址', 'Offer URL'),
      importance: 'optional',
      placeholder: t('https://example.com/buy', 'https://example.com/buy'),
    }),
  ], prefix.join('.'));
}

export function schemaOrgLink(type: string): LearnMoreLink {
  return { label: t(`Schema.org：${type} 定義`, `Schema.org: ${type}`), url: `https://schema.org/${type}`, publisher: 'schema.org', lang: 'en' };
}

export function googleLink(slug: string, zh: string, en: string): LearnMoreLink {
  return {
    label: t(`Google 搜尋中心：${zh}`, `Google Search Central: ${en}`),
    url: `https://developers.google.com/search/docs/appearance/${slug}`,
    publisher: 'google',
  };
}

export function hasObject(node: JsonObject, key: string): boolean {
  return isJsonObject(node[key]);
}
