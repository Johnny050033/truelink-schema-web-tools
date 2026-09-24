import { t } from '../formats.js';
import { issue } from '../issues.js';
import { getAt } from '../json.js';
import type { AuditIssue, JsonObject, SchemaTemplate } from '../types.js';
import { field, fields, googleLink, offerFields, schemaOrgLink } from './common.js';

export const service: SchemaTemplate = {
  id: 'service',
  type: 'Service',
  name: t('服務項目', 'Service'),
  summary: t('說明「你做什麼、服務誰、在哪裡」，讓 AI 精準推薦你的服務。', 'What you do, who you serve and where — so AI can recommend you precisely.'),
  category: 'offering',
  icon: 'briefcase',
  nodeTypes: { provider: 'Organization', audience: 'Audience', offers: 'Offer' },
  titlePaths: [['name'], ['serviceType']],
  brandFill: [
    { from: ['name'], to: ['provider', 'name'] },
    { from: ['url'], to: ['provider', 'url'] },
  ],
  sections: [
    {
      id: 'basics',
      title: t('服務內容', 'Service'),
      fields: [
        fields.name('required', { label: t('服務名稱', 'Service name'), placeholder: t('例：企業 Schema 結構化資料建置', 'e.g. Structured data implementation') }),
        field('serviceType', 'text', ['serviceType'], { label: t('服務類別', 'Service type'), importance: 'recommended', maxLength: 120, placeholder: t('例：網站技術 SEO', 'e.g. Technical SEO'), why: t('服務類別幫助 AI 把你歸入正確的比較清單。', 'A service type helps AI place you in the right comparisons.') }),
        fields.description('recommended', { placeholder: t('服務流程、交付內容與特色。', 'Process, deliverables and differentiators.') }),
        fields.url('recommended', { label: t('服務頁網址', 'Service page URL') }),
        fields.image('optional'),
      ],
    },
    {
      id: 'audience',
      title: t('提供者與服務對象', 'Provider & audience'),
      description: t('「誰提供、服務誰、在哪裡」是 AI 推薦服務時最常比對的條件。', 'Who provides it, for whom, and where — the conditions AI compares most.'),
      fields: [
        field('provider.name', 'text', ['provider', 'name'], { label: t('提供者', 'Provider'), importance: 'recommended', maxLength: 150 }),
        field('provider.url', 'url', ['provider', 'url'], { label: t('提供者網址', 'Provider URL'), importance: 'optional' }),
        field('areaServed', 'text', ['areaServed'], { label: t('服務地區', 'Area served'), importance: 'recommended', maxLength: 200, placeholder: t('例：台灣全區', 'e.g. United States'), why: t('服務地區讓在地搜尋與 AI 推薦更準確。', 'Service areas make local recommendations more accurate.') }),
        field('audience.audienceType', 'text', ['audience', 'audienceType'], { label: t('服務對象', 'Audience'), importance: 'recommended', maxLength: 150, placeholder: t('例：中小企業行銷團隊', 'e.g. small business marketers') }),
      ],
    },
    {
      id: 'pricing',
      title: t('價格（選填）', 'Pricing (optional)'),
      fields: offerFields(['offers'], 'optional').filter((item) => item.id !== 'offers.availability'),
    },
  ],
  checks(node) {
    return currencyChecks(node);
  },
  learnMore: [schemaOrgLink('Service')],
};

export const product: SchemaTemplate = {
  id: 'product',
  type: 'Product',
  name: t('產品', 'Product'),
  summary: t('商品名稱、圖片、品牌與價格，適合電商與產品頁。', 'Name, images, brand and price for product pages.'),
  category: 'offering',
  icon: 'box',
  richResult: t('有機會顯示價格與供貨狀態等產品資訊', 'May show price and availability in results'),
  nodeTypes: { brand: 'Brand', offers: 'Offer' },
  titlePaths: [['name']],
  brandFill: [{ from: ['name'], to: ['brand', 'name'] }],
  sections: [
    {
      id: 'basics',
      title: t('產品資訊', 'Product details'),
      fields: [
        fields.name('required', { label: t('產品名稱', 'Product name'), placeholder: t('例：衣索比亞 耶加雪菲 淺焙咖啡豆 227g', 'e.g. Ethiopia Yirgacheffe light roast 227 g') }),
        fields.description('recommended', { placeholder: t('規格、材質、適用情境與差異化特色。', 'Specs, materials, use cases and differentiators.') }),
        fields.image('recommended', { multiple: true, label: t('產品圖片網址', 'Product image URLs'), help: t('可放多張不同比例的圖片（1:1、4:3、16:9）。本工具不會下載外部圖片。', 'Multiple aspect ratios (1:1, 4:3, 16:9) are ideal. Remote images are never downloaded.') }),
        field('brand.name', 'text', ['brand', 'name'], { label: t('品牌', 'Brand'), importance: 'recommended', maxLength: 120 }),
        field('sku', 'text', ['sku'], { label: t('商品編號（SKU）', 'SKU'), importance: 'optional', maxLength: 80 }),
        field('gtin', 'text', ['gtin'], { label: t('國際條碼（GTIN／EAN）', 'GTIN / EAN'), importance: 'optional', maxLength: 20, help: t('有商品條碼時建議填寫，方便比對同一商品。', 'Helps engines match the exact product when available.') }),
        field('category', 'text', ['category'], { label: t('商品分類', 'Category'), importance: 'optional', maxLength: 120 }),
      ],
    },
    {
      id: 'offer',
      title: t('價格與供貨', 'Price & availability'),
      description: t('本工具不提供評分與評論欄位：評論須來自真實顧客，請勿自行產生。', 'This tool has no rating or review fields: reviews must come from real customers.'),
      fields: [
        ...offerFields(['offers'], 'recommended'),
        field('offers.itemCondition', 'select', ['offers', 'itemCondition'], {
          label: t('商品狀況', 'Condition'),
          importance: 'optional',
          options: [
            { value: 'https://schema.org/NewCondition', label: t('全新', 'New') },
            { value: 'https://schema.org/UsedCondition', label: t('二手', 'Used') },
            { value: 'https://schema.org/RefurbishedCondition', label: t('整新品', 'Refurbished') },
          ],
        }),
        field('offers.priceValidUntil', 'date', ['offers', 'priceValidUntil'], { label: t('價格有效期限', 'Price valid until'), importance: 'optional' }),
      ],
    },
  ],
  checks(node) {
    const issues = currencyChecks(node);
    if (getAt(node, ['offers']) === undefined) {
      issues.push(issue('info', 'no_offer', t('未提供價格資訊時，產品通常不符合價格類複合式結果的資格。', 'Without an offer, products usually are not eligible for price-based rich results.'), { fieldId: 'offers.price', path: ['offers'] }));
    }
    return issues;
  },
  learnMore: [googleLink('structured-data/product-snippet', '產品摘要（Product snippet）', 'Product snippet'), schemaOrgLink('Product')],
};

export function currencyChecks(node: JsonObject): AuditIssue[] {
  const price = getAt(node, ['offers', 'price']);
  const currency = getAt(node, ['offers', 'priceCurrency']);
  if (price !== undefined && currency === undefined) {
    return [issue('error', 'currency_missing', t('已填價格但缺少幣別。', 'A price needs a currency.'), { fieldId: 'offers.priceCurrency', path: ['offers', 'priceCurrency'] })];
  }
  if (price === undefined && currency !== undefined) {
    return [issue('warning', 'price_missing', t('已選幣別但缺少價格。', 'A currency is set without a price.'), { fieldId: 'offers.price', path: ['offers', 'price'] })];
  }
  return [];
}
