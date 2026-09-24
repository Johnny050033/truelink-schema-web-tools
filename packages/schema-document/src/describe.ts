import { formatWallClock, t } from './formats.js';
import { fill, isCjk, isSourceLocale, joinList, localize } from './i18n.js';
import { getAt, isJsonObject, listAt, textOf, textsOf } from './json.js';
import { buildOutput } from './output.js';
import { classifyProfile, platformName, type PlatformId } from './platforms.js';
import { countryOptions, dayOptions, languageOptions } from './templates/common.js';
import { isFieldVisible, templateFields, typeLabel } from './templates/index.js';
import type { FieldOption, JsonObject, Locale, ScalarField, SchemaTemplate } from './types.js';

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

type Vars = Readonly<Record<string, string | number>>;

/**
 * One sentence (or sentence part) for a locale. Translators can reorder slots; optional parts
 * are separate templates that may be empty. Slots named like `aLabel` carry an English article
 * and are for English only; other languages use the plain `label`.
 */
function say(locale: Locale, zh: string, en: string, vars: Vars = {}): string {
  return fill(localize(t(zh, en), locale), vars);
}

function part(locale: Locale, when: unknown, zh: string, en: string, vars: Vars = {}): string {
  return when ? say(locale, zh, en, vars) : '';
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? 'an' : 'a';
}

/** "an event", "a restaurant": used only by English templates. */
function withArticle(word: string): string {
  return `${article(word)} ${word}`;
}

/** Type labels read as common nouns inside sentences, so Latin-script translations lower-case them. */
function labelInSentence(label: string, locale: Locale): string {
  return isSourceLocale(locale) || isCjk(locale) ? label : label.toLocaleLowerCase(locale);
}

export function domainOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return undefined;
  }
}

function optionLabel(options: readonly FieldOption[], value: string | undefined, locale: Locale): string | undefined {
  if (!value) return undefined;
  const option = options.find((item) => item.value === value);
  return option ? localize(option.label, locale) : value;
}

function withoutCode(label: string | undefined): string | undefined {
  return label?.replace(/\s*[（(][^（()）]*[)）]$/, '');
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
  // Chinese and Japanese addresses run from the largest unit to the smallest, without separators.
  if (isCjk(locale)) {
    const text = [region, locality, street].filter(Boolean).join('');
    return text || (countryCode ? withoutCode(optionLabel(countryOptions, countryCode, locale)) : undefined);
  }
  const parts = [street, locality, [region, postal].filter(Boolean).join(' ') || undefined].filter(Boolean);
  if (!withStreet && countryCode && parts.length === 0) return withoutCode(optionLabel(countryOptions, countryCode, locale));
  return parts.length > 0 ? parts.join(', ') : undefined;
}

function dayLabel(value: string, locale: Locale): string {
  const plain = value.replace(/^https?:\/\/schema\.org\//, '');
  return optionLabel(dayOptions, plain, locale) ?? plain;
}

function dayRange(days: readonly string[], locale: Locale): string {
  const order = dayOptions.map((option) => option.value);
  const indexes = days.map((day) => order.indexOf(day.replace(/^https?:\/\/schema\.org\//, ''))).filter((index) => index >= 0).sort((a, b) => a - b);
  const consecutive = indexes.length >= 3 && indexes.every((value, index) => index === 0 || value === indexes[index - 1]! + 1);
  if (consecutive) {
    const first = dayLabel(order[indexes[0]!]!, locale);
    const last = dayLabel(order[indexes[indexes.length - 1]!]!, locale);
    return say(locale, '{first}至{last}', '{first}–{last}', { first, last });
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
  }).filter((item): item is string => item !== undefined);
  return parts.length > 0 ? parts.join(localize(t('；', '; '), locale)) : undefined;
}

function name(node: JsonObject, template: SchemaTemplate): string | undefined {
  for (const path of template.titlePaths) {
    const value = textOf(getAt(node, path));
    if (value) return value;
  }
  return undefined;
}

function entitySentences(template: SchemaTemplate, node: JsonObject, locale: Locale, label: string, displayName: string, domain: string | undefined, profiles: readonly EntityProfile[]): string[] {
  const text = (...path: string[]) => textOf(getAt(node, path));
  const out: string[] = [];
  const alt = text('alternateName');
  const place = formatAddress(node, ['address'], locale, false);
  const vars = { name: displayName, alt: alt ?? '', place: place ?? '', label, aLabel: withArticle(label.toLowerCase()) };
  if (alt && place) out.push(say(locale, '{name}（{alt}）是位於{place}的{label}。', '{name} ({alt}) is {aLabel} based in {place}.', vars));
  else if (alt) out.push(say(locale, '{name}（{alt}）是{label}。', '{name} ({alt}) is {aLabel}.', vars));
  else if (place) out.push(say(locale, '{name}是位於{place}的{label}。', '{name} is {aLabel} based in {place}.', vars));
  else out.push(say(locale, '{name}是{label}。', '{name} is {aLabel}.', vars));

  const year = text('foundingDate')?.slice(0, 4);
  const founder = text('founder', 'name');
  if (year && founder) out.push(say(locale, '成立於 {year} 年，創辦人為{founder}。', 'Founded in {year} by {founder}.', { year, founder }));
  else if (year) out.push(say(locale, '成立於 {year} 年。', 'Founded in {year}.', { year }));
  else if (founder) out.push(say(locale, '創辦人為{founder}。', 'Founded by {founder}.', { founder }));

  const expertise = textsOf(getAt(node, ['knowsAbout']));
  if (expertise.length > 0) out.push(say(locale, '專長領域包括{list}。', 'Areas of expertise include {list}.', { list: joinList(expertise, locale) }));
  if (template.id === 'local-business') {
    const cuisine = textsOf(getAt(node, ['servesCuisine']));
    if (cuisine.length > 0) out.push(say(locale, '供應{list}。', 'Serves {list}.', { list: joinList(cuisine, locale) }));
    const hours = summarizeHours(node, locale);
    if (hours) out.push(say(locale, '營業時間：{hours}。', 'Open {hours}.', { hours }));
    const price = text('priceRange');
    if (price) out.push(say(locale, '價格區間約 {price}。', 'Price range: {price}.', { price }));
  }
  const phone = text('telephone');
  if (phone) out.push(say(locale, '聯絡電話 {phone}。', 'Phone: {phone}.', { phone }));
  const names = [...new Set(profiles.map((profile) => profile.name))];
  const list = joinList(names, locale);
  if (domain && names.length > 0) out.push(say(locale, '官方網站為 {domain}，並在 {list} 設有官方頁面。', 'Official website: {domain}; official profiles on {list}.', { domain, list }));
  else if (domain) out.push(say(locale, '官方網站為 {domain}。', 'Official website: {domain}.', { domain }));
  else if (names.length > 0) out.push(say(locale, '在 {list} 設有官方頁面。', 'Official profiles on {list}.', { list }));
  return out;
}

function sentencesFor(template: SchemaTemplate, node: JsonObject, locale: Locale, label: string, displayName: string | undefined, profiles: readonly EntityProfile[]): string[] {
  const text = (...path: string[]) => textOf(getAt(node, path));
  const domain = domainOf(text('url'));
  const shown = displayName ?? localize(t('此項目', 'This item'), locale);
  const aLabel = withArticle(label.toLowerCase());
  const inline = labelInSentence(label, locale);
  const out: string[] = [];
  switch (template.id) {
    case 'organization':
    case 'local-business':
      return entitySentences(template, node, locale, inline, shown, domain, profiles);
    case 'person': {
      const job = text('jobTitle');
      const employer = text('worksFor', 'name');
      const vars = { name: shown, job: job ?? '', employer: employer ?? '', aJob: job ? withArticle(job) : '' };
      if (job && employer) out.push(say(locale, '{name}是{employer}的{job}。', '{name} is {aJob} at {employer}.', vars));
      else if (job) out.push(say(locale, '{name}是{job}。', '{name} is {aJob}.', vars));
      else if (employer) out.push(say(locale, '{name}是{employer}的專業人士。', '{name} is a professional at {employer}.', vars));
      else out.push(say(locale, '{name}是專業人士。', '{name} is a professional.', vars));
      const expertise = textsOf(getAt(node, ['knowsAbout']));
      if (expertise.length) out.push(say(locale, '專長領域包括{list}。', 'Areas of expertise include {list}.', { list: joinList(expertise, locale) }));
      const alumni = text('alumniOf', 'name');
      if (alumni) out.push(say(locale, '畢業於{alumni}。', 'Alumni of {alumni}.', { alumni }));
      const awards = textsOf(getAt(node, ['award']));
      if (awards.length) out.push(say(locale, '曾獲{list}。', 'Recognized with {list}.', { list: joinList(awards, locale) }));
      if (profiles.length) out.push(say(locale, '可在 {list} 找到其官方頁面。', 'Official profiles: {list}.', { list: joinList([...new Set(profiles.map((item) => item.name))], locale) }));
      break;
    }
    case 'website': {
      const publisher = text('publisher', 'name');
      const language = withoutCode(optionLabel(languageOptions, text('inLanguage'), locale))?.trim();
      out.push(say(locale, '{name}是{publisherPart}官方網站{domainPart}{languagePart}。', '{name} is the official website{publisherPart}{domainPart}{languagePart}.', {
        name: shown,
        publisherPart: part(locale, publisher, '{publisher}的', ' of {publisher}', { publisher: publisher ?? '' }),
        domainPart: part(locale, domain, '（{domain}）', ' ({domain})', { domain: domain ?? '' }),
        languagePart: part(locale, language, '，主要語言為{language}', ', primarily in {language}', { language: language ?? '' }),
      }));
      break;
    }
    case 'service': {
      const provider = text('provider', 'name');
      const type = text('serviceType');
      out.push(say(locale, '{providerPart}「{name}」{typePart}服務。', '{name}{typePart} is a service{providerPart}.', {
        name: shown,
        providerPart: part(locale, provider, '{provider}提供', ' provided by {provider}', { provider: provider ?? '' }),
        typePart: part(locale, type, '（{type}）', ' ({type})', { type: type ?? '' }),
      }));
      const area = text('areaServed');
      if (area) out.push(say(locale, '服務地區：{area}。', 'Area served: {area}.', { area }));
      const audience = text('audience', 'audienceType');
      if (audience) out.push(say(locale, '主要服務對象為{audience}。', 'Designed for {audience}.', { audience }));
      break;
    }
    case 'product': {
      const brand = text('brand', 'name');
      const price = text('offers', 'price');
      const currency = text('offers', 'priceCurrency');
      const availability = text('offers', 'availability');
      const availabilityField = templateFields(template).map(({ field }) => field).find((item): item is ScalarField => item.id === 'offers.availability');
      const availabilityOption = availability ? availabilityField?.options?.find((option) => option.value === availability) : undefined;
      const availabilityText = availabilityOption ? localize(availabilityOption.label, locale) : undefined;
      out.push(say(locale, '「{name}」是{brandPart}產品{pricePart}{availabilityPart}。', '{name} is a product{brandPart}{pricePart}{availabilityPart}.', {
        name: shown,
        brandPart: part(locale, brand, '{brand}的', ' by {brand}', { brand: brand ?? '' }),
        pricePart: part(locale, price, '，售價 {amount}', ', priced at {amount}', { amount: currency ? `${currency} ${price}` : (price ?? '') }),
        availabilityPart: part(locale, availabilityText, '（{availability}）', ' ({availability})', {
          availability: locale === 'en' ? (availabilityText ?? '').toLowerCase() : (availabilityText ?? ''),
        }),
      }));
      break;
    }
    case 'article': {
      const author = text('author', 'name');
      const publisher = text('publisher', 'name');
      const published = text('datePublished');
      const date = published ? formatWallClock(published, locale).split(' ')[0] : undefined;
      out.push(say(locale, '「{name}」是一篇{authorPart}{publisherPart}{label}{datePart}。', '"{name}" is {aLabel}{authorPart}{publisherPart}{datePart}.', {
        name: shown,
        label: inline,
        aLabel,
        authorPart: part(locale, author, '由{author}撰寫、', ' by {author}', { author: author ?? '' }),
        publisherPart: part(locale, publisher, '{publisher}發布的', ', published by {publisher}', { publisher: publisher ?? '' }),
        datePart: part(locale, date, '，發布於 {date}', ' on {date}', { date: date ?? '' }),
      }));
      break;
    }
    case 'faq': {
      const questions = listAt(node, ['mainEntity']).filter(isJsonObject).map((item) => textOf(item['name'])).filter((item): item is string => item !== undefined);
      if (questions.length === 1) out.push(say(locale, '此頁面提供 {count} 組官方問答，例如「{question}」。', 'This page answers {count} question, such as "{question}".', { count: 1, question: questions[0]! }));
      else if (questions.length > 1) out.push(say(locale, '此頁面提供 {count} 組官方問答，例如「{question}」。', 'This page answers {count} questions, such as "{question}".', { count: questions.length, question: questions[0]! }));
      break;
    }
    case 'event': {
      const start = text('startDate');
      const when = start ? formatWallClock(start, locale) : undefined;
      const online = getAt(node, ['location', '@type']) === 'VirtualLocation';
      const venue = online ? undefined : text('location', 'name') ?? formatAddress(node, ['location', 'address'], locale, false);
      const organizer = text('organizer', 'name');
      const cancelled = text('eventStatus') === 'https://schema.org/EventCancelled';
      const cancelledPart = part(locale, cancelled, '（已取消）', ' (cancelled)');
      if (!when && !venue && !online) {
        out.push(say(locale, '「{name}」是一場{label}{organizerPart}{cancelledPart}。', '{name} is {aLabel}{organizerPart}{cancelledPart}.', {
          name: shown,
          label: inline,
          aLabel,
          organizerPart: part(locale, organizer, '，由{organizer}主辦', ' organized by {organizer}', { organizer: organizer ?? '' }),
          cancelledPart,
        }));
        break;
      }
      out.push(say(locale, '「{name}」{whenPart}{wherePart}舉行{organizerPart}{cancelledPart}。', '{name} takes place{whenPart}{wherePart}{organizerPart}{cancelledPart}.', {
        name: shown,
        whenPart: part(locale, when, '將於 {when} ', ' on {when}', { when: when ?? '' }),
        wherePart: venue ? say(locale, '在{venue}', ' at {venue}', { venue }) : part(locale, online, '以線上方式', ' online'),
        organizerPart: part(locale, organizer, '，由{organizer}主辦', ', organized by {organizer}', { organizer: organizer ?? '' }),
        cancelledPart,
      }));
      const price = text('offers', 'price');
      const currency = text('offers', 'priceCurrency');
      if (price) out.push(say(locale, '票價 {amount}。', 'Tickets: {amount}.', { amount: currency ? `${currency} ${price}` : price }));
      break;
    }
    case 'breadcrumb': {
      const names = listAt(node, ['itemListElement']).filter(isJsonObject).map((item) => textOf(item['name'])).filter((item): item is string => item !== undefined);
      if (names.length) out.push(say(locale, '此頁面在網站中的位置：{path}。', 'Page location: {path}.', { path: names.join(' › ') }));
      break;
    }
    default:
      out.push(say(locale, '{name}是 {label} 類型的項目。', '{name} is {aType}.', { name: shown, label: inline, aType: withArticle(label) }));
  }
  return out;
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
        if (hours) facts.push({ fieldId: field.id, label: localize(field.label, locale), value: hours });
      }
      continue;
    }
    if (SKIP_FACTS.has(field.id) || !isFieldVisible(field, data)) continue;
    if (field.path[0] === 'address' || (field.path[0] === 'location' && field.path[1] === 'address')) continue;
    const value = factValue(field, node, locale);
    if (value) facts.push({ fieldId: field.id, label: localize(field.label, locale), value });
  }
  const addressPath = template.id === 'event' ? ['location', 'address'] : ['address'];
  const address = formatAddress(node, addressPath, locale);
  if (address) facts.unshift({ fieldId: `${addressPath.join('.')}.streetAddress`, label: localize(t('地址', 'Address'), locale), value: address });
  return {
    name: displayName,
    typeLabel: label,
    summary: textOf(getAt(node, ['description'])),
    sentences: sentencesFor(template, node, locale, label, displayName, profiles),
    facts: facts.slice(0, 12),
    profiles,
  };
}
