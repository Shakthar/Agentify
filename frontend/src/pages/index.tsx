import { useState, FormEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, API_URL } from '../utils/constants';
import Logo from '../components/Logo';

type Tab = 'login' | 'signup';

export default function Home() {
  const router = useRouter();
  const {
    tenant, login, signup, loading, error, clearError,
    pendingTwoFactor, completeTwoFactorLogin, cancelTwoFactor,
  } = useAuth();

  const [tab, setTab] = useState<Tab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  useEffect(() => {
    if (tenant) router.replace(ROUTES.dashboard);
  }, [tenant, router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      if (tab === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name, company || undefined);
        router.push(ROUTES.dashboard);
      }
    } catch {
      // error is set in the store
    }
  };

  const handleTwoFactor = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    try {
      await completeTwoFactorLogin(twoFactorCode);
      router.push(ROUTES.dashboard);
    } catch {
      setTwoFactorCode('');
    }
  };

  // --- Ecrã de 2FA ---
  if (pendingTwoFactor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <Logo size={48} className="justify-center mb-3" />
            <p className="text-gray-500 mt-2 text-sm">Verificação em dois passos</p>
          </div>
          <div className="card">
            <div className="text-center mb-6">
              <div className="text-4xl mb-3">🔐</div>
              <h2 className="text-lg font-semibold text-gray-900">Código de autenticação</h2>
              <p className="text-sm text-gray-500 mt-1">
                Abre o teu Google Authenticator, Authy ou similar e introduz o código de 6 dígitos.
              </p>
            </div>
            <form onSubmit={handleTwoFactor} className="space-y-4">
              <input
                className="input text-center text-2xl tracking-widest font-mono"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
                placeholder="000000"
                autoFocus
                required
              />
              {error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <button type="submit" className="btn-primary w-full py-2.5" disabled={loading || twoFactorCode.length !== 6}>
                {loading ? 'A verificar...' : 'Verificar'}
              </button>
              <button
                type="button"
                onClick={() => { cancelTwoFactor(); clearError(); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600 py-1"
              >
                ← Voltar ao login
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white dark:from-gray-950 dark:to-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Logo size={52} className="justify-center mb-3" />
          <p className="text-gray-500 mt-2 text-sm">Plataforma SaaS de Agentes IA</p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-6 -mt-2">
            {(['login', 'signup'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); clearError(); }}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  tab === t
                    ? 'border-b-2 border-brand-600 text-brand-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'login' ? 'Entrar' : 'Criar conta'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
                  <input
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="João Silva"
                    required
                    minLength={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                  <input
                    className="input"
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Minha Empresa Lda."
                  />
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password *</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={tab === 'signup' ? 'Mínimo 8 caracteres, 1 maiúscula, 1 número' : '••••••••'}
                required
                minLength={8}
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full py-2.5" disabled={loading}>
              {loading ? 'A processar...' : tab === 'login' ? 'Entrar' : 'Criar conta'}
            </button>
          </form>

          {/* Diagnóstico — só visível se o URL não for de produção */}
          {API_URL.includes('localhost') && (
            <p className="mt-4 text-xs text-center text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              ⚠️ A chamar backend local: <code className="font-mono">{API_URL}</code>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
