import { useEffect, useId, useMemo, useState } from 'react';
import { CloudError } from 'truelink-schema-cloud';
import { Icon } from '../../components/Icon';
import { Button, EmptyState, LinkButton, Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { cloudSignal, connectCloud, reconnectCloud, signInToTrueLink } from '../../lib/cloud';
import { docTitle } from '../../lib/docs';
import {
  buildHandoff,
  discardPendingImport,
  importPending,
  loadPendingImport,
  pendingImportSignal,
  sendToCloud,
  type ImportResult,
} from '../../lib/handoff';
import { hrefFor } from '../../lib/router';
import { useSignal } from '../../lib/signals';
import { useAppState } from '../../lib/store';

/**
 * Public (local-only) build: "continue in TrueLink". Sends the chosen documents to the hosted
 * Studio, which keeps them until the member signs in and confirms. No data goes into a URL.
 */
export function SendToCloudPanel() {
  const { t, locale } = useI18n();
  const docs = useAppState((state) => state.docs);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set(docs.map((doc) => doc.id)));
  const [status, setStatus] = useState<{ tone: 'info' | 'success' | 'warning'; key: MessageKey; count?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const titleId = useId();
  const chosen = useMemo(() => docs.filter((doc) => selected.has(doc.id)), [docs, selected]);

  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  async function send() {
    const built = buildHandoff(chosen);
    if (!built.ok) {
      setStatus({ tone: 'warning', key: `handoff.error.${built.reason}` as MessageKey });
      return;
    }
    setBusy(true);
    setStatus({ tone: 'info', key: 'handoff.sending' });
    try {
      const count = await sendToCloud(built.records);
      setStatus({ tone: 'success', key: 'handoff.sent', count });
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'timeout';
      const key = ['popup-blocked', 'timeout', 'closed'].includes(reason) ? reason : 'timeout';
      setStatus({ tone: 'warning', key: `handoff.error.${key}` as MessageKey });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card handoff-card" aria-labelledby={titleId}>
      <h2 id={titleId}>
        <Icon name="cloud" size={20} />
        {t('handoff.send.title')}
      </h2>
      <p>{t('handoff.send.body')}</p>
      {docs.length === 0 ? (
        <p className="cloud-empty">{t('handoff.send.empty')}</p>
      ) : (
        <fieldset className="handoff-list">
          <legend className="sr-only">{t('handoff.send.choose')}</legend>
          {docs.map((doc) => (
            <label key={doc.id} className="handoff-item">
              <input type="checkbox" checked={selected.has(doc.id)} onChange={() => toggle(doc.id)} />
              <span>{docTitle(doc, locale)}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="cloud-note">
        <Icon name="lock" size={14} />
        {t('handoff.send.note')}
      </p>
      <Button variant="primary" icon="arrow-right" disabled={busy || chosen.length === 0} onClick={() => void send()}>
        {t('handoff.send.action', { count: chosen.length })}
      </Button>
      {status ? (
        <Notice tone={status.tone}>{t(status.key, { count: status.count ?? chosen.length })}</Notice>
      ) : null}
    </section>
  );
}

const OUTCOME_KEY: Record<ImportResult['outcome'], MessageKey> = {
  imported: 'handoff.outcome.imported',
  'already-imported': 'handoff.outcome.already',
  'kept-as-copy': 'handoff.outcome.copy',
  conflict: 'handoff.outcome.conflict',
  failed: 'handoff.outcome.failed',
};

/** Hosted build: confirm (or cancel) documents handed over from the public Studio. */
export function ImportPage() {
  const { t } = useI18n();
  const pending = useSignal(pendingImportSignal);
  const cloud = useSignal(cloudSignal);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<readonly ImportResult[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const titleId = useId();

  useEffect(() => {
    loadPendingImport();
    void connectCloud();
  }, []);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      setResults(await importPending());
    } catch (err) {
      setError(err instanceof CloudError && err.code === 'signed-out' ? 'handoff.import.needSignIn' : 'handoff.import.failed');
    } finally {
      setBusy(false);
    }
  }

  if (results) {
    return (
      <div className="page-narrow handoff-page">
        <h1 id={titleId}>{t('handoff.import.doneTitle')}</h1>
        <ul className="handoff-results" aria-labelledby={titleId}>
          {results.map((result) => (
            <li key={`${result.id}:${result.outcome}`}>
              <strong>{result.title || t('handoff.untitled')}</strong>
              <span>{t(OUTCOME_KEY[result.outcome])}</span>
            </li>
          ))}
        </ul>
        {pending ? <Notice tone="warning">{t('handoff.import.someLeft', { count: pending.records.length })}</Notice> : null}
        {error ? <Notice tone="warning">{t(error)}</Notice> : null}
        <div className="hero-ctas">
          <LinkButton variant="primary" href={hrefFor({ name: 'library' })}>{t('handoff.import.toLibrary')}</LinkButton>
          <LinkButton variant="ghost" href={hrefFor({ name: 'account' })}>{t('handoff.import.toAccount')}</LinkButton>
          {pending ? <Button onClick={() => void confirm()} disabled={busy}>{t('handoff.import.retry')}</Button> : null}
        </div>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="page-narrow handoff-page">
        <EmptyState icon="cloud" title={t('handoff.import.emptyTitle')} body={t('handoff.import.emptyBody')}>
          <LinkButton variant="primary" href={hrefFor({ name: 'library' })}>{t('handoff.import.toLibrary')}</LinkButton>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="page-narrow handoff-page">
      <h1 id={titleId}>{t('handoff.import.title', { count: pending.records.length })}</h1>
      <p>{t('handoff.import.body')}</p>
      <p className="cloud-note">
        <Icon name="link" size={14} />
        {t('handoff.import.source', { origin: pending.sourceOrigin })}
      </p>
      <ul className="handoff-results" aria-labelledby={titleId}>
        {pending.records.map((record) => (
          <li key={record.id}>
            <strong>{record.title || t('handoff.untitled')}</strong>
          </li>
        ))}
      </ul>
      {cloud.phase === 'connecting' || cloud.phase === 'idle' ? <Notice>{t('cloud.connecting')}</Notice> : null}
      {cloud.phase === 'unavailable' ? (
        <Notice tone="warning" icon="wifi-off" action={<Button size="sm" onClick={() => void reconnectCloud()}>{t('cloud.retry')}</Button>}>
          {t('handoff.import.unavailable')}
        </Notice>
      ) : null}
      {cloud.phase === 'outdated' ? <Notice tone="warning">{t('cloud.outdated')}</Notice> : null}
      {cloud.phase === 'signed-out' ? (
        <div className="cloud-signin">
          <p>{t('handoff.import.signInFirst')}</p>
          <Button variant="primary" icon="user" onClick={() => void signInToTrueLink()}>
            {t('cloud.signIn')}
          </Button>
        </div>
      ) : null}
      {cloud.phase === 'ready' ? (
        <p className="cloud-note">
          <Icon name="user" size={14} />
          {t('handoff.import.target', { name: cloud.account.displayName })}
        </p>
      ) : null}
      {error ? <Notice tone="warning">{t(error)}</Notice> : null}
      <div className="hero-ctas">
        <Button variant="primary" icon="upload" disabled={busy || cloud.phase !== 'ready'} onClick={() => void confirm()}>
          {t('handoff.import.confirm', { count: pending.records.length })}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => discardPendingImport()}>
          {t('handoff.import.cancel')}
        </Button>
      </div>
    </div>
  );
}
