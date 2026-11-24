import { LinkButton, Notice } from '../../components/ui';
import { useI18n } from '../../i18n';
import { pendingImportSignal } from '../../lib/handoff';
import { hrefFor } from '../../lib/router';
import { useSignal } from '../../lib/signals';

/** Hosted build: reminds the member that handed-over documents are waiting for confirmation. */
export function PendingImportBanner({ onImportRoute }: { onImportRoute: boolean }) {
  const { t } = useI18n();
  const pending = useSignal(pendingImportSignal);
  if (!pending || onImportRoute) return null;
  return (
    <div className="handoff-banner">
      <Notice tone="gold" icon="cloud" action={<LinkButton size="sm" variant="primary" href={hrefFor({ name: 'import' })}>{t('handoff.banner.action')}</LinkButton>}>
        {t('handoff.banner.text', { count: pending.records.length })}
      </Notice>
    </div>
  );
}
