import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import api from '../../utils/api';
import { Agent, Plan, PLAN_LABELS, PLAN_COLORS } from '../../types';

const PLAN_ORDER = ['free', 'starter', 'business', 'enterprise'];
const WL_ADDON_PRICE: Record<string, string | null> = {
  free: null, starter: '€5/agente/mês', business: '€3/agente/mês', enterprise: 'Incluído',
};

type Tab = 'agents' | 'domain' | 'branding';

export default function WhitelabelPage() {
  const { tenant, loadMe } = useAuth();
  const { agents, fetchAgents, updateAgent, loading } = useAgent();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // Branding fields
  const [brandColor, setBrandColor] = useState(tenant?.brandColor ?? '#3b57f0');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl ?? '');
  const [companyName, setCompanyName] = useState(tenant?.companyName ?? '');

  // Domain fields
  const [domain, setDomain] = useState(tenant?.domain ?? '');

  useEffect(() => { fetchAgents(0, 100); }, [fetchAgents]);
  useEffect(() => {
    if (tenant) {
      setBrandColor(tenant.brandColor ?? '#3b57f0');
      setLogoUrl(tenant.logoUrl ?? '');
      setCompanyName(tenant.companyName ?? '');
      setDomain(tenant.domain ?? '');
    }
  }, [tenant]);

  if (!tenant) return null;

  const plan = tenant.plan as string;
  const planIdx = PLAN_ORDER.indexOf(plan);
  const addonPrice = WL_ADDON_PRICE[plan];
  const canUseWhitelabel = planIdx >= PLAN_ORDER.indexOf('starter');
  const wlAgents = agents.filter((a) => a.whitelabelEnabled);

  const flash = (ok: boolean, text: string) => {
    if (ok) { setMsg(text); setTimeout(() => setMsg(''), 3000); }
    else { setErrMsg(text); setTimeout(() => setErrMsg(''), 5000); }
  };

  const handleToggleWL = async (agent: Agent) => {
    try {
      const updated = await updateAgent(agent.id, { whitelabelEnabled: !agent.whitelabelEnabled });
      // refresh list
      await fetchAgents(0, 100);
      flash(true, agent.whitelabelEnabled ? 'White-label desativado.' : `White-label ativado! URL: /w/${updated.id}`);
    } catch {
      flash(false, 'Erro ao atualizar agente.');
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true); setMsg(''); setErrMsg('');
    try {
      const { data } = await api.put('/api/auth/profile', {
        companyName: companyName || undefined,
        brandColor: brandColor || undefined,
        logoUrl: logoUrl || undefined,
      });
      await loadMe();
      flash(true, 'Branding guardado!');
    } catch {
      flash(false, 'Erro ao guardar branding.');
    } finally { setSaving(false); }
  };

  const handleSaveDomain = async () => {
    setSaving(true); setMsg(''); setErrMsg('');
    try {
      const { data } = await api.put('/api/auth/profile', {
        domain: domain.trim() || undefined,
      });
      await loadMe();
      flash(true, 'Domínio guardado!');
    } catch {
      flash(false, 'Erro ao guardar domínio. Verifica se não está em uso por outro tenant.');
    } finally { setSaving(false); }
  };

  const BASE_URL = 'agentify.shaklabs.tech';

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — White-label</title></Head>
      <Navigation />
      <main className="flex-1 p-6 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-6">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🎨 White-label</h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                Páginas públicas de chat com a tua marca, sem branding Agentfy.
              </p>
            </div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_COLORS[plan as Plan]}`}>
              {PLAN_LABELS[plan as Plan]}
            </span>
          </div>

          {/* Plan gate for Free */}
          {!canUseWhitelabel && (
            <div className="card bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">🔒 Funcionalidade bloqueada</p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 mb-3">
                O White-label está disponível a partir do plano <strong>Starter</strong> como addon de €5/agente/mês.
              </p>
              <button onClick={() => router.push('/dashboard/plans')} className="btn-primary text-sm">
                Ver planos e fazer upgrade →
              </button>
            </div>
          )}

          {canUseWhitelabel && (
            <>
              {/* Stats bar */}
              <div className="grid grid-cols-3 gap-4">
                <div className="card text-center">
                  <p className="text-2xl font-bold text-brand-600">{wlAgents.length}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Agentes ativos</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-orange-500">
                    {addonPrice === 'Incluído' ? '€0' : addonPrice ? `€${parseInt(addonPrice) * wlAgents.length}` : '—'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Custo/mês estimado</p>
                </div>
                <div className="card text-center">
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 break-all">
                    {domain || BASE_URL}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">Domínio ativo</p>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-gray-200 dark:border-gray-700 gap-1">
                {([
                  { key: 'agents', label: '🤖 Agentes' },
                  { key: 'domain', label: '🌐 Domínio' },
                  { key: 'branding', label: '🎨 Branding' },
                ] as { key: Tab; label: string }[]).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`px-4 pb-2 text-sm font-medium transition-colors ${
                      activeTab === t.key
                        ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Flash messages */}
              {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-4 py-2">{msg}</p>}
              {errMsg && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">{errMsg}</p>}

              {/* === TAB: Agents === */}
              {activeTab === 'agents' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Ativa o white-label em cada agente individualmente.
                      {addonPrice && addonPrice !== 'Incluído' && (
                        <span className="ml-1 text-orange-600 font-medium">{addonPrice} por agente.</span>
                      )}
                    </p>
                  </div>
                  {loading && <p className="text-sm text-gray-400">A carregar agentes…</p>}
                  {agents.map((agent) => {
                    const wlUrl = `${domain || BASE_URL}/w/${agent.id}`;
                    return (
                      <div
                        key={agent.id}
                        className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                          agent.whitelabelEnabled
                            ? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                        }`}
                      >
                        <div className="w-9 h-9 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center shrink-0 text-sm font-bold text-brand-700">
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">{agent.name}</span>
                            {!agent.isActive && <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">Inativo</span>}
                            {agent.whitelabelEnabled && (
                              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">White-label ativo</span>
                            )}
                          </div>
                          {agent.description && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{agent.description}</p>
                          )}
                          {agent.whitelabelEnabled && (
                            <div className="mt-2 flex items-center gap-2">
                              <code className="text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-2 py-1 rounded font-mono break-all">
                                {wlUrl}
                              </code>
                              <a
                                href={`https://${wlUrl}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-brand-600 hover:underline shrink-0"
                              >
                                Abrir ↗
                              </a>
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleToggleWL(agent)}
                          className={`shrink-0 w-12 h-6 rounded-full transition-colors relative ${
                            agent.whitelabelEnabled ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600'
                          }`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                            agent.whitelabelEnabled ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                    );
                  })}
                  {agents.length === 0 && !loading && (
                    <div className="card text-center py-8">
                      <p className="text-gray-400">Ainda não tens agentes criados.</p>
                      <button onClick={() => router.push('/dashboard/create')} className="btn-primary text-sm mt-3">
                        Criar agente →
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* === TAB: Domain === */}
              {activeTab === 'domain' && (
                <div className="space-y-5">
                  <div className="card space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">URL padrão</h3>
                      <p className="text-xs text-gray-500 mb-3">Sem domínio próprio, as páginas ficam disponíveis em:</p>
                      <code className="text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg block font-mono">
                        {BASE_URL}/w/[agentId]
                      </code>
                    </div>

                    <hr className="border-gray-100 dark:border-gray-800" />

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Domínio personalizado
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        Ex: <code className="font-mono">chat.minha-empresa.pt</code> — sem https://
                      </p>
                      <input
                        className="input font-mono text-sm"
                        placeholder="chat.minha-empresa.pt"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value.replace(/^https?:\/\//, '').trim())}
                      />
                    </div>

                    <button
                      onClick={handleSaveDomain}
                      disabled={saving}
                      className="btn-primary text-sm"
                    >
                      {saving ? 'A guardar…' : 'Guardar domínio'}
                    </button>
                  </div>

                  {/* DNS Instructions */}
                  <div className="card bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                    <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-3">📋 Instruções DNS</h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      Para usar um domínio próprio, adiciona os seguintes registos no teu provedor DNS (GoDaddy, Cloudflare, etc.):
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-blue-200 dark:border-blue-800">
                            <th className="pb-2 pr-4">Tipo</th>
                            <th className="pb-2 pr-4">Nome / Host</th>
                            <th className="pb-2">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="space-y-1">
                          <tr className="border-b border-blue-100 dark:border-blue-900">
                            <td className="py-2 pr-4 font-semibold text-blue-600">CNAME</td>
                            <td className="py-2 pr-4 text-gray-700 dark:text-gray-300">{domain || 'chat'}</td>
                            <td className="py-2 text-gray-700 dark:text-gray-300">cname.vercel-dns.com</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <p className="text-xs text-yellow-700 dark:text-yellow-300 font-semibold mb-1">⚠️ Passo adicional obrigatório</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Após configurar o DNS, o domínio tem que ser adicionado nas definições do projeto Vercel.
                        Envia o domínio para <strong>contact@solutions.shaklabs.tech</strong> para ser ativado.
                      </p>
                    </div>
                    <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">ℹ️ Como funciona</p>
                      <ul className="text-xs text-gray-500 dark:text-gray-400 space-y-1 list-disc list-inside">
                        <li>As chamadas ao chat vão sempre para o servidor Agentfy</li>
                        <li>O domínio é só para a interface pública (página de chat)</li>
                        <li>SSL/HTTPS é configurado automaticamente pelo Vercel</li>
                        <li>Propagação DNS pode demorar até 48h</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {/* === TAB: Branding === */}
              {activeTab === 'branding' && (
                <div className="space-y-5">
                  <div className="card space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Nome da empresa
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Aparece no cabeçalho das páginas white-label.</p>
                      <input
                        className="input"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Minha Empresa Lda."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cor principal (brand color)
                      </label>
                      <p className="text-xs text-gray-500 mb-2">Usada em botões e elementos de destaque nas páginas públicas.</p>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={brandColor}
                          onChange={(e) => setBrandColor(e.target.value)}
                          className="w-12 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                        />
                        <input
                          className="input font-mono text-sm w-36"
                          value={brandColor}
                          onChange={(e) => setBrandColor(e.target.value)}
                          placeholder="#3b57f0"
                          maxLength={7}
                        />
                        <div
                          className="w-8 h-8 rounded-full shadow-inner border border-gray-200"
                          style={{ backgroundColor: brandColor }}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        URL do logotipo
                      </label>
                      <p className="text-xs text-gray-500 mb-2">
                        URL público de uma imagem (PNG/SVG). Recomendado: 200×60px.
                      </p>
                      <input
                        className="input font-mono text-sm"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        placeholder="https://minha-empresa.pt/logo.png"
                      />
                      {logoUrl && (
                        <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg inline-block">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt="Logo preview" className="h-8 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={handleSaveBranding}
                      disabled={saving}
                      className="btn-primary text-sm"
                    >
                      {saving ? 'A guardar…' : 'Guardar branding'}
                    </button>
                  </div>

                  {/* Preview */}
                  <div className="card">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">👁️ Pré-visualização do cabeçalho</h3>
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div
                        className="px-5 py-3 flex items-center gap-3"
                        style={{ backgroundColor: brandColor + '15', borderBottom: `2px solid ${brandColor}` }}
                      >
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={logoUrl} alt="logo" className="h-7 object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ backgroundColor: brandColor }}
                          >
                            {(companyName || tenant.companyName || 'E').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-gray-500 leading-tight">{companyName || tenant.companyName || 'Minha Empresa'}</p>
                          <p className="text-sm font-semibold text-gray-900 leading-tight">Assistente Virtual</p>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-50 dark:bg-gray-900 text-center text-xs text-gray-400">
                        Área de chat do agente
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
                         