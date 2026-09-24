import { useEffect, useId, useMemo, useState } from 'react';
import { CloudError } from 'truelink-schema-cloud';
import { displayName, getTemplate, localize, typeLabel, type JsonObject, type Locale } from 'truelink-schema-document';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Chip, Dialog, Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import {
  cloudSignal,
  connectCloud,
  deleteCloudDraft,
  downloadDraft,
  isPublishableMain,
  publishDocuments,
  reconnectCloud,
  refreshCloud,
  signInToTrueLink,
  syncMetaSignal,
  uploadDocument,
} from '../../lib/cloud';
import { docTitle } from '../../lib/docs';
import { updateSignal, useSignal } from '../../lib/signals';
import { useAppState } from '../../lib/store';
import { syncRows, type SyncRow, type SyncState } from '../../lib/sync';

const STATE_TONE: Record<SyncState, 'neutral' | 'green' | 'blue' | 'amber' | 'red'> = {
  'local-only': 'neutral',
  'cloud-only': 'blue',
  synced: 'green',
  'local-changes': 'amber',
  'cloud-changes': 'blue',
  conflict: 'red',
};

/** Downloading needs room for one more document on this device. */
class LocalLimitError extends Error {}

type Pending =
  | { readonly kind: 'useCloud' | 'keepLocal' | 'delete'; readonly row: SyncRow; readonly name: string }
  | { readonly kind: 'publish'; readonly mainId: string; readonly faqId: string | null; readonly name: string };

function useErrorMessage() {
  const { t } = useI18n();
  return (error: unknown): string => {
    if (error instanceof LocalLimitError) return t('cloud.error.localLimit');
    const code = error instanceof CloudError ? error.code : 'unavailable';
    if (code === 'conflict' || code === 'signed-out' || code === 'quota' || code === 'invalid') return t(`cloud.error.${code}` as MessageKey);
    return t('cloud.error.generic');
  };
}

function rowName(row: SyncRow, locale: Locale, untitled: (type: string) => string): string {
  if (row.doc) return docTitle(row.doc, locale);
  const record = row.draft!.record;
  const template = getTemplate(record.templateId);
  return record.title.trim() || displayName(template, record.data) || untitled(localize(template.name, locale));
}

/** Explicit, per-document sync with TrueLink cloud drafts, plus separate publishing. */
export function CloudPanel() {
  const { t, locale, dateTime } = useI18n();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const cloud = useSignal(cloudSignal);
  const meta = useSignal(syncMetaSignal);
  const docs = useAppState((state) => state.docs);
  const [busy, setBusy] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [mainId, setMainId] = useState('');
  const [faqId, setFaqId] = useState('');
  const mainSelectId = useId();
  const faqSelectId = useId();

  useEffect(() => {
    void connectCloud();
  }, []);

  const rows = useMemo(() => (cloud.phase === 'ready' ? syncRows(docs, cloud.drafts, meta) : []), [cloud, docs, meta]);
  const untitled = (type: string) => t('common.untitled', { type });
  const synced = rows.filter((row) => row.state === 'synced' && row.doc);
  const mains = synced.filter((row) => isPublishableMain(row.doc!.templateId));
  const faqs = synced.filter((row) => row.doc!.templateId === 'faq');
  const selectedMain = mains.find((row) => row.id === mainId) ?? mains[0];
  const selectedFaq = faqs.find((row) => row.id === faqId);

  async function run(key: string, action: () => Promise<string | undefined> | string | undefined) {
    setBusy(key);
    try {
      const message = await action();
      if (message) toast({ message, tone: 'success' });
    } catch (error) {
      toast({ message: errorMessage(error), tone: 'danger' });
      if (error instanceof CloudError && error.code === 'signed-out') void refreshCloud();
    } finally {
      setBusy(null);
    }
  }

  const download = (row: SyncRow, mode: 'replace' | 'copy') =>
    run(`${row.id}:download`, () => {
      const id = downloadDraft(row.id, mode);
      if (!id) throw new LocalLimitError();
      return t(mode === 'copy' ? 'cloud.done.copy' : 'cloud.done.download');
    }).then(() => undefined);

  function confirmPending() {
    const action = pending;
    setPending(null);
    if (!action) return;
    switch (action.kind) {
      case 'useCloud':
        void download(action.row, 'replace');
        return;
      case 'keepLocal': {
        const { id } = action.row;
        void run(`${id}:upload`, async () => {
          await uploadDocument(id, { overwrite: true });
          return t('cloud.done.upload');
        });
        return;
      }
      case 'delete': {
        const { id } = action.row;
        void run(`${id}:delete`, async () => {
          await deleteCloudDraft(id);
          return t('cloud.done.delete');
        });
        return;
      }
      case 'publish': {
        const { mainId: main, faqId: faq } = action;
        void run('publish', async () => {
          const result = await publishDocuments(main, faq);
          return result.officialScore ? t('cloud.publish.doneScore', { score: result.officialScore.score }) : t('cloud.publish.done');
        });
      }
    }
  }

  if (cloud.phase === 'off') return null;

  const header = (
    <div className="cloud-head">
      <h2 id="cloud-title">{t('cloud.title')}</h2>
      {cloud.phase === 'ready' ? (
        <div className="cloud-account">
          <Icon name="user" size={16} />
          <span>{t('cloud.signedIn', { name: cloud.account.displayName })}</span>
          <button type="button" className="icon-btn icon-btn-sm" aria-label={t('cloud.refresh')} title={t('cloud.refresh')} onClick={() => void refreshCloud()}>
            <Icon name="refresh" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <section className="card cloud-card" aria-labelledby="cloud-title" aria-busy={busy !== null || cloud.phase === 'connecting'}>
      {header}
      {cloud.phase === 'idle' || cloud.phase === 'connecting' ? (
        <p className="cloud-note" role="status">
          {t('cloud.connecting')}
        </p>
      ) : null}
      {cloud.phase === 'outdated' ? (
        <Notice
          tone="warning"
          icon="refresh"
          action={
            <Button size="sm" variant="primary" onClick={() => (updateSignal.get() ?? (() => window.location.reload()))()}>
              {t('cloud.reload')}
            </Button>
          }
        >
          {t('cloud.outdated')}
        </Notice>
      ) : null}
      {cloud.phase === 'unavailable' ? (
        <Notice tone="warning" icon="wifi-off" action={<Button size="sm" onClick={() => void reconnectCloud()}>{t('cloud.retry')}</Button>}>
          {t('cloud.unavailable')}
        </Notice>
      ) : null}
      {cloud.phase === 'signed-out' ? (
        <div className="cloud-signin">
          <p>{t('cloud.signedOut')}</p>
          <Button
            variant="primary"
            icon="user"
            disabled={busy !== null}
            onClick={() =>
              void run('signin', async () => {
                await signInToTrueLink();
                return undefined;
              })
            }
          >
            {t('cloud.signIn')}
          </Button>
        </div>
      ) : null}
      {cloud.phase === 'ready' ? (
        <>
          <p className="cloud-note">
            <Icon name="lock" size={14} />
            {t('cloud.rules')}
          </p>
          {rows.length === 0 ? <p className="cloud-empty">{t('cloud.empty')}</p> : null}
          <ul className="sync-list">
            {rows.map((row) => {
              const name = rowName(row, locale, untitled);
              const templateId = row.doc?.templateId ?? row.draft!.record.templateId;
              const data: JsonObject = row.doc?.data ?? row.draft!.record.data;
              const working = busy?.startsWith(`${row.id}:`) ?? false;
              return (
                <li key={row.id} className={`sync-row sync-${row.state}`}>
                  <div className="sync-main">
                    <p className="sync-name">{name}</p>
                    <p className="sync-meta">
                      {typeLabel(getTemplate(templateId), data, locale)}
                      {row.draft ? ` · ${t('cloud.savedAt', { time: dateTime(Date.parse(row.draft.savedAt)) })}` : ''}
                    </p>
                  </div>
                  <Chip tone={STATE_TONE[row.state]}>{t(`cloud.state.${row.state}` as MessageKey)}</Chip>
                  <div className="sync-actions">
                    {row.state === 'local-only' || row.state === 'local-changes' ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        icon="upload"
                        disabled={working}
                        onClick={() =>
                          void run(`${row.id}:upload`, async () => {
                            await uploadDocument(row.id);
                            return t('cloud.done.upload');
                          })
                        }
                      >
                        {t(row.state === 'local-only' ? 'cloud.action.upload' : 'cloud.action.uploadChanges')}
                      </Button>
                    ) : null}
                    {row.state === 'cloud-only' || row.state === 'cloud-changes' ? (
                      <Button size="sm" variant="secondary" icon="download" disabled={working} onClick={() => void download(row, 'replace')}>
                        {t(row.state === 'cloud-only' ? 'cloud.action.download' : 'cloud.action.useCloud')}
                      </Button>
                    ) : null}
                    {row.state === 'conflict' ? (
                      <>
                        <Button size="sm" variant="secondary" disabled={working} onClick={() => setPending({ kind: 'keepLocal', row, name })}>
                          {t('cloud.action.keepLocal')}
                        </Button>
                        <Button size="sm" variant="secondary" disabled={working} onClick={() => setPending({ kind: 'useCloud', row, name })}>
                          {t('cloud.action.useCloud')}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={working} onClick={() => void download(row, 'copy')}>
                          {t('cloud.action.keepBoth')}
                        </Button>
                      </>
                    ) : null}
                  </div>
                  {row.draft ? (
                    <button
                      type="button"
                      className="icon-btn icon-btn-sm sync-delete"
                      aria-label={`${t('cloud.action.delete')}：${name}`}
                      title={t('cloud.action.delete')}
                      disabled={working}
                      onClick={() => setPending({ kind: 'delete', row, name })}
                    >
                      <Icon name="trash" size={16} />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <div className="publish-box" aria-labelledby="publish-title">
            <h3 id="publish-title">{t('cloud.publish.title')}</h3>
            <p className="cloud-note">{t('cloud.publish.body')}</p>
            <div className="publish-current">
              {cloud.published ? (
                <>
                  <span>{t('cloud.publish.current', { name: String(cloud.published.storeObj.mainSchema['name'] ?? '—') })}</span>
                  {cloud.published.publishedAt ? <span>{t('cloud.publish.currentAt', { time: dateTime(Date.parse(cloud.published.publishedAt)) })}</span> : null}
                  {cloud.published.officialScore ? <span>{t('cloud.publish.score', { score: cloud.published.officialScore.score })}</span> : null}
                </>
              ) : (
                <span>{t('cloud.publish.none')}</span>
              )}
            </div>
            {selectedMain ? (
              <div className="publish-form">
                <label htmlFor={mainSelectId}>{t('cloud.publish.main')}</label>
                <div className="select-wrap">
                  <select id={mainSelectId} className="input select" value={selectedMain.id} onChange={(event) => setMainId(event.target.value)}>
                    {mains.map((row) => (
                      <option key={row.id} value={row.id}>
                        {rowName(row, locale, untitled)}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} className="select-icon" />
                </div>
                <label htmlFor={faqSelectId}>{t('cloud.publish.faq')}</label>
                <div className="select-wrap">
                  <select id={faqSelectId} className="input select" value={selectedFaq?.id ?? ''} onChange={(event) => setFaqId(event.target.value)}>
                    <option value="">{t('cloud.publish.noFaq')}</option>
                    {faqs.map((row) => (
                      <option key={row.id} value={row.id}>
                        {rowName(row, locale, untitled)}
                      </option>
                    ))}
                  </select>
                  <Icon name="chevron-down" size={16} className="select-icon" />
                </div>
                <Button
                  variant="primary"
                  icon="cloud"
                  disabled={busy !== null}
                  onClick={() => setPending({ kind: 'publish', mainId: selectedMain.id, faqId: selectedFaq?.id ?? null, name: rowName(selectedMain, locale, untitled) })}
                >
                  {t('cloud.publish.cta')}
                </Button>
              </div>
            ) : (
              <p className="cloud-empty">{t('cloud.publish.needMain')}</p>
            )}
          </div>
        </>
      ) : null}

      <Dialog
        open={pending !== null}
        tone={pending?.kind === 'delete' || pending?.kind === 'useCloud' || pending?.kind === 'keepLocal' ? 'danger' : 'default'}
        title={
          pending?.kind === 'publish'
            ? t('cloud.publish.confirmTitle')
            : pending
              ? t(`cloud.confirm.${pending.kind}.title` as MessageKey)
              : ''
        }
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant={pending?.kind === 'publish' ? 'primary' : 'danger'} onClick={confirmPending}>
              {pending?.kind === 'publish' ? t('cloud.publish.confirm') : pending ? t(`cloud.action.${pending.kind}` as MessageKey) : ''}
            </Button>
          </>
        }
      >
        <p>
          {pending?.kind === 'publish'
            ? t('cloud.publish.confirmBody', { name: pending.name })
            : pending?.kind === 'delete'
              ? t(pending.row.doc ? 'cloud.confirm.delete.body' : 'cloud.confirm.deleteOnly.body', { name: pending.name })
              : pending
                ? t(`cloud.confirm.${pending.kind}.body` as MessageKey, { name: pending.name })
                : null}
        </p>
      </Dialog>
    </section>
  );
}

/** One-line account state for the hero status list. */
export function useCloudStatusLines(): readonly { readonly icon: 'user' | 'cloud'; readonly text: string }[] | null {
  const { t } = useI18n();
  const cloud = useSignal(cloudSignal);
  if (cloud.phase === 'off') return null;
  if (cloud.phase === 'ready') {
    return [
      { icon: 'user', text: t('account.status.cloudSignedIn', { name: cloud.account.displayName }) },
      { icon: 'cloud', text: t('account.status.cloudDrafts', { count: cloud.drafts.length }) },
    ];
  }
  const key: MessageKey =
    cloud.phase === 'signed-out'
      ? 'account.status.cloudSignedOut'
      : cloud.phase === 'unavailable'
        ? 'account.status.cloudUnavailable'
        : cloud.phase === 'outdated'
          ? 'account.status.cloudOutdated'
          : 'account.status.cloudConnecting';
  return [{ icon: 'user', text: t(key) }];
}
