import { formatWallClock } from './formats.js';
import { getAt, isJsonObject, listAt, textOf, textsOf } from './json.js';
import { buildOutput } from './output.js';
import { classifyProfile, platformName, type PlatformId } from './platforms.js';
import { countryOptions, dayOptions, languageOptions } from './templates/common.js';
import { isFieldVisible, templateFields, typeLabel } from './templates/index.js';
import type { JsonObject, Locale, ScalarField, SchemaTemplate } from './types.js';

export interface EntityFact {
  readonly fieldId: string;
  readonly label: string;
  readonly value: string;
}

export interface EntityProfile {
  readonly platform: PlatformId;
  readonly name: string;
  readonly url: string;
}

/**
 * A deterministic, template-based reading of the structured data. It illustrates
 * what machines can learn from the markup; it is not output from any AI system.
 */
export interface EntityDescription {
  readonly name: string | undefined;
  readonly typeLabel: string;
  readonly summary: string | undefined;
  readonly sentences: readonly string[];
  readonly facts: readonly EntityFact[];
  readonly profiles: readonly EntityProfile[];
}

const SKIP_FACTS = new Set(['name', 'headline', 'description', 'sameAs', 'image', 'logo', '@id', '@type', 'alternateName']);

function joinList(items: readonly string[], locale: Locale): string {
  if (locale === 'zh-TW') return items.join('、');
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function optionLabel(options: readonly { value: string; label: Record<Locale, string> }[], value: string | undefined, locale: Locale): string | undefined {
  if (!value) return undefined;
  return options.find((option) => option.value === value)?.label[locale] ?? value;
}

export function formatAddress(node: JsonObject, path: readonly string[], locale: Locale, withStreet = true): string | undefined {
  const address = getAt(node, path);
  if (typeof address === 'string') return address.trim() || undefined;
  if (!isJsonObject(address)) return undefined;
  const street = withStreet ? textOf(address['streetAddress']) : undefined;
  const locality = textOf(address['addressLocality']);
  const region = textOf(address['addressRegion']);
  const postal = withStreet ? textOf(address['postalCode']) : undefined;
  const countryCode = textOf(address['addressCountry']);
  if (locale === 'zh-TW') {
    const text = [region, locality, street].filter(Boolean).join('');
    return text || (countryCode ? optionLabel(countryOptions, countryCode, locale)?.replace(/（.*）$/, '') : undefined);
  }
  const parts = [street, locality, [region, postal].filter(Boolean).join(' ') || undefined].filter(Boolean);
  if (!withStreet && countryCode && parts.length === 0) return optionLabel(countryOptions, countryCode, locale)?.replace(/ \(.*\)$/, '');
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function dayLabel(value: string, locale: Locale): string {
  const plain = value.replace(/^https?:\/\/schema\.org\//, '');
  return dayOptions.find((option) => option.value === plain)?.label[locale] ?? plain;
}

function dayRange(days: readonly string[], locale: Locale): string {
  const order = dayOptions.map((option) => option.value);
  const indexes = days.map((day) => order.indexOf(day.replace(/^https?:\/\/schema\.org\//, ''))).filter((index) => index >= 0).sort((a, b) => a - b);
  const consecutive = indexes.length >= 3 && indexes.every((value, index) => index === 0 || value === indexes[index - 1]! + 1);
  if (consecutive) {
    const first = dayLabel(order[indexes[0]!]!, locale);
    const last = dayLabel(order[indexes[indexes.length - 1]!]!, locale);
    return locale === 'zh-TW' ? `${first}至${last}` : `${first}–${last}`;
  }
  return joinList(days.map((day) => dayLabel(day, locale)), locale);
}

export function summarizeHours(node: JsonObject, locale: Locale): string | undefined {
  const slots = listAt(node, ['openingHoursSpecification']).filter(isJsonObject);
  const parts = slots.map((slot) => {
    const days = textsOf(slot['dayOfWeek']);
    const opens = textOf(slot['opens']);
    const closes = textOf(slot['closes']);
    if (days.length === 0 || !opens || !closes) return undefined;
    return `${dayRange(days, locale)} ${opens}–${closes}`;
  }).filter((part): part is string => part !== undefined);
  return parts.length > 0 ? parts.join(locale === 'zh-TW' ? '；' : '; ') : undefined;
}

function name(node: JsonObject, template: SchemaTemplate): string | undefined {
  for (const path of template.titlePaths) {
    const value = textOf(getAt(node, path));
    if (value) return value;
  }
  return undefined;
}

function sentence(locale: Locale, zh: string | false | undefined, en: string | false | undefined): string | undefined {
  const value = locale === 'zh-TW' ? zh : en;
  return value ? value : undefined;
}

function entitySentences(template: SchemaTemplate, node: JsonObject, locale: Locale, label: string, displayName: string, domain: string | undefined, profiles: readonly EntityProfile[]): (string | undefined)[] {
  const text = (...path: string[]) => textOf(getAt(node, path));
  const zh = locale === 'zh-TW';
  const out: (string | undefined)[] = [];
  const alt = text('alternateName');
  const place = formatAddress(node, ['address'], locale, false);
  const lower = label.toLowerCase();
  out.push(zh
    ? `${displayName}${alt ? `（${alt}）` : ''}是${place ? `位於${place}的` : ''}${label}。`
    : `${displayName}${alt ? ` (${alt})` : ''} is ${article(lower)} ${lower}${place ? ` based in ${place}` : ''}.`);
  const founded = text('foundingDate')?.slice(0, 4);
  const founder = text('founder', 'name');
  if (founded || founder) {
    out.push(sentence(locale,
      `${founded ? `成立於 ${founded} 年` : ''}${founded && founder ? '，' : ''}${founder ? `創辦人為${founder}` : ''}。`,
      `${founded ? `Founded in ${founded}` : 'Founded'}${founder ? ` by ${founder}` : ''}.`));
  }
  const expertise = textsOf(getAt(node, ['knowsAbout']));
  if (expertise.length > 0) out.push(sentence(locale, `專長領域包括${joinList(expertise, locale)}。`, `Areas of expertise include ${joinList(expertise, locale)}.`));
  if (template.id === 'local-business') {
    const cuisine = textsOf(getAt(node, ['servesCuisine']));
    if (cuisine.length > 0) out.push(sentence(locale, `供應${joinList(cuisine, locale)}。`, `Serves ${joinList(cuisine, locale)}.`));
    const hours = summarizeHours(node, locale);
    if (hours) out.push(sentence(locale, `營業時間：${hours}。`, `Open ${hours}.`));
    const price = text('priceRange');
    if (price) out.push(sentence(locale, `價格區間約 ${price}。`, `Price range: ${price}.`));
  }
  const phone = text('telephone');
  if (phone) out.push(sentence(locale, `聯絡電話 ${phone}。`, `Phone: ${phone}.`));
  if (domain || profiles.length > 0) {
    const names = [...new Set(profiles.map((profile) => profile.name))];
    out.push(zh
      ? `${domain ? `官方網站為 ${domain}` : ''}${domain && names.length ? '，並' : ''}${names.length ? `在 ${joinList(names, locale)} 設有官方頁面` : ''}。`
      : `${domain ? `Official website: ${domain}` : ''}${domain && names.length ? '; ' : ''}${names.length ? `official profiles on ${joinList(names, locale)}` : ''}.`);
  }
  return out;
}

function sentencesFor(template: SchemaTemplate, node: JsonObject, locale: Locale, label: string, displayName: string | undefined, profiles: readonly EntityProfile[]): string[] {
  const text = (...path: string[]) => textOf(getAt(node, path));
  const zh = locale === 'zh-TW';
  const domain = domainOf(text('url'));
  const shown = displayName ?? (zh ? '此項目' : 'This item');
  let out: (string | undefined)[] = [];
  switch (template.id) {
    case 'organization':
    case 'local-business':
      out = entitySentences(template, node, locale, label, shown, domain, profiles);
      break;
    case 'person': {
      const job = text('jobTitle');
      const employer = text('worksFor', 'name');
      out.push(zh
        ? `${shown}是${employer ? `${employer}的` : ''}${job ?? '專業人士'}。`
        : `${shown} is ${job ? `${article(job)} ${job}` : 'a professional'}${employer ? ` at ${employer}` : ''}.`);
      const expertise = textsOf(getAt(node, ['knowsAbout']));
      if (expertise.length) out.push(sentence(locale, `專長領域包括${joinList(expertise, locale)}。`, `Areas of expertise include ${joinList(expertise, locale)}.`));
      const alumni = text('alumniOf', 'name');
      if (alumni) out.push(sentence(locale, `畢業於${alumni}。`, `Alumni of ${alumni}.`));
      const awards = textsOf(getAt(node, ['award']));
      if (awards.length) out.push(sentence(locale, `曾獲${joinList(awards, locale)}。`, `Recognized with ${joinList(awards, locale)}.`));
      if (profiles.length) out.push(sentence(locale, `可在 ${joinList([...new Set(profiles.map((item) => item.name))], locale)} 找到其官方頁面。`, `Official profiles: ${joinList([...new Set(profiles.map((item) => item.name))], locale)}.`));
      break;
    }
    case 'website': {
      const publisher = text('publisher', 'name');
      const language = optionLabel(languageOptions, text('inLanguage'), locale)?.replace(/[（(].*[)）]$/, '').trim();
      out.push(zh
        ? `${shown}是${publisher ? `${publisher}的` : ''}官方網站${domain ? `（${domain}）` : ''}${language ? `，主要語言為${language}` : ''}。`
        : `${shown} is the official website${publisher ? ` of ${publisher}` : ''}${domain ? ` (${domain})` : ''}${language ? `, primarily in ${language}` : ''}.`);
      break;
    }
    case 'service': {
      const provider = text('provider', 'name');
      const type = text('serviceType');
      out.push(zh
        ? `${provider ? `${provider}提供` : ''}「${shown}」${type ? `（${type}）` : ''}服務。`
        : `${shown}${type ? ` (${type})` : ''} is a service${provider ? ` provided by ${provider}` : ''}.`);
      const area = text('areaServed');
      if (area) out.push(sentence(locale, `服務地區：${area}。`, `Area served: ${area}.`));
      const audience = text('audience', 'audienceType');
      if (audience) out.push(sentence(locale, `主要服務對象為${audience}。`, `Designed for ${audience}.`));
      break;
    }
    case 'product': {
      const brand = text('brand', 'name');
      const price = text('offers', 'price');
      const currency = text('offers', 'priceCurrency');
      const availability = text('offers', 'availability');
      const availabilityText = availability ? templateFields(template).map(({ field }) => field).find((item): item is ScalarField => item.id === 'offers.availability')?.options?.find((option) => option.value === availability)?.label[locale] : undefined;
      out.push(zh
        ? `「${shown}」是${brand ? `${brand}的` : ''}產品${price ? `，售價 ${currency ?? ''} ${price}`.replace('  ', ' ') : ''}${availabilityText ? `（${availabilityText}）` : ''}。`
        : `${shown} is a product${brand ? ` by ${brand}` : ''}${price ? `, priced at ${currency ? `${currency} ` : ''}${price}` : ''}${availabilityText ? ` (${availabilityText.toLowerCase()})` : ''}.`);
      break;
    }
    case 'article': {
      const author = text('author', 'name');
      const publisher = text('publisher', 'name');
      const published = text('datePublished');
      const date = published ? formatWallClock(published, locale).split(' ')[0] : undefined;
      const lower = label.toLowerCase();
      out.push(zh
        ? `「${shown}」是一篇${author ? `由${author}撰寫、` : ''}${publisher ? `${publisher}發布的` : ''}${label}${date ? `，發布於 ${date}` : ''}。`
        : `"${shown}" is ${article(lower)} ${lower}${author ? ` by ${author}` : ''}${publisher ? `, published by ${publisher}` : ''}${date ? ` on ${date}` : ''}.`);
      break;
    }
    case 'faq': {
      const questions = listAt(node, ['mainEntity']).filter(isJsonObject).map((item) => textOf(item['name'])).filter((item): item is string => item !== undefined);
      if (questions.length) {
        out.push(zh
          ? `此頁面提供 ${questions.length} 組官方問答，例如「${questions[0]}」。`
          : `This page answers ${questions.length} question${questions.length === 1 ? '' : 's'}, such as "${questions[0]}".`);
      }
      break;
    }
    case 'event': {
      const start = text('startDate');
      const when = start ? formatWallClock(start, locale) : undefined;
      const online = getAt(node, ['location', '@type']) === 'VirtualLocation';
      const venue = online ? undefined : text('location', 'name') ?? formatAddress(node, ['location', 'address'], locale, false);
      const organizer = text('organizer', 'name');
      const cancelled = text('eventStatus') === 'https://schema.org/EventCancelled';
      if (!when && !venue && !online) {
        const lower = label.toLowerCase();
        out.push(zh ? `「${shown}」是一場${label}${organizer ? `，由${organizer}主辦` : ''}${cancelled ? '（已取消）' : ''}。` : `${shown} is ${article(lower)} ${lower}${organizer ? ` organized by ${organizer}` : ''}${cancelled ? ' (cancelled)' : ''}.`);
        break;
      }
      out.push(zh
        ? `「${shown}」${when ? `將於 ${when} ` : ''}${venue ? `在${venue}` : online ? '以線上方式' : ''}舉行${organizer ? `，由${organizer}主辦` : ''}${cancelled ? '（已取消）' : ''}。`
        : `${shown} takes place${when ? ` on ${when}` : ''}${venue ? ` at ${venue}` : online ? ' online' : ''}${organizer ? `, organized by ${organizer}` : ''}${cancelled ? ' (cancelled)' : ''}.`);
      const price = text('offers', 'price');
      if (price) out.push(sentence(locale, `票價 ${text('offers', 'priceCurrency') ?? ''} ${price}。`.replace('  ', ' '), `Tickets: ${text('offers', 'priceCurrency') ?? ''} ${price}.`.replace('  ', ' ')));
      break;
    }
    case 'breadcrumb': {
      const names = listAt(node, ['itemListElement']).filter(isJsonObject).map((item) => textOf(item['name'])).filter((item): item is string => item !== undefined);
      if (names.length) out.push(sentence(locale, `此頁面在網站中的位置：${names.join(' › ')}。`, `Page location: ${names.join(' › ')}.`));
      break;
    }
    default: {
      out.push(zh ? `${shown}是 ${label} 類型的項目。` : `${shown} is ${article(label)} ${label}.`);
    }
  }
  return out.filter((item): item is string => item !== undefined);
}

function factValue(field: ScalarField, node: JsonObject, locale: Locale): string | undefined {
  const raw = getAt(node, field.path);
  if (raw === undefined) return undefined;
  if (field.kind === 'days') return undefined;
  const values = textsOf(raw);
  if (values.length === 0) return undefined;
  const mapped = values.map((value) => {
    if (field.options) return optionLabel(field.options, value, locale) ?? value;
    if (field.kind === 'datetime' || field.kind === 'date') return formatWallClock(value, locale);
    return value;
  });
  return joinList(mapped, locale);
}

export function describeDocument(template: SchemaTemplate, data: JsonObject, locale: Locale): EntityDescription {
  const node = buildOutput(data, template);
  const displayName = name(node, template);
  const label = typeLabel(template, node, locale);
  const profiles: EntityProfile[] = textsOf(getAt(node, ['sameAs'])).map((url) => {
    const platform = classifyProfile(url);
    return { platform, name: platformName(platform, url), url };
  });
  const facts: EntityFact[] = [];
  for (const { field } of templateFields(template)) {
    if (field.kind === 'list') {
      if (field.id === 'openingHoursSpecification') {
        const hours = summarizeHours(node, locale);
        if (hours) facts.push({ fieldId: field.id, label: field.label[locale], value: hours });
      }
      continue;
    }
    if (SKIP_FACTS.has(field.id) || !isFieldVisible(field, data)) continue;
    if (field.path[0] === 'address' || (field.path[0] === 'location' && field.path[1] === 'address')) continue;
    const value = factValue(field, node, locale);
    if (value) facts.push({ fieldId: field.id, label: field.label[locale], value });
  }
  const addressPath = template.id === 'event' ? ['location', 'address'] : ['address'];
  const address = formatAddress(node, addressPath, locale);
  if (address) facts.unshift({ fieldId: `${addressPath.join('.')}.streetAddress`, label: locale === 'zh-TW' ? '地址' : 'Address', value: address });
  return {
    name: displayName,
    typeLabel: label,
    summary: textOf(getAt(node, ['description'])),
    sentences: sentencesFor(template, node, locale, label, displayName, profiles),
    facts: facts.slice(0, 12),
    profiles,
  };
}
