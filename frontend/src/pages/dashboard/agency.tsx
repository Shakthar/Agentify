import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import apiFetch from '../../utils/api';

interface SubAccount {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'starter' | 'business' | 'enterprise';
  subscriptionStatus: string;
  isActive: boolean;
  createdAt: string;
  _count?: { agents: number };
}

interface Branding {
  agencyName: string;
  agencyBrandColor: string;
  agencyLogoUrl: string;
}

const PLAN_COLORS: Record<string, string> = {
  free:       'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  starter:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  business:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  enterprise: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

const STATUS_COLORS: Record<string, string> = {
  active:          'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400',
  trial:           'bg-blue-100 text-blue-700',
  pending_payment: 'bg-amber-100 text-amber-700',
  suspended:       'bg-red-100 text-red-700',
};

export default function AgencyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'accounts' | 'branding'>('accounts');
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [branding, setBranding] = useState<Branding>({ agencyName: '', agencyBrandColor: '#6366f1', agencyLogoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [msg, setMsg] = useState('');

  // New account form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyName: '', plan: 'starter' as SubAccount['plan'] });
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Branding save
  const [brandingSaving, setBrandingSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [subRes, brandRes] = await Promise.all([
        apiFetch('/api/agency/subaccounts'),
        apiFetch('/api/agency/branding'),
      ]);
      setAccounts(subRes.subaccounts ?? []);
      setBranding({ agencyName: brandRes.agencyName ?? '', agencyBrandColor: brandRes.agencyBrandColor ?? '#6366f1', agencyLogoUrl: brandRes.agencyLogoUrl ?? '' });
    } catch (e: any) {
      if (e?.status === 403 || e?.message?.includes('403')) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setFormErr('');
    try {
      const sub = await apiFetch('/api/agency/subaccounts', { method: 'POST', body: JSON.stringify(formData) });
      setAccounts(prev => [sub, ...prev]);
      setShowForm(false);
      setFormData({ name: '', email: '', password: '', companyName: '', plan: 'starter' });
      setMsg('Subconta criada com sucesso!');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setFormErr(e?.message ?? 'Erro ao criar subconta.');
    } finally {
      setCreating(false);
    }
  };

  const handleChangePlan = async (subId: string, plan: SubAccount['plan']) => {
    try {
      const updated = await apiFetch(`/api/agency/subaccounts/${subId}`, { method: 'PATCH', body: JSON.stringify({ plan }) });
      setAccounts(prev => prev.map(a => a.id === subId ? { ...a, plan: updated.plan } : a));
    } catch { alert('Erro ao alterar plano.'); }
  };

  const handleToggleActive = async (subId: string, isActive: boolean) => {
    try {
      if (!isActive) {
        await apiFetch(`/api/agency/subaccounts/${subId}`, { method: 'DELETE' });
        setAccounts(prev => prev.map(a => a.id === subId ? { ...a, isActive: false, subscriptionStatus: 'suspended' } : a));
      } else {
        const updated = await apiFetch(`/api/agency/subaccounts/${subId}`, { method: 'PATCH', body: JSON.stringify({ isActive: true, subscriptionStatus: 'active' }) });
        setAccounts(prev => prev.map(a => a.id === subId ? { ...a, ...updated } : a));
      }
    } catch { alert('Erro.'); }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaving(true);
    try {
      const updated = await apiFetch('/api/agency/branding', { method: 'PATCH', body: JSON.stringify(branding) });
      setBranding(updated);
      setMsg('Branding guardado!');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Erro ao guardar.'); }
    finally { setBrandingSaving(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-16 text-center text-gray-400">A carregar…</main>
    </div>
  );

  if (forbidden) return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-4xl mb-4">🏢</p>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Painel de Agência</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">Esta funcionalidade está disponível no plano Agência. Inclui subcontas separadas, white-label e painel centralizado.</p>
        <button onClick={() => router.push('/dashboard/plans')} className="btn-primary">Ver planos →</button>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
              🏢 Painel de Agência
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{accounts.length} subconta{accounts.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex gap-2">
            {tab === 'accounts' && (
              <button onClick={() => setShowForm(true)} className="btn-primary text-sm">+ Nova subconta</button>
            )}
            <button onClick={() => router.back()} className="btn-secondary text-sm">← Voltar</button>
          </div>
        </div>

        {msg && <p className="text-xs text-green-600 dark:text-green-400 mb-3">{msg}</p>}

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-6 w-fit">
          {(['accounts', 'branding'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors ${tab === t ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
            >
              {t === 'accounts' ? '👥 Subcontas' : '🎨 Branding'}
            </button>
          ))}
        </div>

        {/* Create sub-account modal */}
        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-white">Nova subconta</h2>
                <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome do responsável *</label>
                  <input className="input w-full" required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Empresa</label>
                  <input className="input w-full" value={formData.companyName} onChange={e => setFormData(f => ({ ...f, companyName: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                  <input type="email" className="input w-full" required value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Password *</label>
                  <input type="password" className="input w-full" required minLength={8} value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} placeholder="Mín. 8 caracteres" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Plano</label>
                  <select className="input w-full" value={formData.plan} onChange={e => setFormData(f => ({ ...f, plan: e.target.value as SubAccount['plan'] }))}>
                    <option value="free">Free</option>
                    <option value="starter">Starter</option>
                    <option value="business">Business</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
              </div>
              {formErr && <p className="text-xs text-red-500">{formErr}</p>}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>{creating ? 'A criar…' : 'Criar subconta'}</button>
              </div>
            </form>
          </div>
        )}

        {/* Accounts tab */}
        {tab === 'accounts' && (
          <div className="card p-0 overflow-auto">
            {accounts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Ainda não tens subcontas.</p>
                <p className="text-xs text-gray-400 mt-1">Cria a primeira subconta para um cliente ou projeto.</p>
                <button onClick={() => setShowForm(true)} className="btn-primary text-sm mt-4">+ Criar primeira subconta</button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th className="text-left px-4 py-3 font-medium">Cliente</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Plano</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Estado</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Agentes</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Criado</th>
                    <th className="text-left px-4 py-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {accounts.map(a => (
                    <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!a.isActive ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{a.name}</div>
                        <div className="text-xs text-gray-400">{a.email}</div>
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <select
                          value={a.plan}
                          onChange={e => handleChangePlan(a.id, e.target.value as SubAccount['plan'])}
                          className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${PLAN_COLORS[a.plan]}`}
                        >
                          <option value="free">Free</option>
                          <option value="starter">Starter</option>
                          <option value="business">Business</option>
                          <option value="enterprise">Enterprise</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[a.subscriptionStatus] ?? 'bg-gray-100 text-gray-500'}`}>
                          {a.subscriptionStatus === 'active' ? '✓ Ativa' :
                           a.subscriptionStatus === 'suspended' ? '⛔ Suspensa' :
                           a.subscriptionStatus === 'trial' ? '🆓 Trial' :
                           a.subscriptionStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500">
                        {a._count?.agents ?? 0}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-400">
                        {new Date(a.createdAt).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleToggleActive(a.id, !a.isActive)}
                            className={`text-[10px] px-2 py-1 rounded font-medium transition-colors ${a.isActive ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400' : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400'}`}
                          >
                            {a.isActive ? '⏸ Suspender' : '▶ Ativar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Branding tab */}
        {tab === 'branding' && (
          <form onSubmit={handleSaveBranding} className="card max-w-lg space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">🎨 White-label da agência</h2>
              <p className="text-xs text-gray-400">Estas definições são aplicadas às subcontas que criares — o teu branding, não o da Agentfy.</p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nome da agência (para subcontas)</label>
              <input className="input w-full" placeholder="Ex: Minha Agência Digital" value={branding.agencyName} onChange={e => setBranding(b => ({ ...b, agencyName: e.target.value }))} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Cor principal (hex)</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={branding.agencyBrandColor} onChange={e => setBranding(b => ({ ...b, agencyBrandColor: e.target.value }))} className="w-10 h-9 rounded cursor-pointer border border-gray-200 dark:border-gray-600" />
                <input className="input flex-1 font-mono" placeholder="#6366f1" value={branding.agencyBrandColor} onChange={e => setBranding(b => ({ ...b, agencyBrandColor: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">URL do logótipo</label>
              <input type="url" className="input w-full" placeholder="https://..." value={branding.agencyLogoUrl} onChange={e => setBranding(b => ({ ...b, agencyLogoUrl: e.target.value }))} />
              {branding.agencyLogoUrl && (
                <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={branding.agencyLogoUrl} alt="Logo preview" className="h-10 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-xs text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Como funciona o white-label:</p>
              <p>As subcontas que criares veem a plataforma com o teu nome e cor em vez da Agentfy. Os teus clientes não sabem que usam a Agentfy — a experiência é 100% da tua agência.</p>
            </div>

            <button type="submit" className="btn-primary w-full" disabled={brandingSaving}>
              {brandingSaving ? 'A guardar…' : '💾 Guardar branding'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
