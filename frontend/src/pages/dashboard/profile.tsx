import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import Navigation from '../../components/Navigation';
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

function ThemeCard() {
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

  const options: { value: Theme; label: string; icon: string }[] = [
    { value: 'light',  label: 'Claro',    icon: '☀️' },
    { value: 'dark',   label: 'Escuro',   icon: '🌙' },
    { value: 'system', label: 'Sistema',  icon: '💻' },
  ];

  return (
    <div className="card space-y-4">
      <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">🎨 Aparência</h2>
      <div className="flex gap-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => applyTheme(opt.value)}
            className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
              theme === opt.value
                ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                : 'border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className="text-xl">{opt.icon}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

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

  // Subscription / invoices
  interface PlatformInvoice {
    id: string; plan: string; amount: number; method: string; status: string;
    reference: string | null; entity: string | null;
    periodStart: string; periodEnd: string; paidAt: string | null; createdAt: string;
  }
  const [invoices, setInvoices] = useState<PlatformInvoice[]>([]);
  const [invLoading, setInvLoading] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

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

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Perfil</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Perfil & Conta</h1>

          {/* ─── Profile form ─────────────────────────────────────────── */}
          <form onSubmit={saveProfile} className="card space-y-5">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">👤 Dados pessoais & faturação</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do responsável *</label>
                <input className="input" value={profile.name} onChange={(e) => setProfile(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                <input className="input" placeholder="Nome da empresa" value={profile.companyName} onChange={(e) => setProfile(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                <input className="input bg-gray-50 dark:bg-gray-700 cursor-not-allowed" value={tenant.email} readOnly />
                <p className="text-[10px] text-gray-400 mt-0.5">O email não pode ser alterado aqui.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                <input className="input" placeholder="+351 912 345 678" value={profile.phone} onChange={(e) => setProfile(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">NIF / VAT</label>
                <input className="input" placeholder="PT123456789" value={profile.vatNumber} onChange={(e) => setProfile(f => ({ ...f, vatNumber: e.target.value }))} />
                <p className="text-[10px] text-gray-400 mt-0.5">Necessário para emissão de fatura fiscal.</p>
              </div>
            </div>

            <hr className="border-gray-100 dark:border-gray-700" />
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400">🏠 Endereço de faturação</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Morada</label>
                <input className="input" placeholder="Rua, número, andar..." value={profile.addressLine1} onChange={(e) => setProfile(f => ({ ...f, addressLine1: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cidade</label>
                <input className="input" placeholder="Lisboa" value={profile.addressCity} onChange={(e) => setProfile(f => ({ ...f, addressCity: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Código Postal</label>
                <input className="input" placeholder="1000-001" value={profile.addressZip} onChange={(e) => setProfile(f => ({ ...f, addressZip: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">País</label>
                <select className="input" value={profile.addressCountry} onChange={(e) => setProfile(f => ({ ...f, addressCountry: e.target.value }))}>
                  <option value="">-- Selecionar --</option>
                  <option value="PT">Portugal</option>
                  <option value="BR">Brasil</option>
                  <option value="ES">Espanha</option>
                  <option value="FR">França</option>
                  <option value="DE">Alemanha</option>
                  <option value="GB">Reino Unido</option>
                  <option value="US">Estados Unidos</option>
                  <option value="OTHER">Outro</option>
                </select>
              </div>
            </div>

            {profileMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${profileMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {profileMsg.text}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'A guardar...' : '💾 Guardar perfil'}
            </button>
          </form>

          {/* ─── Password change ───────────────────────────────────────── */}
          <form onSubmit={changePassword} className="card space-y-4">
            <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">🔑 Alterar palavra-passe</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Palavra-passe atual</label>
              <input type="password" className="input" value={pwForm.current} onChange={(e) => setPwForm(f => ({ ...f, current: e.target.value }))} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nova palavra-passe</label>
                <input type="password" className="input" placeholder="Min. 8 chars, 1 maiúscula, 1 número" value={pwForm.next} onChange={(e) => setPwForm(f => ({ ...f, next: e.target.value }))} required />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirmar nova</label>
                <input type="password" className="input" value={pwForm.confirm} onChange={(e) => setPwForm(f => ({ ...f, confirm: e.target.value }))} required />
              </div>
            </div>
            {pwMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${pwMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {pwMsg.text}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={pwSaving}>{pwSaving ? 'A alterar...' : '🔒 Alterar palavra-passe'}</button>
          </form>

          {/* ─── APARÊNCIA ────────────────────────────────────────────── */}
          <ThemeCard />

          {/* ─── 2FA ──────────────────────────────────────────────────── */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">🔐 Autenticação de dois fatores (2FA)</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${twoFaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {twoFaEnabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>

            {twoFaMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${twoFaMsg.type === 'ok' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                {twoFaMsg.text}
              </p>
            )}

            {!twoFaEnabled && setupStep === 'idle' && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  Protege a tua conta com um código TOTP (Google Authenticator, Authy, etc).
                </p>
                <button className="btn-primary text-sm" onClick={start2FASetup} disabled={twoFaLoading}>
                  {twoFaLoading ? 'A configurar...' : '🔐 Ativar 2FA'}
                </button>
              </div>
            )}

            {setupStep === 'qr' && setupData && (
              <div>
                <p className="text-sm text-gray-500 mb-3">Scan o QR code com a tua app de autenticação:</p>
                <Image src={setupData.qrCodeDataUrl} alt="QR Code 2FA" width={200} height={200} className="rounded-lg border" />
                <form onSubmit={enable2FA} className="mt-4 flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Código de verificação</label>
                    <input className="input" placeholder="000000" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <button type="submit" className="btn-primary" disabled={twoFaLoading}>{twoFaLoading ? '...' : 'Verificar'}</button>
                </form>
              </div>
            )}

            {twoFaEnabled && setupStep !== 'qr' && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">O 2FA está ativo. Para desativar, introduz um código válido.</p>
                <form onSubmit={disable2FA} className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Código TOTP</label>
                    <input className="input" placeholder="000000" maxLength={6} value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} />
                  </div>
                  <button type="submit" className="btn-secondary text-sm" disabled={twoFaLoading}>{twoFaLoading ? '...' : 'Desativar 2FA'}</button>
                </form>
              </div>
            )}
          </div>

          {/* ─── Subscrição / Platform billing ────────────────────────── */}
          <div className="card space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200">💳 Subscrição da plataforma</h2>
              <div className="flex items-center gap-2">
                {tenant.subscriptionStatus === 'active' && (
                  <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">✓ Ativa</span>
                )}
                {tenant.subscriptionStatus === 'suspended' && (
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-2 py-0.5 rounded-full font-medium">⛔ Suspensa</span>
                )}
                {tenant.subscriptionStatus === 'pending_payment' && (
                  <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-medium">⏳ Aguarda pagamento</span>
                )}
                {tenant.subscriptionStatus === 'trial' && (
                  <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full font-medium">🆓 Trial</span>
                )}
              </div>
            </div>

            {/* Current subscription details */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Plano</p>
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5 capitalize">{tenant.plan}</p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Método</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                  {tenant.subscriptionMethod === 'stripe' && '💳 Cartão (Stripe)'}
                  {tenant.subscriptionMethod === 'ifthenpay_mbway' && '📱 MB Way'}
                  {tenant.subscriptionMethod === 'ifthenpay_multibanco' && '🏧 Multibanco'}
                  {(tenant.subscriptionMethod === 'manual' || !tenant.subscriptionMethod) && '🔧 Manual'}
                </p>
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                <p className="text-[11px] text-gray-500 uppercase tracking-wide">Próxima renovação</p>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-0.5">
                  {tenant.subscriptionExpiresAt
                    ? new Date(tenant.subscriptionExpiresAt).toLocaleDateString('pt-PT')
                    : '—'}
                </p>
                {tenant.subscriptionExpiresAt && (() => {
                  const days = Math.ceil((new Date(tenant.subscriptionExpiresAt).getTime() - Date.now()) / 86400000);
                  return days > 0
                    ? <p className="text-[10px] text-gray-400">{days} dias restantes</p>
                    : <p className="text-[10px] text-red-500">Expirado há {Math.abs(days)} dias</p>;
                })()}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link href={ROUTES.plans ?? '/dashboard/plans'} className="btn-primary text-sm">🔄 Gerir plano</Link>
            </div>

            {/* Test-mode confirm message */}
            {confirmMsg && (
              <p className={`text-sm px-3 py-2 rounded-lg ${confirmMsg.type === 'ok' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}`}>
                {confirmMsg.text}
              </p>
            )}

            {/* Invoice history */}
            {invLoading ? (
              <p className="text-sm text-gray-400">A carregar faturas…</p>
            ) : invoices.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-2">Histórico de faturas</h3>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs min-w-[500px]">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        {['Data', 'Plano', 'Valor', 'Método', 'Estado', ''].map(h => (
                          <th key={h} className="text-left py-2 px-3 text-gray-500 font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.slice(0, 10).map(inv => (
                        <tr key={inv.id} className="border-t border-gray-100 dark:border-gray-700/50">
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {new Date(inv.createdAt).toLocaleDateString('pt-PT')}
                          </td>
                          <td className="py-2 px-3 text-gray-700 dark:text-gray-300 capitalize">{inv.plan}</td>
                          <td className="py-2 px-3 font-medium text-gray-800 dark:text-gray-200">€{inv.amount.toFixed(2)}</td>
                          <td className="py-2 px-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {inv.method === 'stripe' && '💳 Stripe'}
                            {inv.method === 'ifthenpay_mbway' && '📱 MB Way'}
                            {inv.method === 'ifthenpay_multibanco' && '🏧 Multibanco'}
                            {inv.method === 'manual' && '🔧 Manual'}
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                              inv.status === 'paid'    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                              inv.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                              inv.status === 'failed' || inv.status === 'expired' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {inv.status === 'paid' ? '✓ Pago' :
                               inv.status === 'pending' ? '⏳ Pendente' :
                               inv.status === 'failed' ? '✗ Falhou' :
                               inv.status === 'expired' ? 'Expirado' :
                               inv.status === 'cancelled' ? 'Cancelado' : inv.status}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {/* Superadmin test-confirm button */}
                            {tenant.isAdmin && inv.status === 'pending' && (
                              <button
                                onClick={() => testConfirm(inv.id)}
                                disabled={confirmingId === inv.id}
                                className="text-[10px] bg-brand-600 hover:bg-brand-700 text-white px-2 py-1 rounded-lg disabled:opacity-50 whitespace-nowrap"
                              >
                                {confirmingId === inv.id ? '…' : '🧪 Confirmar'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sem faturas ainda. <Link href={ROUTES.plans ?? '/dashboard/plans'} className="text-brand-600 hover:underline">Escolhe um plano →</Link></p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
