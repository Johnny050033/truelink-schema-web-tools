import { useEffect, useRef, useState } from 'react';
import { buildOutput, displayName, getTemplate, templateForTypes, toJsonLdJson, typeLabel, typesOf, type JsonObject } from 'truelink-schema-document';
import { documentationUrl, LOCAL_LIMITS } from '../../config';
import { Icon } from '../../components/Icon';
import { Menu } from '../../components/Menu';
import { useToast } from '../../components/Toast';
import { Button, Chip, Dialog, EmptyState, LinkButton, Notice, Tabs } from '../../components/ui';
import { useI18n } from '../../i18n';
import { auditFor, docTitle, exportBaseName, scriptFor } from '../../lib/docs';
import { copyText, downloadText } from '../../lib/files';
import { hrefFor, navigate } from '../../lib/router';
import { getStore, useAppState } from '../../lib/store';
import { useNudge } from '../shell/Nudge';
import { FormView, focusField } from './FormView';
import { AuditPanel, CodePanel, JsonEditor, ScoreCard, StatusCard } from './Panels';
import { AiDescription, ENTITY_TEMPLATES, EntityCard, SearchPreview } from './Previews';

type Panel = 'preview' | 'code' | 'audit';
type View = 'edit' | Panel;

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="page-narrow">
      <h1 className="sr-only">{t('editor.notFound')}</h1>
      <EmptyState icon="file-text" title={t('editor.notFound')} body={t('editor.notFoundBody')}>
        <LinkButton variant="primary" href={hrefFor({ name: 'library' })} icon="layers">
          {t('nav.library')}
        </LinkButton>
      </EmptyState>
    </div>
  );
}

export function EditorPage({ id }: { id: string }) {
  const { t, locale, l } = useI18n();
  const doc = useAppState((state) => state.docs.find((item) => item.id === id));
  const problem = useAppState((state) => state.storage.problem);
  const toast = useToast();
  const nudge = useNudge();
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [panel, setPanel] = useState<Panel>('preview');
  const [view, setView] = useState<View>('edit');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    if (pendingFocus.current && mode === 'form' && view === 'edit') {
      const fieldId = pendingFocus.current;
      pendingFocus.current = null;
      window.requestAnimationFrame(() => focusField(fieldId));
    }
  });

  if (!doc) return <NotFound />;

  const store = getStore();
  const template = getTemplate(doc.templateId);
  const audit = auditFor(doc.templateId, doc.data);
  const autoName = displayName(template, doc.data);
  const types = typesOf(doc.data);
  const suggested = types.length > 0 ? templateForTypes(types) : template;
  const title = docTitle(doc, locale);

  const update = (data: JsonObject) => store.updateDocument(doc.id, data);

  const goToField = (fieldId: string) => {
    pendingFocus.current = fieldId;
    setMode('form');
    setView('edit');
    if (mode === 'form' && view === 'edit') {
      pendingFocus.current = null;
      focusField(fieldId);
    }
  };

  const copy = async () => {
    if (await copyText(scriptFor(doc))) {
      toast({ message: t('editor.copied'), tone: 'success', icon: 'check-circle' });
      nudge.afterExport();
    } else {
      toast({ message: t('editor.copyFailed'), tone: 'danger' });
    }
  };
  const downloadJson = () => {
    downloadText(`${exportBaseName(doc, locale)}.json`, `${toJsonLdJson(buildOutput(doc.data, template))}\n`);
    nudge.afterExport();
  };
  const downloadHtml = () => {
    downloadText(`${exportBaseName(doc, locale)}.html`, `${scriptFor(doc)}\n`, 'text/html');
    nudge.afterExport();
  };

  const remove = () => {
    setConfirmDelete(false);
    const removed = store.deleteDocument(doc.id);
    navigate({ name: 'library' }, { replace: true });
    if (removed) {
      toast({
        message: t('delete.done', { name: title }),
        icon: 'trash',
        action: {
          label: t('common.undo'),
          onClick: () => {
            if (store.restoreDocument(removed)) navigate({ name: 'doc', id: removed.id });
          },
        },
      });
    }
  };

  const duplicate = () => {
    const copyDoc = store.duplicateDocument(doc.id, t('editor.copySuffix'));
    if (copyDoc) {
      navigate({ name: 'doc', id: copyDoc.id });
      toast({ message: t('editor.duplicated'), tone: 'success' });
    } else {
      toast({ message: t('templates.limit', { max: LOCAL_LIMITS.maxDocuments }), tone: 'danger' });
    }
  };

  const selectView = (next: View) => {
    setView(next);
    if (next !== 'edit') setPanel(next);
  };

  const issueCount = audit.errors + audit.warnings;

  return (
    <div className="editor" data-view={view}>
      <header className="editor-head">
        <div className="editor-head-main">
          <a className="back-link" href={hrefFor({ name: 'library' })}>
            <Icon name="chevron-left" size={16} />
            {t('editor.back')}
          </a>
          <div className="editor-title-row">
            <span className="template-badge" aria-hidden="true">
              <Icon name={template.icon} size={22} />
            </span>
            <div className="editor-title-field">
              <h1 className="sr-only">{title}</h1>
              <label className="sr-only" htmlFor="doc-title">
                {t('editor.titleLabel')}
              </label>
              <input
                id="doc-title"
                className="title-input"
                value={doc.title}
                maxLength={120}
                placeholder={autoName ?? t('common.untitled', { type: l(template.name) })}
                title={autoName && !doc.title ? t('editor.titlePlaceholder', { name: autoName }) : undefined}
                onChange={(event) => store.renameDocument(doc.id, event.target.value)}
              />
              <p className="editor-meta">
                <Chip tone="blue">{typeLabel(template, doc.data, locale)}</Chip>
                {problem ? (
                  <span className="save-state is-error">
                    <Icon name="alert-circle" size={14} />
                    {t('editor.notSaved')}
                  </span>
                ) : (
                  <span className="save-state">
                    <Icon name="check" size={14} />
                    {t('editor.saved')}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>
        <div className="editor-head-actions">
          <Tabs
            variant="segmented"
            label={t('editor.mode')}
            idBase="mode"
            value={mode}
            onChange={setMode}
            items={[
              { id: 'form', label: t('editor.mode.form'), icon: 'file-text', controls: 'editor-main' },
              { id: 'json', label: t('editor.mode.json'), icon: 'code', controls: 'editor-main' },
            ]}
          />
          <Button variant="primary" icon="copy" onClick={() => void copy()} className="editor-copy">
            {t('editor.copyCode')}
          </Button>
          <Menu
            label={t('editor.more')}
            items={[
              { label: t('code.downloadJson'), icon: 'download', onSelect: downloadJson },
              { label: t('code.downloadHtml'), icon: 'code', onSelect: downloadHtml },
              { label: t('editor.duplicate'), icon: 'copy', onSelect: duplicate },
              { label: t('editor.delete'), icon: 'trash', onSelect: () => setConfirmDelete(true), tone: 'danger' },
            ]}
          />
        </div>
      </header>

      {suggested.id !== template.id ? (
        <Notice
          tone="info"
          action={
            <Button size="sm" variant="secondary" onClick={() => store.changeTemplate(doc.id, suggested.id)}>
              {t('editor.switchTemplate')}
            </Button>
          }
        >
          {t('editor.templateHint', { template: l(suggested.name) })}
        </Notice>
      ) : null}

      <div className="editor-view-tabs">
        <Tabs
          variant="segmented"
          label={t('editor.view')}
          idBase="view"
          value={view}
          onChange={selectView}
          items={[
            { id: 'edit', label: t('editor.view.edit'), icon: 'file-text', controls: 'editor-main' },
            { id: 'preview', label: t('editor.view.preview'), icon: 'eye', controls: 'editor-side' },
            { id: 'code', label: t('editor.view.code'), icon: 'code', controls: 'editor-side' },
            { id: 'audit', label: t('editor.view.audit'), icon: 'check-circle', controls: 'editor-side', ...(issueCount ? { badge: issueCount } : {}) },
          ]}
        />
      </div>

      <div className="editor-body">
        <div className="editor-main" id="editor-main">
          {mode === 'form' ? (
            <FormView
              key={`${doc.id}:${doc.templateId}`}
              template={template}
              data={doc.data}
              audit={audit}
              onChange={update}
              onEditJson={() => setMode('json')}
              onFieldsCleared={(previous) =>
                toast({ message: t('editor.fieldsCleared'), icon: 'info', action: { label: t('common.undo'), onClick: () => update(previous) } })
              }
            />
          ) : (
            <JsonEditor key={doc.id} template={template} data={doc.data} onApply={update} />
          )}
        </div>
        <aside className="editor-side" id="editor-side" aria-label={t('editor.panels')}>
          <div className="card side-card">
            <ScoreCard
              audit={audit}
              onShowIssues={() => {
                setPanel('audit');
                if (view !== 'edit') setView('audit');
              }}
            />
            <div className="side-tabs">
              <Tabs
                label={t('editor.panels')}
                idBase="panel"
                value={panel}
                onChange={setPanel}
                items={[
                  { id: 'preview', label: t('editor.panel.preview'), icon: 'eye', controls: 'side-panel' },
                  { id: 'code', label: t('editor.panel.code'), icon: 'code', controls: 'side-panel' },
                  { id: 'audit', label: t('editor.panel.audit'), icon: 'check-circle', controls: 'side-panel', ...(issueCount ? { badge: issueCount } : {}) },
                ]}
              />
            </div>
            <div className="side-panel" id="side-panel" role="tabpanel" aria-labelledby={`panel-tab-${panel}`}>
              {panel === 'preview' ? (
                <div className="preview-stack">
                  <AiDescription template={template} data={doc.data} audit={audit} onGap={goToField} />
                  {ENTITY_TEMPLATES.has(template.id) ? <EntityCard template={template} data={doc.data} /> : null}
                  <SearchPreview template={template} data={doc.data} />
                </div>
              ) : null}
              {panel === 'code' ? <CodePanel template={template} data={doc.data} onCopy={() => void copy()} onDownloadJson={downloadJson} onDownloadHtml={downloadHtml} /> : null}
              {panel === 'audit' ? <AuditPanel audit={audit} onFocusField={goToField} /> : null}
            </div>
          </div>
          <StatusCard doc={doc} />
          {template.learnMore && template.learnMore.length > 0 ? (
            <section className="learn-card" aria-labelledby="learn-title">
              <h3 id="learn-title" className="panel-title">
                <Icon name="file-text" size={16} />
                {t('common.learnMore')}
              </h3>
              <ul>
                {template.learnMore.map((link) => (
                  <li key={link.url}>
                    <a href={documentationUrl(link.url, link.publisher, locale)} target="_blank" rel="noopener noreferrer" className={`learn-link learn-${link.publisher}`} hrefLang={link.lang}>
                      <span>{l(link.label)}</span>
                      <Icon name="external" size={14} />
                      <span className="sr-only">{t('common.newTab')}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <Dialog
        open={confirmDelete}
        title={t('delete.title', { name: title })}
        tone="danger"
        onClose={() => setConfirmDelete(false)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="danger" icon="trash" onClick={remove}>
              {t('common.delete')}
            </Button>
          </>
        }
      >
        <p>{t('delete.body')}</p>
      </Dialog>
    </div>
  );
}
