import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import AppLayout from '../../components/app/AppLayout';
import { PageHeader, Pill, cx, type PillTone } from '../../components/app/ui';
import { InvoiceTable, isoDate, type PlatformInvoice } from '../../components/app/billingParts';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import api from '../../utils/api';

type SetupStep = 'idle' | 'qr' | 'confirm' | 'done';
interface SetupData { qrCodeDataUrl: string; secret: string; }

interface ProfileForm {
  name: string;
  companyName: string;
  phone: string;
  vatNumber: string;
  addressLine1: string;
  addressCity: string;
  addressCountry: string;
  addressZip: string;
}

type Theme = 'light' | 'dark' | 'system';

function ThemeControl() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    try {
      setTheme((localStorage.getItem('theme') as Theme) || 'system');
    } catch {}
  }, []);

  const applyTheme = useCallback((t: Theme) => {
    setTheme(t);
    try { localStorage.setItem('theme', t); } catch {}
    const isDark = t === 'dark' || (t === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  const options: { value: Theme; label: string }[] = [
    { value: 'light',  label: 'Claro' },
    { value: 'dark',   label: 'Escuro' },
    { value: 'system', label: 'Sistema' },
  ];

  return (
    <div className="inline-flex rounded-lg border border-app-control p-0.5" role="radiogroup" aria-label="Tema">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="radio"
          aria-checked={theme === opt.value}
          onClick={() => applyTheme(opt.value)}
          className={cx('rounded-md px-4 py-1.5 text-sm font-medium transition-colors', theme === opt.value ? 'bg-app-raised text-app-ink' : 'text-app-muted hover:text-app-ink')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

type Msg = { type: 'ok' | 'err'; text: string } | null;
function Notice({ m }: { m: Msg }) {
  if (!m) return null;
  return <p role="status" className={cx('rounded-lg px-3 py-2 text-sm', m.type === 'ok' ? 'bg-app-pos-soft text-app-pos' : 'bg-app-neg-soft text-app-neg')}>{m.text}</p>;
}

/** Linha de definições: título e frase cinza à esquerda, painel à direita. */
function Section({ title, hint, children, aside }: { title: string; hint?: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="grid gap-4 border-t border-app-rule py-7 first:border-t-0 first:pt-0 md:grid-cols-[15rem_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="text-base font-semibold text-app-ink">{title}</h2>
        {hint && <p className="mt-1 text-sm text-app-muted">{hint}</p>}
        {aside && <div className="mt-2">{aside}</div>}
      </div>
      <div className="min-w-0 self-start rounded-xl border border-app-edge bg-app-sheet p-5">{children}</div>
    </section>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-sm font-medium text-app-ink">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-app-faint">{hint}</span>}
    </label>
  );
}

const METHOD: Record<string, string> = { stripe: 'Cartão (Stripe)', ifthenpay_mbway: 'MB Way', ifthenpay_multibanco: 'Multibanco', pix: 'PIX', manual: 'Manual' };
const SUB_STATUS: Record<string, { tone: PillTone; label: string }> = {
  active: { tone: 'pos', label: 'Ativa' },
  suspended: { tone: 'neg', label: 'Suspensa' },
  pending_payment: { tone: 'warn', label: 'Aguarda pagamento' },
  trial: { tone: 'accent', label: 'Período de teste' },
};

export default function ProfilePage() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();

  // Profile
  const [profile, setProfile] = useState<ProfileForm>({
    name: '', companyName: '', phone: '', vatNumber: '',
    addressLine1: '', addressCity: '', addressCountry: '', addressZip: '',
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Password
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [totpCode, setTotpCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaMsg, setTwoFaMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Facebook (associar conta)
  const [fbMsg, setFbMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [fbLoading, setFbLoading] = useState(false);

  // Subscription / invoices
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Referral
  const [referral, setReferral] = useState<{ code: string; referralCredits: number; count: number } | null>(null);
  const [refCopied, setRefCopied] = useState(false);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    // Load full profile from API
    api.get('/api/auth/me').then(({ data }) => {
      setProfile({
        name: data.name ?? '',
        companyName: data.companyName ?? '',
        phone: data.phone ?? '',
        vatNumber: data.vatNumber ?? '',
        addressLine1: data.addressLine1 ?? '',
        addressCity: data.addressCity ?? '',
        addressCountry: data.addressCountry ?? '',
        addressZip: data.addressZip ?? '',
      });
    });
    api.get('/api/auth/2fa/status').then(({ data }) => setTwoFaEnabled(data.enabled));

    // Load subscription invoices
    setInvLoading(true);
    api.get('/api/billing/platform-invoices')
      .then(({ data }) => setInvoices(data.invoices ?? []))
      .catch(() => {/* silently ignore */})
      .finally(() => setInvLoading(false));

    api.get('/api/referral/me')
      .then(({ data }) => setReferral({ code: data.code, referralCredits: data.referralCredits, count: data.referrals }))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  // Regresso do fluxo "Associar conta do Facebook" (ver GET /api/auth/facebook/callback):
  useEffect(() => {
    if (!router.isReady) return;
    const { fbLink, fbLinkError } = router.query as { fbLink?: string; fbLinkError?: string };
    if (fbLink === 'success') {
      setFbMsg({ type: 'ok', text: 'Conta do Facebook associada com sucesso!' });
      loadMe();
      router.replace(router.pathname, undefined, { shallow: true });
    } else if (fbLinkError) {
      setFbMsg({ type: 'err', text: fbLinkError });
      router.replace(router.pathname, undefined, { shallow: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  if (!tenant) return null;

  // ─── Profile save ─────────────────────────────────────────────────────────
  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setProfileSaving(true); setProfileMsg(null);
    try {
      await api.put('/api/auth/profile', profile);
      await loadMe();
      setProfileMsg({ type: 'ok', text: 'Perfil atualizado com sucesso!' });
    } catch {
      setProfileMsg({ type: 'err', text: 'Erro ao guardar. Tente novamente.' });
    } finally {
      setProfileSaving(false);
    }
  };

  // ─── Password change ───────────────────────────────────────────────────────
  const changePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) {
      setPwMsg({ type: 'err', text: 'As palavras-passe não coincidem.' });
      return;
    }
    if (pwForm.next.length < 8 || !/[A-Z]/.test(pwForm.next) || !/[0-9]/.test(pwForm.next)) {
      setPwMsg({ type: 'err', text: 'A nova palavra-passe deve ter pelo menos 8 caracteres, 1 maiúscula e 1 número.' });
      return;
    }
    setPwSaving(true); setPwMsg(null);
    try {
      await api.post('/api/auth/change-password', { currentPassword: pwForm.current, newPassword: pwForm.next });
      setPwMsg({ type: 'ok', text: 'Palavra-passe alterada! Sessão encerrada noutros dispositivos.' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Palavra-passe atual incorreta.';
      setPwMsg({ type: 'err', text: msg });
    } finally {
      setPwSaving(false);
    }
  };

  // ─── 2FA handlers ─────────────────────────────────────────────────────────
  const start2FASetup = async () => {
    setTwoFaLoading(true); setTwoFaMsg(null);
    try {
      const { data } = await api.post<SetupData>('/api/auth/2fa/setup');
      setSetupData(data); setSetupStep('qr');
    } catch { setTwoFaMsg({ type: 'err', text: 'Erro ao gerar QR code.' }); }
    finally { setTwoFaLoading(false); }
  };

  const enable2FA = async (e: FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true); setTwoFaMsg(null);
    try {
      await api.post('/api/auth/2fa/enable', { code: totpCode });
      setTwoFaEnabled(true); setSetupStep('done');
      setTwoFaMsg({ type: 'ok', text: '2FA ativado! A tua conta está protegida.' });
    } catch { setTwoFaMsg({ type: 'err', text: 'Código inválido. Tente novamente.' }); }
    finally { setTwoFaLoading(false); }
  };

  const disable2FA = async (e: FormEvent) => {
    e.preventDefault();
    setTwoFaLoading(true); setTwoFaMsg(null);
    try {
      await api.post('/api/auth/2fa/disable', { code: totpCode });
      setTwoFaEnabled(false); setSetupStep('idle'); setTotpCode('');
      setTwoFaMsg({ type: 'ok', text: '2FA desativado.' });
    } catch { setTwoFaMsg({ type: 'err', text: 'Código inválido.' }); }
    finally { setTwoFaLoading(false); }
  };

  // ─── Test-confirm payment ──────────────────────────────────────────────────
  const testConfirm = async (invoiceId: string) => {
    setConfirmingId(invoiceId); setConfirmMsg(null);
    try {
      await api.post(`/api/billing/test-confirm/${invoiceId}`);
      setConfirmMsg({ type: 'ok', text: 'Pagamento confirmado! Subscrição activada.' });
      // Reload invoices + tenant
      const { data } = await api.get('/api/billing/platform-invoices');
      setInvoices(data.invoices ?? []);
      await loadMe();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao confirmar';
      setConfirmMsg({ type: 'err', text: msg });
    } finally { setConfirmingId(null); }
  };

  // ─── Facebook (associar/desassociar conta) ─────────────────────────────────
  const handleLinkFacebook = async () => {
    setFbLoading(true); setFbMsg(null);
    try {
      const { data } = await api.get('/api/auth/facebook/link');
      window.location.href = data.url;
    } catch {
      setFbMsg({ type: 'err', text: 'Não foi possível iniciar a associação com o Facebook.' });
      setFbLoading(false);
    }
  };

  const handleUnlinkFacebook = async () => {
    setFbLoading(true); setFbMsg(null);
    try {
      await api.post('/api/auth/facebook/unlink');
      await loadMe();
      setFbMsg({ type: 'ok', text: 'Conta do Facebook desassociada.' });
    } catch {
      setFbMsg({ type: 'err', text: 'Erro ao desassociar a conta do Facebook.' });
    } finally {
      setFbLoading(false);
    }
  };

  const subStatus = tenant.subscriptionStatus ? SUB_STATUS[tenant.subscriptionStatus] : undefined;
  const subDays = tenant.subscriptionExpiresAt ? Math.ceil((new Date(tenant.subscriptionExpiresAt).getTime() - Date.now()) / 86400000) : null;
  const plansHref = ROUTES.plans ?? '/dashboard/plans';

  return (
    <AppLayout>
      <Head><title>Agentfy — Perfil</title></Head>
      <PageHeader title="Conta" subtitle="Dados de faturação, segurança, subscrição e preferências." />

      <div>
        {/* ─── Dados pessoais e faturação: um só formulário, um só Guardar ─── */}
        <form onSubmit={saveProfile}>
          <Section title="Dados pessoais" hint="Quem é o responsável pela conta. O nome e a empresa aparecem nas faturas.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome do responsável">
                <input className="input" value={profile.name} onChange={(e) => setProfile(f => ({ ...f, name: e.target.value }))} required />
              </Field>
              <Field label="Empresa">
                <input className="input" placeholder="Nome da empresa" value={profile.companyName} onChange={(e) => setProfile(f => ({ ...f, companyName: e.target.value }))} />
              </Field>
              <Field label="Email" hint="O email não pode ser alterado aqui.">
                <input className="input cursor-not-allowed bg-app-raised text-app-muted" value={tenant.email} readOnly />
              </Field>
              <Field label="Telefone">
                <input className="input" placeholder="+351 912 345 678" value={profile.phone} onChange={(e) => setProfile(f => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="NIF / VAT" hint="Necessário para emissão de fatura fiscal.">
                <input className="input num" placeholder="PT123456789" value={profile.vatNumber} onChange={(e) => setProfile(f => ({ ...f, vatNumber: e.target.value }))} />
              </Field>
            </div>
          </Section>

          <Section title="Morada de faturação" hint="Usada nas faturas da subscrição.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Morada" className="sm:col-span-2">
                <input className="input" placeholder="Rua, número, andar..." value={profile.addressLine1} onChange={(e) => setProfile(f => ({ ...f, addressLine1: e.target.value }))} />
              </Field>
              <Field label="Cidade">
                <input className="input" placeholder="Lisboa" value={profile.addressCity} onChange={(e) => setProfile(f => ({ ...f, addressCity: e.target.value }))} />
              </Field>
              <Field label="Código postal">
                <input className="input num" placeholder="1000-001" value={profile.addressZip} onChange={(e) => setProfile(f => ({ ...f, addressZip: e.target.value }))} />
              </Field>
              <Field label="País">
                <select className="input" value={profile.addressCountry} onChange={(e) => setProfile(f => ({ ...f, addressCountry: e.target.value }))}>
                  <option value="">Selecionar</option>
                  <option value="PT">Portugal</option>
                  <option value="BR">Brasil</option>
                  <option value="ES">Espanha</option>
                  <option value="FR">França</option>
                  <option value="DE">Alemanha</option>
                  <option value="GB">Reino Unido</option>
                  <option value="US">Estados Unidos</option>
                  <option value="OTHER">Outro</option>
                </select>
              </Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-app-rule pt-4">
              <button type="submit" className="btn-primary" disabled={profileSaving}>
                {profileSaving ? 'A guardar...' : 'Guardar alterações'}
              </button>
              <Notice m={profileMsg} />
            </div>
          </Section>
        </form>

        {/* ─── Subscrição ─── */}
        <Section
          title="Subscrição"
          hint="Plano atual, método de pagamento e faturas."
          aside={subStatus && <Pill tone={subStatus.tone} dot>{subStatus.label}</Pill>}
        >
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-app-muted">Plano</dt>
              <dd className="mt-0.5 text-base font-semibold capitalize text-app-ink">{tenant.plan}</dd>
            </div>
            <div>
              <dt className="text-sm text-app-muted">Método</dt>
              <dd className="mt-0.5 text-base font-semibold text-app-ink">{METHOD[tenant.subscriptionMethod ?? 'manual'] ?? 'Manual'}</dd>
            </div>
            <div>
              <dt className="text-sm text-app-muted">Próxima renovação</dt>
              <dd className="num mt-0.5 text-base font-semibold text-app-ink">{tenant.subscriptionExpiresAt ? isoDate(tenant.subscriptionExpiresAt) : '—'}</dd>
              {subDays !== null && (subDays > 0
                ? <p className="text-xs text-app-faint">{subDays} dias restantes</p>
                : <p className="text-xs text-app-neg">Expirou há {Math.abs(subDays)} dias</p>)}
            </div>
          </dl>
          <div className="mt-4"><Link href={plansHref} className="btn-secondary">Gerir plano</Link></div>

          <div className="mt-5 border-t border-app-rule pt-4">
            <h3 className="mb-2 text-sm font-semibold text-app-ink">Faturas</h3>
            <div className="mb-2"><Notice m={confirmMsg} /></div>
            {invLoading ? (
              <p className="text-sm text-app-muted">A carregar faturas…</p>
            ) : invoices.length > 0 ? (
              <InvoiceTable invoices={invoices.slice(0, 10)} canConfirm={!!tenant.isAdmin} onConfirm={testConfirm} confirmingId={confirmingId} />
            ) : (
              <p className="text-sm text-app-muted">Ainda não há faturas. <Link href={plansHref} className="font-medium text-app-accent hover:underline">Escolher um plano</Link></p>
            )}
          </div>
        </Section>

        {/* ─── Palavra-passe ─── */}
        <form onSubmit={changePassword}>
          <Section title="Palavra-passe" hint="Ao alterar, as sessões abertas noutros dispositivos são encerradas.">
            <div className="space-y-4">
              <Field label="Palavra-passe atual">
                <input type="password" className="input" autoComplete="current-password" value={pwForm.current} onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))} required />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nova palavra-passe" hint="Mínimo 8 caracteres, 1 maiúscula e 1 número.">
                  <input type="password" className="input" autoComplete="new-password" value={pwForm.next} onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))} required />
                </Field>
                <Field label="Confirmar nova">
                  <input type="password" className="input" autoComplete="new-password" value={pwForm.confirm} onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className="btn-secondary" disabled={pwSaving}>{pwSaving ? 'A alterar...' : 'Alterar palavra-passe'}</button>
                <Notice m={pwMsg} />
              </div>
            </div>
          </Section>
        </form>

        {/* ─── 2FA ─── */}
        <Section
          title="Autenticação de dois fatores"
          hint="Um código da app de autenticação, além da palavra-passe."
          aside={<Pill tone={twoFaEnabled ? 'pos' : 'neutral'} dot>{twoFaEnabled ? 'Ativa' : 'Inativa'}</Pill>}
        >
          <div className="space-y-3">
            <Notice m={twoFaMsg} />

            {!twoFaEnabled && setupStep === 'idle' && (
              <div>
                <p className="mb-3 text-sm text-app-muted">Proteja a conta com um código TOTP (Google Authenticator, Authy, etc).</p>
                <button className="btn-secondary" onClick={start2FASetup} disabled={twoFaLoading}>
                  {twoFaLoading ? 'A configurar...' : 'Ativar 2FA'}
                </button>
              </div>
            )}

            {setupStep === 'qr' && setupData && (
              <div>
                <p className="mb-3 text-sm text-app-muted">Leia o QR code com a app de autenticação e escreva o código de 6 dígitos.</p>
                <Image src={setupData.qrCodeDataUrl} alt="QR Code 2FA" width={176} height={176} className="rounded-lg border border-app-edge bg-white" />
                <form onSubmit={enable2FA} className="mt-4 flex max-w-sm items-end gap-3">
                  <Field label="Código de verificação" className="flex-1">
                    <input className="input num" placeholder="000000" maxLength={6} inputMode="numeric" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <button type="submit" className="btn-primary" disabled={twoFaLoading}>{twoFaLoading ? '...' : 'Verificar'}</button>
                </form>
              </div>
            )}

            {twoFaEnabled && setupStep !== 'qr' && (
              <div>
                <p className="mb-3 text-sm text-app-muted">O 2FA está ativo. Para desativar, escreva um código válido.</p>
                <form onSubmit={disable2FA} className="flex max-w-sm items-end gap-3">
                  <Field label="Código TOTP" className="flex-1">
                    <input className="input num" placeholder="000000" maxLength={6} inputMode="numeric" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} />
                  </Field>
                  <button type="submit" className="btn-secondary" disabled={twoFaLoading}>{twoFaLoading ? '...' : 'Desativar 2FA'}</button>
                </form>
              </div>
            )}
          </div>
        </Section>

        {/* ─── Facebook ─── */}
        <Section
          title="Conta do Facebook"
          hint="Entrar mais depressa, mesmo que o email do Facebook seja outro."
          aside={<Pill tone={tenant.facebookId ? 'pos' : 'neutral'}>{tenant.facebookId ? 'Associada' : 'Não associada'}</Pill>}
        >
          <div className="space-y-3">
            <p className="text-sm text-app-muted">
              Associe a conta do Facebook para entrar sem palavra-passe, sobretudo se o email do Facebook for diferente do desta conta ({tenant.email}).
            </p>
            <Notice m={fbMsg} />
            {tenant.facebookId ? (
              <button type="button" onClick={handleUnlinkFacebook} disabled={fbLoading} className="btn-secondary">
                {fbLoading ? 'A desassociar...' : 'Desassociar conta do Facebook'}
              </button>
            ) : (
              <button type="button" onClick={handleLinkFacebook} disabled={fbLoading} className="btn-secondary">
                {fbLoading ? 'A associar...' : 'Associar conta do Facebook'}
              </button>
            )}
          </div>
        </Section>

        {/* ─── Aparência ─── */}
        <Section title="Aparência" hint="O tema é guardado neste navegador.">
          <ThemeControl />
        </Section>

        {/* ─── Indicação ─── */}
        <Section title="Programa de indicação" hint="Por cada novo cliente que subscreva um plano pago com o seu código, ambos ganham 30 dias grátis.">
          {referral ? (
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-sm text-app-muted">Indicações</dt>
                  <dd className="num text-2xl font-semibold text-app-ink">{referral.count}</dd>
                </div>
                <div>
                  <dt className="text-sm text-app-muted">Dias de crédito</dt>
                  <dd className="num text-2xl font-semibold text-app-ink">{referral.referralCredits}</dd>
                </div>
              </dl>
              <div>
                <span className="mb-1 block text-sm font-medium text-app-ink">Código de indicação</span>
                <div className="flex flex-wrap gap-2">
                  <div className="input flex min-w-[10rem] flex-1 items-center">
                    <span className="num font-semibold tracking-widest text-app-ink">{referral.code}</span>
                  </div>
                  <button onClick={() => { navigator.clipboard.writeText(referral.code); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }} className="btn-secondary">
                    {refCopied ? 'Copiado' : 'Copiar código'}
                  </button>
                  <button onClick={() => { const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/register?ref=${referral.code}`; navigator.clipboard.writeText(url); setRefCopied(true); setTimeout(() => setRefCopied(false), 2000); }} className="btn-secondary">
                    {refCopied ? 'Copiado' : 'Copiar link'}
                  </button>
                </div>
              </div>
              <ol className="list-decimal space-y-1 pl-5 text-sm text-app-muted">
                <li>Partilhe o link <span className="num text-app-ink">/register?ref={referral.code}</span></li>
                <li>O amigo regista-se e subscreve um plano pago</li>
                <li>Ambos recebem 30 dias gratuitos no plano ativo</li>
              </ol>
            </div>
          ) : (
            <p className="text-sm text-app-muted">A carregar…</p>
          )}
        </Section>
      </div>
    </AppLayout>
  );
}
