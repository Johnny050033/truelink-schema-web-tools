import { t } from '../formats.js';
import { fmt, localize } from '../i18n.js';
import { comparableTime, issue } from '../issues.js';
import { getAt, isJsonObject, listAt, textOf } from '../json.js';
import type { AuditIssue, FieldOption, JsonObject, SchemaTemplate } from '../types.js';
import { addressFields, countryOptions, field, fields, googleLink, languageOptions, offerFields, prefixed, schemaOrgLink } from './common.js';

export const articleTypes: readonly FieldOption[] = [
  { value: 'Article', label: t('文章', 'Article') },
  { value: 'BlogPosting', label: t('部落格文章', 'Blog post') },
  { value: 'NewsArticle', label: t('新聞文章', 'News article') },
];

export const article: SchemaTemplate = {
  id: 'article',
  type: 'Article',
  matchTypes: [...articleTypes.map((option) => option.value), 'TechArticle', 'Report', 'ScholarlyArticle'],
  name: t('文章', 'Article'),
  summary: t('標題、作者、發布日期與發布單位，讓 AI 知道「誰寫的、何時寫的」。', 'Headline, author, dates and publisher — who wrote it and when.'),
  category: 'content',
  icon: 'file-text',
  richResult: t('協助搜尋引擎理解標題、日期與作者', 'Helps engines understand headline, dates and author'),
  nodeTypes: { author: 'Person', publisher: 'Organization', 'publisher.logo': 'ImageObject' },
  titlePaths: [['headline'], ['name']],
  brandFill: [
    { from: ['name'], to: ['publisher', 'name'] },
    { from: ['logo'], to: ['publisher', 'logo', 'url'] },
  ],
  sections: [
    {
      id: 'basics',
      title: t('文章資訊', 'Article details'),
      fields: [
        field('@type', 'select', ['@type'], { label: t('文章類型', 'Article type'), importance: 'optional', options: articleTypes }),
        field('headline', 'text', ['headline'], { label: t('標題', 'Headline'), importance: 'required', maxLength: 300, placeholder: t('例：5 個步驟讓 AI 正確介紹你的品牌', 'e.g. 5 steps to help AI describe your brand correctly'), help: t('與頁面上的主標題一致，建議精簡。', 'Match the on-page title and keep it concise.') }),
        fields.description('recommended', { label: t('摘要', 'Summary'), placeholder: t('用一兩句話說明文章重點。', 'One or two sentences on the main point.') }),
        fields.image('recommended', { multiple: true, label: t('文章圖片網址', 'Article image URLs') }),
        field('mainEntityOfPage', 'url', ['mainEntityOfPage'], { label: t('文章網址', 'Article URL'), importance: 'recommended', why: t('標示文章的正式網址，避免被轉載頁面取代。', 'Declares the canonical page so reposts are not mistaken for the original.') }),
        field('inLanguage', 'language', ['inLanguage'], { label: t('語言', 'Language'), importance: 'optional', options: languageOptions }),
        field('articleSection', 'text', ['articleSection'], { label: t('分類', 'Section'), importance: 'optional', maxLength: 80 }),
        field('keywords', 'text', ['keywords'], { label: t('關鍵字', 'Keywords'), importance: 'optional', multiple: true, maxLength: 60 }),
      ],
    },
    {
      id: 'dates',
      title: t('日期', 'Dates'),
      fields: [
        field('datePublished', 'datetime', ['datePublished'], { label: t('發布時間', 'Published'), importance: 'recommended', why: t('日期讓搜尋引擎與 AI 判斷內容的新鮮度。', 'Dates let engines judge freshness.') }),
        field('dateModified', 'datetime', ['dateModified'], { label: t('最後更新', 'Modified'), importance: 'recommended' }),
      ],
    },
    {
      id: 'author',
      title: t('作者', 'Author'),
      description: t('具名作者與作者頁連結是 E-E-A-T 的關鍵證據。', 'A named author with a profile link is key E-E-A-T evidence.'),
      fields: [
        field('author.@type', 'select', ['author', '@type'], { label: t('作者類型', 'Author type'), importance: 'optional', options: [{ value: 'Person', label: t('個人', 'Person') }, { value: 'Organization', label: t('組織', 'Organization') }] }),
        field('author.name', 'text', ['author', 'name'], { label: t('作者名稱', 'Author name'), importance: 'recommended', maxLength: 120, why: t('具名作者能提升內容的可信度。', 'A named author increases credibility.') }),
        field('author.url', 'url', ['author', 'url'], { label: t('作者介紹頁', 'Author page URL'), importance: 'recommended', why: t('作者頁讓 AI 找到作者的經歷與專長。', 'An author page lets AI find the author’s background.') }),
        field('author.jobTitle', 'text', ['author', 'jobTitle'], { label: t('作者職稱', 'Author job title'), importance: 'optional', maxLength: 120, visibleWhen: { path: ['author', '@type'], in: ['Person'], default: 'Person' } }),
      ],
    },
    {
      id: 'publisher',
      title: t('發布單位', 'Publisher'),
      fields: [
        field('publisher.name', 'text', ['publisher', 'name'], { label: t('發布單位名稱', 'Publisher name'), importance: 'recommended', maxLength: 150 }),
        field('publisher.logo.url', 'url', ['publisher', 'logo', 'url'], { label: t('發布單位標誌網址', 'Publisher logo URL'), importance: 'optional' }),
      ],
    },
  ],
  checks(node) {
    const issues: AuditIssue[] = [];
    const headline = textOf(getAt(node, ['headline']));
    if (headline && [...headline].length > 110) {
      issues.push(issue('warning', 'headline_long', t('標題較長；搜尋結果可能截斷，建議精簡到 110 字元內。', 'Long headlines may be truncated; aim for 110 characters or fewer.'), { fieldId: 'headline', path: ['headline'] }));
    }
    const published = comparableTime(getAt(node, ['datePublished']));
    const modified = comparableTime(getAt(node, ['dateModified']));
    if (published !== undefined && modified !== undefined && modified < published) {
      issues.push(issue('warning', 'modified_before_published', t('最後更新時間早於發布時間。', 'Modified date is earlier than the published date.'), { fieldId: 'dateModified', path: ['dateModified'] }));
    }
    return issues;
  },
  learnMore: [
    { label: t('TrueLink：AI 搜尋時代的 E-E-A-T 完整指南（英文）', 'TrueLink: The complete E-E-A-T guide for the AI search era'), url: 'https://www.truelink-group.com/en/eeat-guide/', publisher: 'truelink', lang: 'en' },
    googleLink('structured-data/article', '文章（Article）', 'Article'),
    schemaOrgLink('Article'),
  ],
};

export const faq: SchemaTemplate = {
  id: 'faq',
  type: 'FAQPage',
  name: t('常見問答（FAQ）', 'FAQ page'),
  summary: t('把顧客常問的問題與你的官方答案結構化，方便 AI 直接引用。', 'Structure customer questions and your official answers.'),
  category: 'content',
  icon: 'help-circle',
  richResult: t('FAQ 複合式結果目前主要限權威網站；仍有助理解問答內容', 'FAQ rich results are now mostly limited to authoritative sites; still aids understanding'),
  nodeTypes: {},
  titlePaths: [['name']],
  starter: () => ({ mainEntity: [{ '@type': 'Question', acceptedAnswer: { '@type': 'Answer' } }] }),
  sections: [
    {
      id: 'questions',
      title: t('問與答', 'Questions & answers'),
      description: t('問答內容必須與頁面上可見的文字一致，且由你撰寫，不可放廣告或使用者提問。', 'Q&A must match visible page text written by you — no ads or user-submitted questions.'),
      fields: [
        {
          id: 'mainEntity',
          kind: 'list',
          path: ['mainEntity'],
          itemType: 'Question',
          nodeTypes: { acceptedAnswer: 'Answer' },
          label: t('問答清單', 'Questions'),
          itemLabel: t('問題', 'Question'),
          addLabel: t('新增問答', 'Add question'),
          importance: 'required',
          minItems: 1,
          maxItems: 50,
          fields: [
            field('name', 'text', ['name'], { label: t('問題', 'Question'), importance: 'required', maxLength: 300, placeholder: t('例：可以開立統一發票嗎？', 'e.g. Do you ship internationally?') }),
            field('acceptedAnswer.text', 'textarea', ['acceptedAnswer', 'text'], { label: t('答案', 'Answer'), importance: 'required', maxLength: 5000, placeholder: t('完整回答，並與頁面上的文字一致。', 'A complete answer matching the page text.') }),
          ],
        },
      ],
    },
  ],
  checks(node) {
    const issues: AuditIssue[] = [];
    const seen = new Set<string>();
    listAt(node, ['mainEntity']).forEach((item, index) => {
      if (!isJsonObject(item)) return;
      const question = textOf(item['name'])?.toLowerCase();
      if (!question) return;
      if (seen.has(question)) {
        issues.push(issue('warning', 'duplicate_question', fmt('第 {n} 題與前面的問題重複。', 'Question {n} duplicates an earlier question.', { n: index + 1 }), { fieldId: 'mainEntity', path: ['mainEntity', index, 'name'] }));
      }
      seen.add(question);
    });
    return issues;
  },
  learnMore: [googleLink('structured-data/faqpage', '常見問題（FAQPage）', 'FAQ'), schemaOrgLink('FAQPage')],
};

const placeTypes = { path: ['location', '@type'], in: ['Place'], default: 'Place' } as const;

export const event: SchemaTemplate = {
  id: 'event',
  type: 'Event',
  matchTypes: ['Event', 'BusinessEvent', 'EducationEvent', 'MusicEvent', 'Festival', 'ExhibitionEvent', 'SocialEvent', 'SportsEvent', 'TheaterEvent', 'FoodEvent', 'CourseInstance'],
  name: t('活動', 'Event'),
  summary: t('講座、課程、展覽與演出：時間、地點與票券資訊。', 'Talks, classes, exhibitions and shows: time, place and tickets.'),
  category: 'content',
  icon: 'calendar',
  richResult: t('有機會出現在活動相關的搜尋體驗', 'May appear in event search experiences'),
  nodeTypes: { location: 'Place', 'location.address': 'PostalAddress', offers: 'Offer', organizer: 'Organization', performer: 'Person' },
  titlePaths: [['name']],
  brandFill: [
    { from: ['name'], to: ['organizer', 'name'] },
    { from: ['url'], to: ['organizer', 'url'] },
  ],
  starter: () => ({ eventStatus: 'https://schema.org/EventScheduled', eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode' }),
  sections: [
    {
      id: 'basics',
      title: t('活動資訊', 'Event details'),
      fields: [
        fields.name('required', { label: t('活動名稱', 'Event name'), placeholder: t('例：品牌 AI 能見度實戰工作坊', 'e.g. AI visibility workshop') }),
        fields.description('recommended'),
        fields.image('recommended', { multiple: true, label: t('活動圖片網址', 'Event image URLs') }),
        field('eventStatus', 'select', ['eventStatus'], {
          label: t('活動狀態', 'Status'),
          importance: 'recommended',
          options: [
            { value: 'https://schema.org/EventScheduled', label: t('如期舉行', 'Scheduled') },
            { value: 'https://schema.org/EventPostponed', label: t('延期（日期未定）', 'Postponed') },
            { value: 'https://schema.org/EventRescheduled', label: t('已改期', 'Rescheduled') },
            { value: 'https://schema.org/EventMovedOnline', label: t('改為線上', 'Moved online') },
            { value: 'https://schema.org/EventCancelled', label: t('已取消', 'Cancelled') },
          ],
        }),
        field('eventAttendanceMode', 'select', ['eventAttendanceMode'], {
          label: t('參加方式', 'Attendance mode'),
          importance: 'recommended',
          options: [
            { value: 'https://schema.org/OfflineEventAttendanceMode', label: t('實體', 'In person') },
            { value: 'https://schema.org/OnlineEventAttendanceMode', label: t('線上', 'Online') },
            { value: 'https://schema.org/MixedEventAttendanceMode', label: t('實體＋線上', 'Mixed') },
          ],
        }),
      ],
    },
    {
      id: 'time',
      title: t('時間', 'Time'),
      fields: [
        field('startDate', 'datetime', ['startDate'], { label: t('開始時間', 'Starts'), importance: 'required' }),
        field('endDate', 'datetime', ['endDate'], { label: t('結束時間', 'Ends'), importance: 'recommended' }),
      ],
    },
    {
      id: 'location',
      title: t('地點', 'Location'),
      fields: [
        field('location.@type', 'select', ['location', '@type'], { label: t('地點類型', 'Location type'), importance: 'optional', options: [{ value: 'Place', label: t('實體地點', 'Physical place') }, { value: 'VirtualLocation', label: t('線上', 'Online') }] }),
        field('location.name', 'text', ['location', 'name'], { label: t('場地名稱', 'Venue name'), importance: 'recommended', maxLength: 150, visibleWhen: placeTypes }),
        ...prefixed(['location', 'address'], addressFields.map((item) => {
          const withOptions = item.kind === 'country' ? { ...item, options: countryOptions } : item;
          return { ...withOptions, visibleWhen: placeTypes, importance: item.id === 'addressLocality' ? ('required' as const) : withOptions.importance };
        }), 'location.address'),
        field('location.url', 'url', ['location', 'url'], { label: t('線上活動網址', 'Online event URL'), importance: 'required', visibleWhen: { path: ['location', '@type'], in: ['VirtualLocation'], default: 'Place' } }),
      ],
    },
    {
      id: 'offers',
      title: t('票券', 'Tickets'),
      fields: [
        ...offerFields(['offers'], 'recommended'),
        field('offers.validFrom', 'datetime', ['offers', 'validFrom'], { label: t('開賣時間', 'On sale from'), importance: 'optional' }),
      ],
    },
    {
      id: 'people',
      title: t('主辦與表演者', 'Organizer & performers'),
      fields: [
        field('organizer.name', 'text', ['organizer', 'name'], { label: t('主辦單位', 'Organizer'), importance: 'recommended', maxLength: 150 }),
        field('organizer.url', 'url', ['organizer', 'url'], { label: t('主辦單位網址', 'Organizer URL'), importance: 'optional' }),
        field('performer.name', 'text', ['performer', 'name'], { label: t('講者／表演者', 'Performer / speaker'), importance: 'optional', maxLength: 150 }),
      ],
    },
  ],
  checks(node) {
    const issues: AuditIssue[] = [];
    const start = comparableTime(getAt(node, ['startDate']));
    const end = comparableTime(getAt(node, ['endDate']));
    if (start !== undefined && end !== undefined && end < start) {
      issues.push(issue('error', 'end_before_start', t('結束時間早於開始時間。', 'The end time is before the start time.'), { fieldId: 'endDate', path: ['endDate'] }));
    }
    const mode = getAt(node, ['eventAttendanceMode']);
    const locationType = getAt(node, ['location', '@type']);
    if (mode === 'https://schema.org/OnlineEventAttendanceMode' && locationType !== undefined && locationType !== 'VirtualLocation') {
      issues.push(issue('warning', 'online_without_virtual_location', t('線上活動建議把地點類型設為「線上」並填寫活動網址。', 'Online events should use an online location with a URL.'), { fieldId: 'location.@type', path: ['location', '@type'] }));
    }
    return issues;
  },
  learnMore: [googleLink('structured-data/event', '活動（Event）', 'Event'), schemaOrgLink('Event')],
};

export function breadcrumbPositions(node: JsonObject): JsonObject {
  const items = getAt(node, ['itemListElement']);
  if (!Array.isArray(items)) return node;
  const numbered = items.map((item, index) => {
    if (!isJsonObject(item)) return item;
    const { position: _position, ...rest } = item;
    return { '@type': 'ListItem', ...rest, position: index + 1 };
  });
  return { ...node, itemListElement: numbered };
}

export const breadcrumb: SchemaTemplate = {
  id: 'breadcrumb',
  type: 'BreadcrumbList',
  name: t('麵包屑導覽', 'Breadcrumbs'),
  summary: t('標示頁面在網站中的層級位置，讓引擎理解站內脈絡。', 'Show where a page sits in your site hierarchy.'),
  category: 'navigation',
  icon: 'breadcrumb',
  richResult: t('有機會以層級路徑取代搜尋結果中的網址', 'May replace the URL in results with a readable path'),
  nodeTypes: {},
  titlePaths: [],
  sections: [
    {
      id: 'items',
      title: t('層級', 'Levels'),
      description: t('由首頁開始依序排列；最後一層（目前頁面）可以不填網址。順序會自動編號。', 'Start from the homepage; the last level (current page) may omit its URL. Positions are numbered automatically.'),
      fields: [
        {
          id: 'itemListElement',
          kind: 'list',
          path: ['itemListElement'],
          itemType: 'ListItem',
          label: t('層級清單', 'Levels'),
          itemLabel: t('層級', 'Level'),
          addLabel: t('新增層級', 'Add level'),
          importance: 'required',
          minItems: 2,
          maxItems: 12,
          fields: [
            field('name', 'text', ['name'], { label: t('名稱', 'Name'), importance: 'required', maxLength: 120, placeholder: t('例：服務項目', 'e.g. Services') }),
            field('item', 'url', ['item'], { label: t('網址', 'URL'), importance: 'recommended', placeholder: t('https://example.com/services/', 'https://example.com/services/') }),
          ],
        },
      ],
    },
  ],
  starter: (locale, brand) => {
    const home: JsonObject = { '@type': 'ListItem', name: localize(t('首頁', 'Home'), locale) };
    const url = brand ? textOf(getAt(brand, ['url'])) : undefined;
    if (url) home['item'] = url;
    return { itemListElement: [home, { '@type': 'ListItem' }] };
  },
  finalize: breadcrumbPositions,
  checks(node) {
    const issues: AuditIssue[] = [];
    const items = listAt(node, ['itemListElement']).filter(isJsonObject);
    if (items.length === 1) {
      issues.push(issue('warning', 'breadcrumb_short', t('麵包屑通常至少包含 2 層。', 'Breadcrumbs usually have at least two levels.'), { fieldId: 'itemListElement', path: ['itemListElement'] }));
    }
    items.forEach((item, index) => {
      if (index < items.length - 1 && item['item'] === undefined) {
        issues.push(issue('warning', 'breadcrumb_missing_url', fmt('第 {n} 層缺少網址（只有最後一層可以省略）。', 'Level {n} needs a URL (only the last level may omit it).', { n: index + 1 }), { fieldId: 'itemListElement', path: ['itemListElement', index, 'item'] }));
      }
    });
    return issues;
  },
  learnMore: [
    { label: t('TrueLink 部落格：BreadcrumbList 餵 AI 導覽脈絡', 'TrueLink blog: BreadcrumbList gives AI navigation context'), url: 'https://truelink-group.com/blog/breadcrumblist-ai/', publisher: 'truelink', lang: 'zh-TW' },
    googleLink('structured-data/breadcrumb', '麵包屑（BreadcrumbList）', 'Breadcrumb'),
    schemaOrgLink('BreadcrumbList'),
  ],
};

export const thing: SchemaTemplate = {
  id: 'thing',
  type: 'Thing',
  name: t('其他類型', 'Other type'),
  summary: t('匯入或自訂的 Schema.org 類型；可在 JSON-LD 模式完整編輯。', 'Imported or custom Schema.org types, fully editable as JSON-LD.'),
  category: 'other',
  icon: 'code',
  nodeTypes: {},
  titlePaths: [['name'], ['headline']],
  sections: [
    {
      id: 'basics',
      title: t('通用欄位', 'Common properties'),
      description: t('其他屬性會完整保留，請切換到 JSON-LD 模式編輯。', 'Other properties are preserved; edit them in JSON-LD mode.'),
      fields: [
        field('@type', 'text', ['@type'], { label: t('Schema.org 類型', 'Schema.org type'), importance: 'required', maxLength: 80, placeholder: t('例：Course', 'e.g. Course') }),
        fields.name('recommended'),
        fields.description('recommended'),
        fields.url('recommended', { label: t('網址', 'URL') }),
        fields.image('optional'),
        fields.sameAs({ importance: 'optional' }),
      ],
    },
  ],
  learnMore: [{ label: t('Schema.org 全部類型', 'All Schema.org types'), url: 'https://schema.org/docs/full.html', publisher: 'schema.org', lang: 'en' }],
};
