import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  classifyProfile,
  findField,
  getAt,
  getTemplate,
  isHttpUrl,
  PLATFORMS,
  setAt,
  textsOf,
  type JsonObject,
  type PlatformId,
  type ScalarField,
  type TemplateId,
} from 'truelink-schema-document';
import { BrandShield } from '../../components/Brand';
import { Icon, type IconName } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Chip, IconButton, LinkButton, ScoreRing } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { brandAudit } from '../../lib/docs';
import { hrefFor, navigate } from '../../lib/router';
import { getStore, useAppState } from '../../lib/store';
import { LOCAL_LIMITS } from '../../config';
import { FieldControl } from '../editor/FieldControl';
import { fieldDomId, focusField } from '../editor/FormView';
import { AiDescription, EntityCard } from '../editor/Previews';

const organization = getTemplate('organization');

interface Step {
  readonly id: 'basics' | 'contact' | 'profiles' | 'authority';
  readonly icon: IconName;
  readonly fields: readonly string[];
}

const STEPS: readonly Step[] = [
  { id: 'basics', icon: 'building', fields: ['@type', 'name', 'alternateName', 'url', 'logo', 'description', 'legalName', 'slogan'] },
  { id: 'contact', icon: 'phone', fields: ['telephone', 'email', 'address.addressRegion', 'address.addressLocality', 'address.streetAddress', 'address.postalCode', 'address.addressCountry', 'contactPoint.contactType', 'contactPoint.telephone'] },
  { id: 'profiles', icon: 'link', fields: ['sameAs'] },
  { id: 'authority', icon: 'shield', fields: ['knowsAbout', 'foundingDate', 'founder.name', 'award', 'taxID', '@id'] },
];

type SlotMap = Partial<Record<PlatformId, string>>;

function splitProfiles(urls: readonly string[]): { slots: SlotMap; others: string[] } {
  const slots: SlotMap = {};
  const others: string[] = [];
  const known = new Set<PlatformId>(PLATFORMS.map((platform) => platform.id));
  for (const url of urls) {
    const platform = classifyProfile(url);
    if (known.has(platform) && !slots[platform]) slots[platform] = url;
    else others.push(url);
  }
  return { slots, others };
}

function joinProfiles(slots: SlotMap, others: readonly string[]): string[] {
  return [...PLATFORMS.map((platform) => slots[platform.id] ?? ''), ...others].map((url) => url.trim()).filter(Boolean);
}

function ProfilesStep() {
  const { t, l } = useI18n();
  const idBase = useId();
  const initial = useMemo(() => splitProfiles(textsOf(getAt(getStore().getState().brand.data, ['sameAs']))), []);
  const [slots, setSlots] = useState<SlotMap>(initial.slots);
  const [others, setOthers] = useState<string[]>(initial.others);

  const commit = (nextSlots: SlotMap, nextOthers: string[]) => {
    setSlots(nextSlots);
    setOthers(nextOthers);
    const store = getStore();
    store.setBrand(setAt(store.getState().brand.data, ['sameAs'], joinProfiles(nextSlots, nextOthers), organization.nodeTypes));
  };
  const count = joinProfiles(slots, others).filter((url) => isHttpUrl(url)).length;

  return (
    <div className="profiles-step" id={fieldDomId('sameAs')}>
      <p className="profiles-count">
        <Icon name="link" size={16} />
        {t('brand.profiles.connected', { count })}
      </p>
      <div className="profile-grid">
        {PLATFORMS.map((platform) => {
          const value = slots[platform.id] ?? '';
          const inputId = `${idBase}-${platform.id}`;
          const invalid = value.trim() !== '' && !isHttpUrl(value.trim());
          return (
            <div key={platform.id} className={`profile-slot${value && !invalid ? ' is-filled' : ''}`}>
              <label htmlFor={inputId} className="profile-label">
                <span className="profile-status" aria-hidden="true">
                  <Icon name={value && !invalid ? 'check' : 'link'} size={14} />
                </span>
                {l(platform.label)}
                {platform.authority ? <Chip tone="gold">{t('brand.profiles.authority')}</Chip> : null}
              </label>
              <input
                id={inputId}
                type="url"
                className="input"
                inputMode="url"
                placeholder={platform.placeholder}
                value={value}
                aria-invalid={invalid || undefined}
                onChange={(event) => commit({ ...slots, [platform.id]: event.target.value }, others)}
              />
              {invalid ? (
                <p className="field-issue field-issue-error">
                  <Icon name="alert-circle" size={14} />
                  {t('brand.profiles.invalid')}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="profiles-other">
        <p className="field-label">{t('brand.profiles.other')}</p>
        {others.map((url, index) => (
          <div className="multi-row" key={index}>
            <input
              type="url"
              className="input"
              inputMode="url"
              value={url}
              aria-label={`${t('brand.profiles.other')} ${index + 1}`}
              onChange={(event) => commit(slots, others.map((item, i) => (i === index ? event.target.value : item)))}
            />
            <IconButton icon="x" size="sm" label={t('field.removeItem', { index: index + 1 })} onClick={() => commit(slots, others.filter((_, i) => i !== index))} />
          </div>
        ))}
        <button type="button" className="link-btn add-row" onClick={() => setOthers([...others, ''])} disabled={others.some((url) => url.trim() === '')}>
          <Icon name="plus" size={16} />
          {t('field.add')}
        </button>
      </div>
    </div>
  );
}

function StepFields({ step, data, touched, onTouched }: { step: Step; data: JsonObject; touched: ReadonlySet<string>; onTouched: (id: string) => void }) {
  const audit = brandAudit(getStore().getState().brand);
  if (step.id === 'profiles') return <ProfilesStep />;
  return (
    <div className="form-grid">
      {step.fields.map((fieldId) => {
        const entry = findField(organization, fieldId);
        if (!entry || entry.field.kind === 'list') return null;
        const field = entry.field as ScalarField;
        return (
          <FieldControl
            key={field.id}
            field={field}
            node={data}
            root={data}
            nodeTypes={organization.nodeTypes}
            domId={fieldDomId(field.id)}
            issues={audit.issues.filter((issue) => issue.fieldId === field.id && !issue.code.startsWith('missing'))}
            showIssues={touched.has(field.id)}
            onTouched={() => onTouched(field.id)}
            onChange={(next) => getStore().setBrand(next)}
          />
        );
      })}
    </div>
  );
}

export function BrandPage() {
  const { t } = useI18n();
  const toast = useToast();
  const brand = useAppState((state) => state.brand);
  const [stepIndex, setStepIndex] = useState(0);
  const [touched, setTouched] = useState<ReadonlySet<string>>(new Set());
  const pendingFocus = useRef<string | null>(null);
  const audit = brandAudit(brand);
  const done = stepIndex >= STEPS.length;
  const step = STEPS[Math.min(stepIndex, STEPS.length - 1)]!;

  useEffect(() => {
    if (pendingFocus.current) {
      const fieldId = pendingFocus.current;
      pendingFocus.current = null;
      window.requestAnimationFrame(() => focusField(fieldId));
    }
  }, [stepIndex]);

  const jumpTo = (fieldId: string) => {
    const index = STEPS.findIndex((item) => item.fields.includes(fieldId));
    if (index < 0) return;
    if (index === stepIndex) focusField(fieldId);
    else {
      pendingFocus.current = fieldId;
      setStepIndex(index);
    }
  };

  const create = (templateId: TemplateId) => {
    const doc = getStore().createDocument(templateId);
    if (doc) navigate({ name: 'doc', id: doc.id });
    else toast({ message: t('templates.limit', { max: LOCAL_LIMITS.maxDocuments }), tone: 'danger' });
  };

  const goTo = (index: number) => {
    setStepIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="brand-page page-wide">
      <header className="page-head page-head-row brand-head">
        <div>
          <h1>{t('brand.title')}</h1>
          <p>{t('brand.subtitle')}</p>
        </div>
        <div className="brand-score">
          <ScoreRing score={audit.score} grade={audit.grade} size={76} label={t('brand.completeness')} />
          <div>
            <p className="brand-score-label">{t('brand.completeness')}</p>
            <p className="brand-saved">
              <Icon name="check" size={14} />
              {t('brand.saved')}
            </p>
          </div>
        </div>
      </header>

      <nav aria-label={t('brand.steps')}>
        <ol className="stepper">
          {STEPS.map((item, index) => (
            <li key={item.id}>
              <button type="button" className={`step${index === stepIndex ? ' is-current' : ''}${index < stepIndex ? ' is-done' : ''}`} aria-current={index === stepIndex ? 'step' : undefined} onClick={() => goTo(index)}>
                <span className="step-index" aria-hidden="true">
                  {index < stepIndex ? <Icon name="check" size={14} /> : index + 1}
                </span>
                <span className="step-label">{t(`brand.step.${item.id}` as MessageKey)}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="brand-layout">
        <div className="brand-main">
          {done ? (
            <section className="card done-card" aria-labelledby="done-title">
              <span className="done-icon">
                <Icon name="check-circle" size={40} />
              </span>
              <h2 id="done-title">{t('brand.doneTitle')}</h2>
              <p>{t('brand.doneBody')}</p>
              <div className="done-actions">
                <Button variant="primary" icon="building" onClick={() => create('organization')}>
                  {t('brand.create.organization')}
                </Button>
                <Button variant="secondary" icon="globe" onClick={() => create('website')}>
                  {t('brand.create.website')}
                </Button>
                <Button variant="secondary" icon="store" onClick={() => create('local-business')}>
                  {t('brand.create.localBusiness')}
                </Button>
              </div>
              <div className="done-promo">
                <BrandShield size={36} />
                <div>
                  <p className="cdn-title">{t('brand.promo.title')}</p>
                  <p>{t('brand.promo.body')}</p>
                </div>
                <LinkButton variant="accent" size="sm" href={hrefFor({ name: 'account' })}>
                  {t('nav.promo.cta')}
                </LinkButton>
              </div>
            </section>
          ) : (
            <section className="card step-card" aria-labelledby="step-title">
              <header className="step-head">
                <span className="card-icon">
                  <Icon name={step.icon} size={20} />
                </span>
                <div>
                  <h2 id="step-title">{t(`brand.step.${step.id}` as MessageKey)}</h2>
                  <p>{t(`brand.step.${step.id}.desc` as MessageKey)}</p>
                </div>
              </header>
              <StepFields step={step} data={brand.data} touched={touched} onTouched={(id) => setTouched((current) => new Set(current).add(id))} />
              <footer className="step-actions">
                <Button variant="ghost" icon="chevron-left" onClick={() => goTo(stepIndex - 1)} disabled={stepIndex === 0}>
                  {t('common.back')}
                </Button>
                <Button variant="primary" iconEnd={stepIndex === STEPS.length - 1 ? 'check' : 'arrow-right'} onClick={() => goTo(stepIndex + 1)}>
                  {stepIndex === STEPS.length - 1 ? t('common.done') : t('common.next')}
                </Button>
              </footer>
            </section>
          )}
        </div>
        <aside className="brand-side" aria-label={t('brand.previewTitle')}>
          <AiDescription template={organization} data={brand.data} audit={audit} onGap={jumpTo} compact />
          <EntityCard template={organization} data={brand.data} />
          <p className="privacy-note">
            <Icon name="lock" size={14} />
            {t('brand.privacy')}
          </p>
        </aside>
      </div>
    </div>
  );
}
