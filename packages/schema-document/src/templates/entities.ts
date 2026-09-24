import { isTaiwanBusinessId, t } from '../formats.js';
import { issue, profileChecks } from '../issues.js';
import { getAt, textsOf } from '../json.js';
import type { FieldOption, SchemaTemplate } from '../types.js';
import { addressFields, countryOptions, dayOptions, field, fields, googleLink, languageOptions, prefixed, schemaOrgLink } from './common.js';

const addressWithCountries = addressFields.map((item) => (item.kind === 'country' ? { ...item, options: countryOptions } : item));

export const organizationTypes: readonly FieldOption[] = [
  { value: 'Organization', label: t('組織', 'Organization') },
  { value: 'Corporation', label: t('企業／公司', 'Corporation') },
  { value: 'OnlineStore', label: t('線上商店', 'Online store') },
  { value: 'NGO', label: t('非營利組織', 'NGO') },
  { value: 'EducationalOrganization', label: t('教育機構', 'Educational organization') },
  { value: 'MedicalOrganization', label: t('醫療機構', 'Medical organization') },
  { value: 'NewsMediaOrganization', label: t('新聞媒體', 'News media organization') },
  { value: 'GovernmentOrganization', label: t('政府機關', 'Government organization') },
];

export const localBusinessTypes: readonly FieldOption[] = [
  { value: 'LocalBusiness', label: t('地方商家', 'Local business') },
  { value: 'Restaurant', label: t('餐廳', 'Restaurant') },
  { value: 'CafeOrCoffeeShop', label: t('咖啡廳', 'Café or coffee shop') },
  { value: 'Bakery', label: t('烘焙坊', 'Bakery') },
  { value: 'BarOrPub', label: t('酒吧', 'Bar or pub') },
  { value: 'Store', label: t('商店', 'Store') },
  { value: 'ClothingStore', label: t('服飾店', 'Clothing store') },
  { value: 'BeautySalon', label: t('美容美髮', 'Beauty salon') },
  { value: 'HealthAndBeautyBusiness', label: t('美容保健', 'Health & beauty business') },
  { value: 'MedicalClinic', label: t('診所', 'Medical clinic') },
  { value: 'Dentist', label: t('牙醫診所', 'Dentist') },
  { value: 'ExerciseGym', label: t('健身房', 'Gym') },
  { value: 'LegalService', label: t('法律服務', 'Legal service') },
  { value: 'AccountingService', label: t('會計服務', 'Accounting service') },
  { value: 'RealEstateAgent', label: t('房地產仲介', 'Real estate agent') },
  { value: 'AutoRepair', label: t('汽車維修', 'Auto repair') },
  { value: 'HomeAndConstructionBusiness', label: t('居家修繕與營造', 'Home & construction') },
  { value: 'TravelAgency', label: t('旅行社', 'Travel agency') },
  { value: 'LodgingBusiness', label: t('住宿', 'Lodging') },
  { value: 'Hotel', label: t('飯店', 'Hotel') },
  { value: 'ChildCare', label: t('托育', 'Child care') },
];

const diningTypes = ['Restaurant', 'CafeOrCoffeeShop', 'Bakery', 'BarOrPub', 'FastFoodRestaurant', 'FoodEstablishment', 'IceCreamShop'];

export const organization: SchemaTemplate = {
  id: 'organization',
  type: 'Organization',
  matchTypes: [...organizationTypes.map((option) => option.value), 'OnlineBusiness', 'SportsOrganization', 'Airline', 'PerformingGroup', 'ResearchOrganization'],
  name: t('組織／品牌', 'Organization / brand'),
  summary: t('告訴搜尋引擎與 AI「你是誰」：名稱、標誌、官網與官方社群。', 'Tell engines who you are: name, logo, website and official profiles.'),
  category: 'entity',
  icon: 'building',
  richResult: t('可協助搜尋引擎辨識品牌標誌與官方資訊', 'Helps engines recognize your logo and official details'),
  nodeTypes: { address: 'PostalAddress', contactPoint: 'ContactPoint', founder: 'Person' },
  titlePaths: [['name'], ['legalName']],
  sections: [
    {
      id: 'basics',
      title: t('基本資料', 'Basics'),
      description: t('品牌的正式名稱與官方網站。', 'Your official name and website.'),
      fields: [
        field('@type', 'select', ['@type'], { label: t('組織類型', 'Organization type'), importance: 'optional', options: organizationTypes }),
        fields.name(),
        fields.alternateName(),
        field('legalName', 'text', ['legalName'], { label: t('公司登記名稱', 'Legal name'), importance: 'optional', maxLength: 150, placeholder: t('例：晨光咖啡股份有限公司', 'e.g. Morning Light Coffee Ltd.') }),
        fields.url(),
        fields.id('organization'),
        fields.logo(),
        fields.description(),
        field('slogan', 'text', ['slogan'], { label: t('品牌標語', 'Slogan'), importance: 'optional', maxLength: 150 }),
      ],
    },
    {
      id: 'contact',
      title: t('聯絡方式', 'Contact'),
      fields: [
        fields.telephone(),
        fields.email(),
        field('contactPoint.contactType', 'select', ['contactPoint', 'contactType'], {
          label: t('客服窗口類型', 'Contact point type'),
          importance: 'optional',
          options: [
            { value: 'customer service', label: t('客服', 'Customer service') },
            { value: 'sales', label: t('業務洽詢', 'Sales') },
            { value: 'technical support', label: t('技術支援', 'Technical support') },
            { value: 'billing support', label: t('帳務', 'Billing support') },
            { value: 'reservations', label: t('訂位／預約', 'Reservations') },
          ],
        }),
        field('contactPoint.telephone', 'tel', ['contactPoint', 'telephone'], { label: t('窗口電話', 'Contact point phone'), importance: 'optional', placeholder: t('+886-800-000-000', '+1-800-555-0100') }),
        field('contactPoint.email', 'email', ['contactPoint', 'email'], { label: t('窗口信箱', 'Contact point email'), importance: 'optional' }),
        field('contactPoint.availableLanguage', 'language', ['contactPoint', 'availableLanguage'], { label: t('服務語言', 'Available language'), importance: 'optional', options: languageOptions }),
      ],
    },
    {
      id: 'address',
      title: t('地址', 'Address'),
      description: t('公司或營運據點地址；純線上品牌可只填縣市與國家。', 'Registered or operating address; online-only brands can give city and country.'),
      fields: prefixed(['address'], addressWithCountries.map((item) => (item.id === 'streetAddress' || item.id === 'postalCode' ? { ...item, importance: 'optional' as const } : item)), 'address'),
    },
    {
      id: 'authority',
      title: t('權威與信任', 'Authority & trust'),
      description: t('這些資訊支撐 E-E-A-T：讓 AI 能交叉驗證你的身分與專業。', 'These details support E-E-A-T so AI can cross-verify identity and expertise.'),
      fields: [
        fields.sameAs(),
        fields.knowsAbout(),
        field('foundingDate', 'date', ['foundingDate'], { label: t('成立日期', 'Founding date'), importance: 'optional', placeholder: t('例：2015-06-01', 'e.g. 2015-06-01'), help: t('可只填年份（2015）或年月（2015-06）。', 'Year (2015) or year-month (2015-06) is fine.') }),
        field('founder.name', 'text', ['founder', 'name'], { label: t('創辦人', 'Founder'), importance: 'optional', maxLength: 120 }),
        field('award', 'text', ['award'], { label: t('獎項與認證', 'Awards'), importance: 'optional', multiple: true, maxLength: 200, placeholder: t('例：2025 台灣精品獎', 'e.g. 2025 Design Award') }),
        field('taxID', 'taxId', ['taxID'], { label: t('統一編號', 'Tax ID'), importance: 'optional', placeholder: t('例：12345675', 'Company tax identifier'), help: t('台灣公司可填 8 碼統一編號，本工具會檢查檢查碼。', 'Taiwanese 8-digit numbers are checksum-verified by this tool.') }),
      ],
    },
  ],
  checks(node) {
    const issues = profileChecks(node);
    const taxId = getAt(node, ['taxID']);
    if (typeof taxId === 'string' && /^\d{8}$/.test(taxId) && !isTaiwanBusinessId(taxId)) {
      issues.push(issue('warning', 'tax_id_checksum', t('統一編號檢查碼不符，請確認是否輸入正確。', 'The Taiwan tax ID checksum does not match; please double-check it.'), { fieldId: 'taxID', path: ['taxID'] }));
    }
    return issues;
  },
  learnMore: [googleLink('structured-data/organization', '組織（Organization）', 'Organization'), schemaOrgLink('Organization')],
};

export const localBusiness: SchemaTemplate = {
  id: 'local-business',
  type: 'LocalBusiness',
  matchTypes: [
    ...localBusinessTypes.map((option) => option.value),
    'FoodEstablishment', 'FastFoodRestaurant', 'IceCreamShop', 'HairSalon', 'NailSalon', 'DaySpa', 'Pharmacy', 'Optician',
    'BookStore', 'ElectronicsStore', 'FurnitureStore', 'GroceryStore', 'HardwareStore', 'JewelryStore', 'PetStore', 'ShoeStore',
    'SportingGoodsStore', 'ToyStore', 'Florist', 'Physician', 'VeterinaryCare', 'Attorney', 'Notary', 'InsuranceAgency',
    'FinancialService', 'Bank', 'AutomotiveBusiness', 'AutoDealer', 'Electrician', 'Plumber', 'HVACBusiness', 'Locksmith',
    'MovingCompany', 'GeneralContractor', 'SelfStorage', 'EntertainmentBusiness', 'SportsActivityLocation', 'TouristInformationCenter',
    'BedAndBreakfast', 'Hostel', 'Motel', 'Resort', 'EmploymentAgency', 'ProfessionalService',
  ],
  name: t('地方商家', 'Local business'),
  summary: t('門市、餐廳、診所等實體據點：地址、營業時間與電話。', 'Stores, restaurants, clinics: address, opening hours and phone.'),
  category: 'entity',
  icon: 'store',
  richResult: t('可能用於地圖與在地搜尋的商家資訊', 'May power business details in local and map results'),
  nodeTypes: { address: 'PostalAddress', geo: 'GeoCoordinates' },
  titlePaths: [['name']],
  brandFill: [
    { from: ['name'], to: ['name'] },
    { from: ['url'], to: ['url'] },
    { from: ['logo'], to: ['logo'] },
    { from: ['description'], to: ['description'] },
    { from: ['telephone'], to: ['telephone'] },
    { from: ['email'], to: ['email'] },
    { from: ['address'], to: ['address'] },
    { from: ['sameAs'], to: ['sameAs'] },
  ],
  sections: [
    {
      id: 'basics',
      title: t('基本資料', 'Basics'),
      fields: [
        field('@type', 'select', ['@type'], { label: t('商家類型', 'Business type'), importance: 'optional', options: localBusinessTypes, help: t('選擇最接近的類型；越具體越好。', 'Choose the most specific matching type.') }),
        fields.name(),
        fields.url(),
        fields.id('localbusiness'),
        fields.image(),
        fields.logo('optional'),
        fields.description(),
        field('priceRange', 'text', ['priceRange'], { label: t('價格區間', 'Price range'), importance: 'recommended', maxLength: 100, placeholder: t('例：NT$200–500 或 $$', 'e.g. $10–25 or $$'), why: t('價格區間能協助使用者與 AI 判斷消費層級。', 'A price range helps people and AI judge your price level.') }),
      ],
    },
    {
      id: 'location',
      title: t('地點', 'Location'),
      description: t('Google 將地址列為地方商家的必要資訊。', 'Google lists the address as required for local businesses.'),
      fields: [
        ...prefixed(['address'], addressWithCountries.map((item) => {
          if (item.id === 'streetAddress' || item.id === 'addressLocality') return { ...item, importance: 'required' as const };
          if (item.id === 'postalCode') return { ...item, importance: 'recommended' as const };
          return item;
        }), 'address'),
        field('geo.latitude', 'number', ['geo', 'latitude'], { label: t('緯度', 'Latitude'), importance: 'recommended', placeholder: t('例：25.0418', 'e.g. 40.7128'), help: t('在 Google 地圖對地點按右鍵即可複製座標。', 'Right-click the place in a map app to copy coordinates.'), why: t('精確座標可避免同名或相近地址被誤認。', 'Exact coordinates prevent confusion with similar addresses.') }),
        field('geo.longitude', 'number', ['geo', 'longitude'], { label: t('經度', 'Longitude'), importance: 'recommended', placeholder: t('例：121.5440', 'e.g. -74.0060') }),
        field('hasMap', 'url', ['hasMap'], { label: t('地圖連結', 'Map URL'), importance: 'optional', placeholder: t('https://maps.app.goo.gl/…', 'https://maps.app.goo.gl/…') }),
      ],
    },
    {
      id: 'hours',
      title: t('聯絡與營業時間', 'Contact & hours'),
      fields: [
        fields.telephone(),
        fields.email(),
        {
          id: 'openingHoursSpecification',
          kind: 'list',
          path: ['openingHoursSpecification'],
          itemType: 'OpeningHoursSpecification',
          label: t('營業時間', 'Opening hours'),
          itemLabel: t('時段', 'Time slot'),
          addLabel: t('新增營業時段', 'Add time slot'),
          help: t('同樣時間的日子可放在同一個時段；跨午夜營業可填 18:00 至 02:00。', 'Group days that share the same hours; overnight hours like 18:00–02:00 are fine.'),
          importance: 'recommended',
          why: t('營業時間是使用者最常詢問 AI 的在地資訊之一。', 'Opening hours are among the most-asked local facts.'),
          fields: [
            field('dayOfWeek', 'days', ['dayOfWeek'], { label: t('星期', 'Days'), importance: 'required', multiple: true, options: dayOptions }),
            field('opens', 'time', ['opens'], { label: t('開始', 'Opens'), importance: 'required', placeholder: t('09:00', '09:00') }),
            field('closes', 'time', ['closes'], { label: t('結束', 'Closes'), importance: 'required', placeholder: t('18:00', '18:00') }),
          ],
        },
      ],
    },
    {
      id: 'dining',
      title: t('餐飲資訊', 'Dining'),
      fields: [
        field('servesCuisine', 'text', ['servesCuisine'], { label: t('料理類型', 'Cuisine'), importance: 'recommended', multiple: true, maxLength: 80, placeholder: t('例：台式早午餐', 'e.g. Brunch'), visibleWhen: { path: ['@type'], in: diningTypes, default: 'LocalBusiness' } }),
        field('menu', 'url', ['menu'], { label: t('菜單網址', 'Menu URL'), importance: 'recommended', visibleWhen: { path: ['@type'], in: diningTypes, default: 'LocalBusiness' } }),
      ],
    },
    {
      id: 'authority',
      title: t('官方連結', 'Official profiles'),
      fields: [
        fields.sameAs({ help: t('Google 商家檔案、Facebook、Instagram、訂位或外送平台上的官方頁面。', 'Your Google Business Profile, social pages, and booking or delivery listings.') }),
        field('areaServed', 'text', ['areaServed'], { label: t('服務範圍', 'Area served'), importance: 'optional', maxLength: 200, placeholder: t('例：臺北市、新北市', 'e.g. Greater Boston') }),
      ],
    },
  ],
  checks(node) {
    const issues = profileChecks(node);
    const latitude = getAt(node, ['geo', 'latitude']);
    const longitude = getAt(node, ['geo', 'longitude']);
    if ((latitude === undefined) !== (longitude === undefined)) {
      issues.push(issue('warning', 'geo_incomplete', t('經緯度需要同時填寫。', 'Latitude and longitude should be provided together.'), { fieldId: latitude === undefined ? 'geo.latitude' : 'geo.longitude', path: ['geo'] }));
    }
    const priceRange = getAt(node, ['priceRange']);
    if (typeof priceRange === 'string' && [...priceRange].length > 100) {
      issues.push(issue('warning', 'price_range_long', t('價格區間建議少於 100 個字元。', 'Keep the price range under 100 characters.'), { fieldId: 'priceRange', path: ['priceRange'] }));
    }
    return issues;
  },
  learnMore: [
    { label: t('TrueLink 部落格：BreadcrumbList 與 LocalBusiness 如何讓生成式引擎看見你的坐標', 'TrueLink blog: how BreadcrumbList and LocalBusiness help generative engines locate you'), url: 'https://truelink-group.com/blog/ai-breadcrumblist-localbusiness/', publisher: 'truelink', lang: 'zh-TW' },
    googleLink('structured-data/local-business', '地方商家（LocalBusiness）', 'Local business'),
    schemaOrgLink('LocalBusiness'),
  ],
};

export const person: SchemaTemplate = {
  id: 'person',
  type: 'Person',
  name: t('人物／專家', 'Person / expert'),
  summary: t('創辦人、作者或專業人士的身分與專長，強化 E-E-A-T。', 'Founders, authors or experts — identity and expertise for E-E-A-T.'),
  category: 'entity',
  icon: 'user',
  nodeTypes: { worksFor: 'Organization', alumniOf: 'EducationalOrganization' },
  titlePaths: [['name']],
  brandFill: [
    { from: ['name'], to: ['worksFor', 'name'] },
    { from: ['url'], to: ['worksFor', 'url'] },
  ],
  sections: [
    {
      id: 'basics',
      title: t('基本資料', 'Basics'),
      fields: [
        fields.name('required', { placeholder: t('例：王小明', 'e.g. Alex Chen') }),
        fields.id('person'),
        field('jobTitle', 'text', ['jobTitle'], { label: t('職稱', 'Job title'), importance: 'recommended', maxLength: 120, placeholder: t('例：首席咖啡烘焙師', 'e.g. Head roaster'), why: t('職稱讓 AI 知道這個人以什麼身分發言。', 'A job title tells AI in what capacity this person speaks.') }),
        fields.description('recommended', { label: t('個人簡介', 'Bio'), placeholder: t('經歷、專長與代表作品。', 'Experience, expertise and notable work.') }),
        fields.image('recommended', { label: t('照片網址', 'Photo URL') }),
        fields.url('recommended', { label: t('個人頁面網址', 'Profile page URL'), help: t('官網上的作者或團隊介紹頁。', 'An author or team page on your site.') }),
      ],
    },
    {
      id: 'affiliation',
      title: t('所屬與學經歷', 'Affiliation'),
      fields: [
        field('worksFor.name', 'text', ['worksFor', 'name'], { label: t('任職單位', 'Works for'), importance: 'recommended', maxLength: 150, why: t('所屬單位把個人與品牌實體連結起來。', 'Affiliation links the person to your organization.') }),
        field('worksFor.url', 'url', ['worksFor', 'url'], { label: t('任職單位網址', 'Employer URL'), importance: 'optional' }),
        field('alumniOf.name', 'text', ['alumniOf', 'name'], { label: t('畢業學校', 'Alumni of'), importance: 'optional', maxLength: 150 }),
      ],
    },
    {
      id: 'authority',
      title: t('專業與權威', 'Expertise & authority'),
      fields: [
        fields.sameAs({ help: t('LinkedIn、個人網站、學術或媒體專訪頁面。', 'LinkedIn, personal site, publications or interviews.') }),
        fields.knowsAbout(),
        field('award', 'text', ['award'], { label: t('獎項與證照', 'Awards & credentials'), importance: 'optional', multiple: true, maxLength: 200 }),
      ],
    },
    {
      id: 'contact',
      title: t('聯絡方式', 'Contact'),
      description: t('僅填寫願意公開的資訊。', 'Only publish details you want to be public.'),
      fields: [fields.email(), fields.telephone('optional')],
    },
  ],
  checks: profileChecks,
  learnMore: [
    { label: t('TrueLink：AI 搜尋時代的 E-E-A-T 完整指南（英文）', 'TrueLink: The complete E-E-A-T guide for the AI search era'), url: 'https://www.truelink-group.com/en/eeat-guide/', publisher: 'truelink', lang: 'en' },
    schemaOrgLink('Person'),
  ],
};

export const website: SchemaTemplate = {
  id: 'website',
  type: 'WebSite',
  name: t('網站', 'Website'),
  summary: t('網站名稱與主要語言，協助搜尋結果顯示正確的網站名稱。', 'Site name and language so results show the right site name.'),
  category: 'entity',
  icon: 'globe',
  richResult: t('可協助搜尋結果顯示網站名稱', 'Helps results display your site name'),
  nodeTypes: { publisher: 'Organization' },
  titlePaths: [['name']],
  brandFill: [
    { from: ['name'], to: ['name'] },
    { from: ['alternateName'], to: ['alternateName'] },
    { from: ['url'], to: ['url'] },
    { from: ['name'], to: ['publisher', 'name'] },
  ],
  starter: (locale) => ({ inLanguage: locale === 'zh-TW' ? 'zh-TW' : 'en' }),
  sections: [
    {
      id: 'basics',
      title: t('網站資訊', 'Site details'),
      fields: [
        fields.name('required', { label: t('網站名稱', 'Site name'), help: t('使用簡短、一致的網站名稱，通常就是品牌名。', 'A short, consistent name — usually your brand.') }),
        fields.url('required', { label: t('首頁網址', 'Homepage URL'), help: t('網域首頁，例如 https://example.com/。', 'The domain homepage, e.g. https://example.com/.') }),
        fields.alternateName({ importance: 'recommended', why: t('提供常見替代名稱，萬一主要名稱無法使用時可作為備選。', 'Provides a fallback if the main name cannot be used.') }),
        fields.id('website'),
        fields.description('optional'),
        field('inLanguage', 'language', ['inLanguage'], { label: t('主要語言', 'Primary language'), importance: 'recommended', options: languageOptions, why: t('標示語言有助於搜尋引擎把網站提供給正確的讀者。', 'Declaring language helps engines serve the right audience.') }),
        field('publisher.name', 'text', ['publisher', 'name'], { label: t('發布單位', 'Publisher'), importance: 'recommended', maxLength: 150 }),
      ],
    },
  ],
  learnMore: [googleLink('site-names', '網站名稱', 'Site names'), schemaOrgLink('WebSite')],
};
