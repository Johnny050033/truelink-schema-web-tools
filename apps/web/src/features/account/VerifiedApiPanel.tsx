import { useState } from 'react';
import { CloudError, type IssuedApiKey, type KycState, type VerificationStatus } from 'truelink-schema-cloud';
import { API_KEY_HEADER, domainCoverage, hostedSchemaEmbed, normalizeDomain } from 'truelink-schema-document';
import { COMMUNITY_LINKS, forLocale, TRUELINK_LINKS } from '../../config';
import { Icon } from '../../components/Icon';
import { useToast } from '../../components/Toast';
import { Button, Chip, Dialog, ExternalLink, LinkButton, Notice } from '../../components/ui';
import { useI18n, type MessageKey } from '../../i18n';
import { cloudSignal, issueApiKey, openKyc, revokeApiKey } from '../../lib/cloud';
import { copyText } from '../../lib/files';
import { useSignal } from '../../lib/signals';
import { useAppState } from '../../lib/store';

/**
 * TrueLink Verified Schema: after KYC, TrueLink serves the brand's complete schema only on its
 * verified official domains (copies elsewhere get nothing and raise an alert). Signed-in
 * members see their live status; everyone else sees how it works.
 */
export function VerifiedApiPanel() {
  const state = useSignal(cloudSignal);
  if (state.phase === 'ready' && state.verification) return <VerifiedStatus verification={state.verification} />;
  return <VerifiedIntro />;
}

function VerifiedIntro() {
  const { t, locale } = useI18n();
  return (
    <section id="verified" className="card verified-card" aria-labelledby="verified-title">
      <div className="verified-head">
        <span className="card-icon">
          <Icon name="shield" size={20} />
        </span>
        <div>
          <h2 id="verified-title">{t('verified.title')}</h2>
          <p className="verified-lead">{t('verified.lead')}</p>
        </div>
      </div>
      <p>{t('verified.body')}</p>
      <ol className="verified-steps">
        <li>{t('verified.step1')}</li>
        <li>{t('verified.step2')}</li>
        <li>{t('verified.step3')}</li>
      </ol>
      <div className="verified-actions">
        <LinkButton variant="primary" href={TRUELINK_LINKS.kyc} external icon="shield">
          {t('verified.start')}
        </LinkButton>
        <ExternalLink href={forLocale(COMMUNITY_LINKS.verifiedDocs, locale)}>{t('verified.learn')}</ExternalLink>
      </div>
      <p className="verified-note">{t('verified.note')}</p>
    </section>
  );
}

const KYC_TONE: Readonly<Record<KycState, 'green' | 'amber' | 'red' | 'neutral'>> = { approved: 'green', pending: 'amber', rejected: 'red', none: 'neutral' };

type Pending = { readonly kind: 'rotate' | 'revoke' } | null;

function VerifiedStatus({ verification }: { verification: VerificationStatus }) {
  const { t } = useI18n();
  const toast = useToast();
  const brandUrl = useAppState((state) => state.brand.data['url']);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [issued, setIssued] = useState<IssuedApiKey | null>(null);
  const eligible = verification.kyc === 'approved' && verification.membershipActive;
  const key = verification.apiKey;
  const embed = verification.hostedScriptUrl ? hostedSchemaEmbed(verification.hostedScriptUrl) : null;
  const brandDomain = typeof brandUrl === 'string' ? normalizeDomain(brandUrl) : '';
  const coverage = typeof brandUrl === 'string' && verification.verifiedDomains.length > 0 ? domainCoverage(brandUrl, verification.verifiedDomains) : 'no-url';

  const run = async (task: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await task();
    } catch (error) {
      const forbidden = error instanceof CloudError && error.code === 'forbidden';
      toast({ message: t(forbidden ? 'verified.error.forbidden' : 'cloud.error.generic'), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  const issue = (operation: 'provision' | 'rotate') => run(async () => setIssued(await issueApiKey(operation)));
  const copy = async (text: string, message: MessageKey) => {
    if (await copyText(text)) toast({ message: t(message), tone: 'success', icon: 'copy' });
  };

  return (
    <section id="verified" className="card verified-card" aria-labelledby="verified-title">
      <div className="verified-head">
        <span className="card-icon">
          <Icon name="shield" size={20} />
        </span>
        <div>
          <h2 id="verified-title">{t('verified.title')}</h2>
          <p className="verified-lead">{t('verified.lead')}</p>
        </div>
      </div>

      <dl className="verified-status">
        <div className="verified-row">
          <dt>{t('verified.status.kyc')}</dt>
          <dd>
            <Chip tone={KYC_TONE[verification.kyc]}>{t(`verified.kyc.${verification.kyc}` as MessageKey)}</Chip>
            {verification.kyc !== 'approved' ? (
              <Button size="sm" variant="secondary" icon="external" disabled={busy} onClick={() => void run(openKyc)}>
                {t('verified.kyc.open')}
              </Button>
            ) : null}
          </dd>
        </div>
        <div className="verified-row">
          <dt>{t('verified.status.membership')}</dt>
          <dd>
            <Chip tone={verification.membershipActive ? 'green' : 'neutral'}>{t(verification.membershipActive ? 'verified.membership.active' : 'verified.membership.inactive')}</Chip>
          </dd>
        </div>
        <div className="verified-row">
          <dt>{t('verified.domains')}</dt>
          <dd>
            {verification.verifiedDomains.length > 0 ? (
              <ul className="verified-domains">
                {verification.verifiedDomains.map((domain) => (
                  <li key={domain}>
                    <code>{domain}</code>
                  </li>
                ))}
              </ul>
            ) : (
              <span className="verified-muted">{t('verified.domains.none')}</span>
            )}
          </dd>
        </div>
      </dl>
      {coverage === 'not-covered' ? <Notice tone="warning">{t('verified.domains.notCovered', { domain: brandDomain })}</Notice> : null}
      {verification.certificateUrl ? <ExternalLink href={verification.certificateUrl}>{t('verified.certificate')}</ExternalLink> : null}

      <div className="verified-block">
        <h3>{t('verified.embed.title')}</h3>
        {embed ? (
          <>
            <p>{t('verified.embed.body')}</p>
            <pre className="code-block verified-code">
              <code>{embed}</code>
            </pre>
            <Button size="sm" icon="copy" onClick={() => void copy(embed, 'verified.embed.copied')}>
              {t('common.copy')}
            </Button>
          </>
        ) : (
          <p className="verified-muted">{t('verified.embed.none')}</p>
        )}
      </div>

      <div className="verified-block">
        <h3>{t('verified.key.title')}</h3>
        <p>{t('verified.key.body', { header: API_KEY_HEADER })}</p>
        <p className="verified-key-state">
          <Icon name="lock" size={16} />
          {key.state === 'active' ? t('verified.key.active', { masked: key.masked ?? '' }) : key.state === 'revoked' ? t('verified.key.revoked', { masked: key.masked ?? '' }) : t('verified.key.none')}
        </p>
        {key.state === 'active' && !eligible ? <Notice tone="warning">{t('verified.key.paused')}</Notice> : null}
        <div className="verified-actions">
          {key.state === 'active' ? (
            <>
              <Button size="sm" icon="refresh" disabled={busy || !eligible} onClick={() => setPending({ kind: 'rotate' })}>
                {t('verified.key.rotate')}
              </Button>
              <Button size="sm" variant="danger" icon="x" disabled={busy} onClick={() => setPending({ kind: 'revoke' })}>
                {t('verified.key.revoke')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="primary" icon="plus" disabled={busy || !eligible} onClick={() => void issue('provision')}>
              {t('verified.key.create')}
            </Button>
          )}
        </div>
        {!eligible && key.state !== 'active' ? <p className="verified-muted">{t('verified.key.needs')}</p> : null}
      </div>
      <p className="verified-note">{t('verified.note')}</p>

      <Dialog
        open={pending !== null}
        tone={pending?.kind === 'revoke' ? 'danger' : 'default'}
        title={pending ? t(pending.kind === 'rotate' ? 'verified.key.rotate' : 'verified.key.revoke') : ''}
        onClose={() => setPending(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={pending?.kind === 'revoke' ? 'danger' : 'primary'}
              onClick={() => {
                const kind = pending?.kind;
                setPending(null);
                if (kind === 'rotate') void issue('rotate');
                else if (kind === 'revoke') void run(revokeApiKey);
              }}
            >
              {pending ? t(pending.kind === 'rotate' ? 'verified.key.rotate' : 'verified.key.revoke') : ''}
            </Button>
          </>
        }
      >
        <p>{pending ? t(pending.kind === 'rotate' ? 'verified.key.rotateConfirm' : 'verified.key.revokeConfirm') : null}</p>
      </Dialog>

      <Dialog
        open={issued !== null}
        title={t('verified.key.issuedTitle')}
        onClose={() => setIssued(null)}
        actions={
          <>
            <Button variant="ghost" onClick={() => setIssued(null)}>
              {t('common.close')}
            </Button>
            <Button variant="primary" icon="copy" onClick={() => void (issued ? copy(issued.apiKey, 'verified.key.copied') : undefined)}>
              {t('common.copy')}
            </Button>
          </>
        }
      >
        <p>{t('verified.key.issuedBody')}</p>
        <pre className="code-block verified-code">
          <code>{issued?.apiKey}</code>
        </pre>
      </Dialog>
    </section>
  );
}
