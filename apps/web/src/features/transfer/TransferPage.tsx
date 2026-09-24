import { useId, useMemo, useRef, useState } from 'react';
import {
  buildOutput,
  combineGraph,
  displayName,
  getTemplate,
  parseJsonLdTexts,
  toJsonLdJson,
  toJsonLdScript,
  utf8Bytes,
  type ImportCandidate,
  type ImportIssue,
} from 'truelink-schema-document';
import { LOCAL_LIMITS } from '../../config';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Dialog, Notice } from '../../components/ui';
import { useI18n } from '../../i18n';
import { downloadBackup } from '../../lib/docs';
import { copyText, dateStamp, downloadText, extractJsonLd, readFileText } from '../../lib/files';
import { parseBackup, type ParsedBackup } from '../../lib/persistence';
import { navigate } from '../../lib/router';
import { getStore, useAppState } from '../../lib/store';
import { useNudge } from '../shell/Nudge';

interface Analysis {
  readonly candidates: readonly ImportCandidate[];
  readonly issues: readonly ImportIssue[];
  readonly error?: string;
}

function ImportSection() {
  const { t, l } = useI18n();
  const toast = useToast();
  const docCount = useAppState((state) => state.docs.length);
  const [text, setText] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selected, setSelected] = useState<ReadonlySet<number>>(new Set());
  const fileRef = useRef<HTMLInputElement>(null);
  const textId = useId();
  const room = Math.max(0, LOCAL_LIMITS.maxDocuments - docCount);

  const analyze = (value: string) => {
    if (utf8Bytes(value) > LOCAL_LIMITS.maxImportTextBytes) {
      setAnalysis({ candidates: [], issues: [], error: t('transfer.import.tooLarge', { size: '2 MiB' }) });
      return;
    }
    const { blocks, html } = extractJsonLd(value);
    if (html && blocks.length === 0) {
      setAnalysis({ candidates: [], issues: [], error: t('transfer.import.htmlNone') });
      return;
    }
    const result = parseJsonLdTexts(blocks);
    setAnalysis(result);
    setSelected(new Set(result.candidates.slice(0, room).map((candidate) => candidate.index)));
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const content = await readFileText(file, LOCAL_LIMITS.maxImportTextBytes);
      setText(content);
      analyze(content);
    } catch {
      setAnalysis({ candidates: [], issues: [], error: t('transfer.import.tooLarge', { size: '2 MiB' }) });
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const confirm = () => {
    if (!analysis) return;
    const chosen = analysis.candidates.filter((candidate) => selected.has(candidate.index));
    const created = getStore().importDocuments(chosen.map((candidate) => ({ templateId: candidate.templateId, data: candidate.node })));
    toast({ message: t('transfer.import.done', { count: created.length }), tone: 'success' });
    setText('');
    setAnalysis(null);
    if (created.length === 1) navigate({ name: 'doc', id: created[0]!.id });
    else if (created.length > 1) navigate({ name: 'library' });
  };

  const toggle = (index: number) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else if (next.size < room) next.add(index);
      return next;
    });

  return (
    <section className="card transfer-card" aria-labelledby="import-title">
      <header className="card-head">
        <span className="card-icon">
          <Icon name="upload" size={20} />
        </span>
        <div>
          <h2 id="import-title">{t('transfer.import.title')}</h2>
          <p>{t('transfer.import.body')}</p>
        </div>
      </header>
      <label htmlFor={textId} className="field-label">
        {t('transfer.import.label')}
      </label>
      <textarea id={textId} className="input textarea code-input" rows={7} spellCheck={false} placeholder={t('transfer.import.placeholder')} value={text} onChange={(event) => setText(event.target.value)} />
      <div className="row-actions">
        <Button variant="primary" icon="scan" onClick={() => analyze(text)} disabled={text.trim() === ''}>
          {t('transfer.import.analyze')}
        </Button>
        <input ref={fileRef} type="file" accept=".json,.jsonld,.html,.htm,.txt,application/json,application/ld+json,text/html" className="sr-only" id={`${textId}-file`} onChange={(event) => void onFile(event.target.files?.[0])} />
        <label htmlFor={`${textId}-file`} className="btn btn-secondary btn-md">
          <Icon name="file-text" size={18} />
          <span className="btn-label">{t('transfer.import.file')}</span>
        </label>
      </div>

      {analysis ? (
        <div className="import-result" role="status" aria-live="polite">
          {analysis.error ? <Notice tone="danger">{analysis.error}</Notice> : null}
          {analysis.issues.map((issue, index) => (
            <Notice key={`${issue.code}-${index}`} tone={issue.code === 'legacy_store' ? 'info' : analysis.candidates.length > 0 ? 'warning' : 'danger'}>
              {l(issue.message)}
            </Notice>
          ))}
          {analysis.candidates.length > 0 ? (
            <>
              <p className="import-summary">
                <strong>{t('transfer.import.found', { count: analysis.candidates.length })}</strong> · {t('transfer.import.room', { room, max: LOCAL_LIMITS.maxDocuments })}
              </p>
              <ul className="candidate-list">
                {analysis.candidates.map((candidate) => {
                  const template = getTemplate(candidate.templateId);
                  const name = displayName(template, candidate.node) ?? candidate.types.join(', ');
                  const checked = selected.has(candidate.index);
                  return (
                    <li key={candidate.index}>
                      <label className={`candidate${checked ? ' is-on' : ''}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(candidate.index)} disabled={!checked && selected.size >= room} />
                        <span className={`template-icon cat-${template.category}`} aria-hidden="true">
                          <Icon name={template.icon} size={18} />
                        </span>
                        <span className="candidate-text">
                          <span className="candidate-name">{name}</span>
                          <span className="candidate-meta">
                            <code>{candidate.types.join(', ')}</code> · {t('transfer.import.template', { template: l(template.name) })}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
              <Button variant="primary" icon="check" onClick={confirm} disabled={selected.size === 0}>
                {t('transfer.import.confirm', { count: selected.size })}
              </Button>
            </>
          ) : !analysis.error && analysis.issues.length === 0 ? (
            <p className="muted">{t('transfer.import.none')}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ExportSection() {
  const { t } = useI18n();
  const toast = useToast();
  const nudge = useNudge();
  const docs = useAppState((state) => state.docs);
  const graph = useMemo(() => combineGraph(docs.map((doc) => buildOutput(doc.data, getTemplate(doc.templateId)))), [docs]);
  return (
    <section className="card transfer-card" aria-labelledby="export-title">
      <header className="card-head">
        <span className="card-icon">
          <Icon name="code" size={20} />
        </span>
        <div>
          <h2 id="export-title">{t('transfer.export.title')}</h2>
          <p>{t('transfer.export.body')}</p>
        </div>
      </header>
      {docs.length === 0 ? (
        <p className="muted">{t('transfer.export.empty')}</p>
      ) : (
        <div className="row-actions">
          <Button
            variant="primary"
            icon="copy"
            onClick={async () => {
              if (await copyText(toJsonLdScript(graph))) {
                toast({ message: t('editor.copied'), tone: 'success' });
                nudge.afterExport();
              } else toast({ message: t('editor.copyFailed'), tone: 'danger' });
            }}
          >
            {t('transfer.export.copy')}
          </Button>
          <Button
            variant="secondary"
            icon="download"
            onClick={() => {
              downloadText(`schema-studio-graph-${dateStamp()}.json`, `${toJsonLdJson(graph)}\n`);
              nudge.afterExport();
            }}
          >
            {t('transfer.export.download')}
          </Button>
        </div>
      )}
    </section>
  );
}

function BackupSection() {
  const { t } = useI18n();
  const toast = useToast();
  const docs = useAppState((state) => state.docs);
  const brand = useAppState((state) => state.brand);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [replaceBrand, setReplaceBrand] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const parsed = parseBackup(await readFileText(file, LOCAL_LIMITS.maxImportTextBytes * 4));
      if (!parsed) setError(t('transfer.backup.invalid'));
      else {
        setReplaceBrand(false);
        setPending(parsed);
      }
    } catch {
      setError(t('transfer.backup.invalid'));
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const restore = () => {
    if (!pending) return;
    const store = getStore();
    const created = store.importDocuments(pending.documents);
    if (replaceBrand && pending.brand) store.setBrand(pending.brand);
    const skipped = pending.skipped + (pending.documents.length - created.length);
    toast({ message: `${t('transfer.backup.restored', { count: created.length })}${skipped > 0 ? t('transfer.backup.skipped', { count: skipped }) : ''}`, tone: 'success' });
    setPending(null);
  };

  return (
    <section className="card transfer-card" aria-labelledby="backup-title">
      <header className="card-head">
        <span className="card-icon">
          <Icon name="download" size={20} />
        </span>
        <div>
          <h2 id="backup-title">{t('transfer.backup.title')}</h2>
          <p>{t('transfer.backup.body')}</p>
        </div>
      </header>
      <div className="row-actions">
        <Button variant="primary" icon="download" onClick={() => downloadBackup(docs, brand)}>
          {t('transfer.backup.download')}
        </Button>
        <input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" id={`${id}-restore`} onChange={(event) => void onFile(event.target.files?.[0])} />
        <label htmlFor={`${id}-restore`} className="btn btn-secondary btn-md">
          <Icon name="upload" size={18} />
          <span className="btn-label">{t('transfer.backup.restore')}</span>
        </label>
      </div>
      {error ? <Notice tone="danger">{error}</Notice> : null}
      <Dialog
        open={pending !== null}
        title={t('transfer.backup.restore')}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" icon="check" onClick={restore}>
              {t('transfer.backup.confirm')}
            </Button>
          </>
        }
      >
        {pending ? (
          <>
            <p>{t('transfer.backup.preview', { count: pending.documents.length, brand: pending.brand ? t('transfer.backup.withBrand') : '' })}</p>
            {pending.brand ? (
              <label className="check-row">
                <input type="checkbox" checked={replaceBrand} onChange={(event) => setReplaceBrand(event.target.checked)} />
                <span>{t('transfer.backup.replaceBrand')}</span>
              </label>
            ) : null}
          </>
        ) : null}
      </Dialog>
    </section>
  );
}

export function TransferPage() {
  const { t } = useI18n();
  return (
    <div className="page-narrow">
      <header className="page-head">
        <h1>{t('transfer.title')}</h1>
        <p>{t('transfer.subtitle')}</p>
      </header>
      <ImportSection />
      <ExportSection />
      <BackupSection />
    </div>
  );
}
