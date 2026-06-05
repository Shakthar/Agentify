import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';
import api from '../../utils/api';

type SetupStep = 'idle' | 'qr' | 'confirm' | 'done';

interface SetupData {
  qrCodeDataUrl: string;
  secret: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const { tenant, loadMe } = useAuth();

  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [setupStep, setSetupStep] = useState<SetupStep>('idle');
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    api.get('/api/auth/2fa/status').then(({ data }) => setTwoFaEnabled(data.enabled));
  }, []);

  if (!tenant) return null;

  const reset = () => { setCode(''); setError(null); setSuccess(null); };

  // --- STEP 1: Gerar QR ---
  const handleSetup = async () => {
    setLoading(true); setError(null);
    try {
      const { data } = await api.post<SetupData>('/api/auth/2fa/setup');
      setSetupData(data);
      setSetupStep('qr');
    } catch {
      setError('Erro ao gerar QR code');
    } finally {
      setLoading(false);
    }
  };

  // --- STEP 2: Confirmar e ativar ---
  const handleEnable = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api.post('/api/auth/2fa/enable', { code });
      setTwoFaEnabled(true);
      setSetupStep('done');
      setSuccess('2FA ativado com sucesso! A tua conta está agora protegida.');
      loadMe();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Código inválido');
    } finally {
      setLoading(false);
      setCode('');
    }
  };

  // --- Desativar 2FA ---
  const handleDisable = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(null);
    try {
      await api.post('/api/auth/2fa/disable', { code });
      setTwoFaEnabled(false);
      setSetupStep('idle');
      setSetupData(null);
      setSuccess('2FA desativado.');
      loadMe();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Código inválido');
    } finally {
      setLoading(false);
      setCode('');
    }
  };

  return (
    <div className="flex min-h-screen">
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Configurações</h1>
            <p className="text-gray-500 text-sm mt-1">Segurança e preferências da conta</p>
          </div>

          {/* Info da conta */}
          <div className="card mb-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Conta</h2>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span className="text-gray-400">Nome</span>
                <span>{tenant.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Email</span>
                <span>{tenant.email}</span>
              </div>
              {tenant.companyName && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Empresa</span>
                  <span>{tenant.companyName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-400">Plano</span>
                <span className="capitalize font-medium text-brand-600">{tenant.plan}</span>
              </div>
            </div>
          </div>

          {/* 2FA */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">Autenticação em dois fatores (2FA)</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                twoFaEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {twoFaEnabled ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <p className="text-sm text-gray-500 mb-5">
              Protege a conta com um código temporário gerado por uma app como{' '}
              <strong>Google Authenticator</strong>, <strong>Authy</strong> ou <strong>1Password</strong>.
              Estas apps suportam desbloqueio por <strong>biometria</strong> (Face ID / impressão digital) no telemóvel.
            </p>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4">{success}</p>
            )}

            {/* Estado: 2FA inativo, ainda não iniciou setup */}
            {!twoFaEnabled && setupStep === 'idle' && (
              <button className="btn-primary" onClick={handleSetup} disabled={loading}>
                {loading ? 'A gerar...' : 'Ativar 2FA'}
              </button>
            )}

            {/* Estado: mostrar QR code */}
            {!twoFaEnabled && setupStep === 'qr' && setupData && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">1. Escaneia com o teu autenticador:</p>
                  <div className="flex justify-center">
                    <Image
                      src={setupData.qrCodeDataUrl}
                      alt="QR Code 2FA"
                      width={200}
                      height={200}
                      className="rounded-lg border border-gray-200"
                    />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">
                    Ou introduz o código manualmente:
                  </p>
                  <code className="block bg-gray-100 text-gray-800 text-xs font-mono px-3 py-2 rounded-lg tracking-widest break-all">
                    {setupData.secret}
                  </code>
                </div>
                <form onSubmit={handleEnable} className="space-y-3">
                  <p className="text-sm font-medium text-gray-700">2. Introduz o código de 6 dígitos para confirmar:</p>
                  <input
                    className="input text-center text-xl tracking-widest font-mono"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { reset(); setCode(e.target.value.replace(/\D/g, '')); }}
                    placeholder="000000"
                    autoFocus
                    required
                  />
                  <div className="flex gap-3">
                    <button type="submit" className="btn-primary flex-1" disabled={loading || code.length !== 6}>
                      {loading ? 'A confirmar...' : 'Confirmar e ativar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSetupStep('idle'); setSetupData(null); reset(); }}
                      className="btn-secondary flex-1"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Estado: 2FA ativo — opção de desativar */}
            {twoFaEnabled && setupStep !== 'done' && (
              <form onSubmit={handleDisable} className="space-y-3">
                <p className="text-sm text-gray-600">
                  Para desativar, introduz um código do teu autenticador:
                </p>
                <input
                  className="input text-center text-xl tracking-widest font-mono"
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => { reset(); setCode(e.target.value.replace(/\D/g, '')); }}
                  placeholder="000000"
                  required
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  disabled={loading || code.length !== 6}
                >
                  {loading ? 'A desativar...' : 'Desativar 2FA'}
                </button>
              </form>
            )}

            {/* Estado: ativado com sucesso */}
            {setupStep === 'done' && (
              <p className="text-sm text-green-700">
                ✓ 2FA ativo. No próximo login serás pedido o código do autenticador.
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
