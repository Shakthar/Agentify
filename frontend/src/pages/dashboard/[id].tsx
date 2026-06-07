import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import ChatWidget from '../../components/ChatWidget';
import KnowledgeBase from '../../components/KnowledgeBase';
import AgentDocs from '../../components/AgentDocs';
import Orders from '../../components/Orders';
import ConversationHistory from '../../components/ConversationHistory';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES, API_URL, AVAILABLE_MODELS_BY_PLAN } from '../../utils/constants';
import { Agent } from '../../types';
import api from '../../utils/api';

const WEBHOOK_URL = `${API_URL}/api/webhooks/whatsapp`;

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <div className="flex items-stretch gap-2">
        <pre className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-xs font-mono text-gray-700 dark:text-gray-200 overflow-x-auto whitespace-pre-wrap break-all">{value}</pre>
        <button onClick={copy} className="shrink-0 px-3 rounded-lg border border-gray-200 dark:border-gray-600 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
          {copied ? '✓' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

export default function AgentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { tenant } = useAuth();
  const { updateAgent, toggleAgent, deleteAgent } = useAgent();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'edit' | 'embed' | 'whatsapp' | 'knowledge' | 'docs' | 'orders' | 'history' | 'skills'>('overview');
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsMsg, setSkillsMsg] = useState('');
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [error, setError] = useState<string | null>(null);
  // WhatsApp state
  const [phoneId, setPhoneId] = useState('');
  const [notifyPhone, setNotifyPhone] = useState('');
  const [wpEnabled, setWpEnabled] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpMsg, setWpMsg] = useState('');
  const [wpTokenOk, setWpTokenOk] = useState(true);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    if (!id) return;
    api.get(`/api/agents/${id}`).then(({ data }) => {
      setAgent(data);
      setEditForm({ name: data.name, description: data.description, systemPrompt: data.systemPrompt, model: data.model, temperature: data.temperature, maxTokens: data.maxTokens });
      setPhoneId(data.whatsappNumber ?? '');
      setNotifyPhone(data.notifyPhone ?? '');
      setWpEnabled(data.whatsappEnabled ?? false);
    }).catch(() => router.replace(ROUTES.agents)).finally(() => setLoading(false));
    api.get('/api/webhooks/whatsapp/status').then(({ data }) => setWpTokenOk(data.configured)).catch(() => {});
  }, [tenant, id]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAgent(agent.id, editForm);
      setAgent(updated);
      setActiveTab('overview');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!agent) return;
    await toggleAgent(agent.id);
    setAgent((prev) => prev ? { ...prev, isActive: !prev.isActive } : null);
  };

  const handleSaveWhatsApp = async () => {
    if (!agent) return;
    setWpSaving(true);
    try {
      const updated = await updateAgent(agent.id, { whatsappNumber: phoneId, whatsappEnabled: wpEnabled, notifyPhone: notifyPhone || undefined });
      setAgent(updated);
      setWpMsg('Guardado com sucesso!');
      setTimeout(() => setWpMsg(''), 3000);
    } catch {
      setWpMsg('Erro ao guardar.');
    } finally {
      setWpSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (!confirm(`Eliminar agente "${agent.name}"?`)) return;
    await deleteAgent(agent.id);
    router.push(ROUTES.agents);
  };

  if (!tenant || loading) return null;
  if (!agent) return null;

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — {agent.name}</title></Head>
      <Navigation />
        <main className="flex-1 p-8 overflow-y-auto bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 dark:bg-brand-900/40 flex items-center justify-center text-brand-700 dark:text-brand-300 font-bold text-xl">
                {agent.name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{agent.description || agent.model}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggle}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  agent.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {agent.isActive ? 'Ativo' : 'Inativo'}
              </button>
              <button onClick={handleDelete} className="btn-secondary text-xs text-red-500 hover:text-red-700">
                Eliminar
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6 gap-1 flex-wrap">
            {([
                          { key: 'overview',   label: '📊 Visão geral' },
              { key: 'chat',       label: '💬 Testar chat' },
              { key: 'knowledge',  label: '🧠 Conhecimento' },
              { key: 'docs',       label: '📎 Documentos' },
              { key: 'orders',     label: '🛒 Pedidos' },
              { key: 'embed',      label: '🌐 Web Embed' },
              { key: 'whatsapp',   label: '📱 WhatsApp' },
              { key: 'history',    label: '� Histórico' },              { key: 'skills',     label: '⚡ Skills' },              { key: 'edit',       label: '✏️ Editar' },
            ] as { key: typeof activeTab; label: string }[]).map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`px-3 pb-2 text-sm font-medium transition-colors ${
                  activeTab === t.key ? 'border-b-2 border-brand-600 text-brand-700 dark:text-brand-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === 'overview' && (() => {
            const plan = tenant.plan ?? 'free';
            const modelList = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;
            const modelInfo = modelList.find((m) => m.value === agent.model);
            return (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="card"><p className="text-sm text-gray-500 dark:text-gray-400">Conversas</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.totalConversations}</p></div>
              <div className="card"><p className="text-sm text-gray-500 dark:text-gray-400">Mensagens</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.totalMessages}</p></div>
              <div className="card"><p className="text-sm text-gray-500 dark:text-gray-400">Taxa de resolução</p><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{Math.round((agent.averageResolution ?? 0) * 100)}%</p></div>

              {/* Configuração de IA */}
              <div className="card col-span-full">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Modelo de IA</p>
                <div className="flex flex-wrap gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-gray-900 dark:text-gray-100">
                        {modelInfo?.label ?? agent.model}
                      </span>
                      {modelInfo?.badge && (
                        <span className="text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full font-medium">{modelInfo.badge}</span>
                      )}
                      {agent.model === 'auto' && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">Seleção dinâmica</span>
                      )}
                    </div>
                    {modelInfo?.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{modelInfo.description}</p>
                    )}
                  </div>
                  <div className="flex gap-4 text-sm shrink-0">
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Temperatura</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{agent.temperature}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-gray-400 dark:text-gray-500 mb-0.5">Máx. tokens</p>
                      <p className="font-semibold text-gray-700 dark:text-gray-200">{agent.maxTokens}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('edit')}
                    className="text-xs text-brand-600 dark:text-brand-400 hover:underline shrink-0"
                  >
                    Alterar modelo →
                  </button>
                </div>
              </div>

              <div className="card col-span-full">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">System Prompt</p>
                <pre className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap font-sans bg-gray-50 dark:bg-gray-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {agent.systemPrompt}
                </pre>
              </div>
              <div className="card col-span-full">
                <p className="text-sm text-gray-500 mb-3">Skills activas</p>
                <div className="flex flex-wrap gap-2">
                  {agent.skillHandoff && <span className="bg-brand-100 text-brand-700 text-xs px-3 py-1 rounded-full">Handoff IA</span>}
                  {agent.skillDataCollection && <span className="bg-brand-100 text-brand-700 text-xs px-3 py-1 rounded-full">Data Collection</span>}
                  {agent.skillScheduling && <span className="bg-brand-100 text-brand-700 text-xs px-3 py-1 rounded-full">Scheduling</span>}
                  {agent.skillFileUpload && <span className="bg-brand-100 text-brand-700 text-xs px-3 py-1 rounded-full">File Upload</span>}
                  {agent.skillHumorDetection && <span className="bg-purple-100 text-purple-700 text-xs px-3 py-1 rounded-full">Humor Detection</span>}
                </div>
              </div>
            </div>
            );
          })()}

          {/* Chat test */}
          {activeTab === 'chat' && (
            <ChatWidget agentId={agent.id} tenantId={tenant.id} />
          )}

          {/* ⚡ Skills */}
          {activeTab === 'skills' && (() => {
            const plan = tenant.plan as string ?? 'free';
            const planOrder = ['free','starter','pro','business','enterprise'];
            const planIdx = planOrder.indexOf(plan);

            const SKILLS_DEF = [
              { key: 'skillHandoff',        label: 'Handoff para humano',     icon: '🔀', desc: 'Transfere a conversa para um agente humano quando necessário.', minPlan: 'free', field: 'skillHandoff', addonPrice: null as string | null },
              { key: 'skillDataCollection', label: 'Recolha de dados',         icon: '📋', desc: 'Recolhe informação estruturada do utilizador (formulários conversacionais).', minPlan: 'free', field: 'skillDataCollection', addonPrice: null as string | null },
              { key: 'skillScheduling',     label: 'Agendamento',             icon: '📅', desc: 'Agenda consultas, reuniões ou serviços automaticamente.', minPlan: 'starter', field: 'skillScheduling', addonPrice: '€7/mês' },
              { key: 'skillFileUpload',     label: 'Envio de ficheiros',       icon: '📁', desc: 'Permite ao agente enviar documentos, catálogos e ficheiros ao utilizador.', minPlan: 'starter', field: 'skillFileUpload', addonPrice: '€5/mês' },
              { key: 'skillHumorDetection', label: 'Deteção de humor',         icon: '😊', desc: 'Analisa o sentimento do utilizador e adapta o tom do agente.', minPlan: 'pro', field: 'skillHumorDetection', addonPrice: '€9/mês' },
            ];

            const MB_WAY_COST: Record<string, string | null> = {
              free: null, starter: '25 crd/transação', pro: '15 crd/transação', business: 'Incluído', enterprise: 'Incluído',
            };
            const mbwayCost = MB_WAY_COST[plan] ?? null;

            const handleToggleSkill = async (field: string, current: boolean) => {
              setSkillsSaving(true); setSkillsMsg('');
              try {
                const updated = await updateAgent(agent.id, { [field]: !current });
                setAgent(updated);
                setSkillsMsg('Guardado!');
                setTimeout(() => setSkillsMsg(''), 2000);
              } catch { setSkillsMsg('Erro ao guardar.'); }
              finally { setSkillsSaving(false); }
            };

            return (
              <div className="space-y-4">
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">⚡ Skills do agente</h3>
                  {skillsMsg && <p className="text-xs text-green-600 mb-3">{skillsMsg}</p>}
                  <div className="space-y-3">
                    {SKILLS_DEF.map((skill) => {
                      const minIdx = planOrder.indexOf(skill.minPlan);
                      const locked = planIdx < minIdx;
                      const active = !!((agent as unknown as Record<string,unknown>)[skill.field]);
                      return (
                        <div key={skill.key} className={`flex items-start gap-4 p-3 rounded-xl border transition-colors ${
                          locked ? 'border-orange-100 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-900/10'
                          : active ? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10'
                          : 'border-gray-200 dark:border-gray-700'
                        }`}>
                          <span className="text-2xl mt-0.5">{skill.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{skill.label}</span>
                              {locked && skill.addonPrice && (
                                <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                                  Addon {skill.addonPrice}
                                </span>
                              )}
                              {locked && !skill.addonPrice && (
                                <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">
                                  Requer {skill.minPlan.charAt(0).toUpperCase() + skill.minPlan.slice(1)}+
                                </span>
                              )}
                              {active && !locked && (
                                <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Ativa</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{skill.desc}</p>
                            {locked && skill.addonPrice && (
                              <button
                                onClick={() => router.push('/dashboard/plans')}
                                className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 underline hover:no-underline"
                              >
                                Ativar por {skill.addonPrice} →
                              </button>
                            )}
                          </div>
                          <button
                            disabled={locked || skillsSaving}
                            onClick={() => handleToggleSkill(skill.field, active)}
                            className={`shrink-0 w-11 h-6 rounded-full transition-colors relative ${
                              locked ? 'bg-gray-200 dark:bg-gray-700 cursor-not-allowed opacity-40'
                              : active ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-600'
                            }`}
                          >
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${active && !locked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      );
                    })}

                    {/* MB Way payment skill */}
                    <div className={`flex items-start gap-4 p-3 rounded-xl border ${
                      mbwayCost === null ? 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                      : 'border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10'
                    }`}>
                      <span className="text-2xl mt-0.5">💳</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Cobrança MB Way</span>
                          {mbwayCost === null && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">Requer Starter+</span>}
                          {mbwayCost && mbwayCost !== 'Incluído' && <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full">{mbwayCost} (pay-per-use)</span>}
                          {mbwayCost === 'Incluído' && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Incluído no plano</span>}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          Inicia cobranças MB Way diretamente na conversa. Créditos debitados por transação — só pagas o que usas.
                        </p>
                      </div>
                    </div>

                    {/* Whitelabel portal */}
                    {(() => {
                      const wlIncluded = planIdx >= planOrder.indexOf('business');
                      const wlAddon = !wlIncluded ? (plan === 'starter' ? '€15/mês' : plan === 'pro' ? '€9/mês' : null) : null;
                      return (
                        <div className={`flex items-start gap-4 p-3 rounded-xl border ${
                          wlIncluded ? 'border-brand-200 dark:border-brand-800 bg-brand-50/50 dark:bg-brand-900/10'
                          : wlAddon ? 'border-orange-100 dark:border-orange-900/40 bg-orange-50/60 dark:bg-orange-900/10'
                          : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 opacity-60'
                        }`}>
                          <span className="text-2xl mt-0.5">🎨</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Portal White-label</span>
                              {wlIncluded && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Incluído no plano</span>}
                              {wlAddon && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon {wlAddon}</span>}
                              {!wlIncluded && !wlAddon && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 px-1.5 py-0.5 rounded-full">Requer Starter+</span>}
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                              Portal público com a tua marca, sem branding Agentfy. URL: agentify.shaklabs.tech/w/{tenant.id}
                            </p>
                            {wlAddon && (
                              <button onClick={() => router.push('/dashboard/plans')} className="mt-2 text-[11px] text-orange-600 dark:text-orange-400 underline hover:no-underline">
                                Ativar por {wlAddon} →
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Upgrade prompt if any locked */}
                {(SKILLS_DEF.some(s => planOrder.indexOf(s.minPlan) > planIdx) || planIdx < planOrder.indexOf('business')) && (
                  <div className="card bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">⚡ Addons disponíveis</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-3">
                      Podes ativar skills individualmente como addons mensais, ou fazer upgrade do plano para as incluir todas.
                    </p>
                    <button onClick={() => router.push('/dashboard/plans')} className="btn-primary text-sm">Ver planos e addons →</button>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Edit */}
          {activeTab === 'edit' && (() => {
            const plan = tenant.plan ?? 'free';
            const modelList = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;
            return (
            <div className="card space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome</label>
                <input className="input" value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descrição</label>
                <input className="input" value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt</label>
                <textarea className="input resize-none" rows={10} value={editForm.systemPrompt ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, systemPrompt: e.target.value }))} />
              </div>

              {/* Modelo de IA */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Modelo de IA</label>
                <div className="space-y-2">
                  {modelList.map((m) => (
                    <label
                      key={m.value}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        editForm.model === m.value
                          ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 dark:border-brand-500'
                          : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <input
                        type="radio"
                        className="accent-brand-600 mt-0.5 shrink-0"
                        checked={editForm.model === m.value}
                        onChange={() => setEditForm((f) => ({ ...f, model: m.value }))}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{m.label}</span>
                          {m.badge && (
                            <span className="text-xs bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full">{m.badge}</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{m.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Temperatura + tokens */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Temperatura: <span className="text-brand-600">{editForm.temperature ?? agent.temperature}</span>
                  </label>
                  <input
                    type="range" min="0" max="2" step="0.1"
                    value={editForm.temperature ?? agent.temperature}
                    onChange={(e) => setEditForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                    className="w-full accent-brand-600"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                    <span>Preciso</span><span>Criativo</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Máx. tokens</label>
                  <select
                    className="input"
                    value={editForm.maxTokens ?? agent.maxTokens}
                    onChange={(e) => setEditForm((f) => ({ ...f, maxTokens: parseInt(e.target.value) }))}
                  >
                    {[500, 1000, 2000, 4000, 8000].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'A guardar...' : 'Guardar'}</button>
                <button className="btn-secondary" onClick={() => setActiveTab('overview')}>Cancelar</button>
              </div>
            </div>
            );
          })()}

          {/* ─── Knowledge Base ─── */}
          {activeTab === 'knowledge' && agent && (
            <KnowledgeBase agentId={agent.id} />
          )}

          {/* ─── Documentos enviáveis ─── */}
          {activeTab === 'docs' && agent && (
            <AgentDocs agentId={agent.id} />
          )}

          {/* ─── Pedidos MB Way ─── */}
          {activeTab === 'orders' && agent && (
            <Orders agentId={agent.id} plan={tenant.plan ?? 'free'} />
          )}

          {/* ─── Web Embed ─── */}
          {activeTab === 'embed' && (() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.agentify.com';
            const chatUrl = `${origin}/chat/${agent.id}`;
            const iframe = `<iframe\n  src="${chatUrl}"\n  width="420"\n  height="600"\n  style="border:none; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.15);"\n  title="${agent.name}"\n></iframe>`;
            const widget = `<!-- Agentify Chat Widget -->\n<script>\n(function(){\n  var btn=document.createElement('div');\n  btn.style='position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#6d28d9;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999';\n  btn.innerHTML='<svg width=28 height=28 fill=none viewBox=\"0 0 24 24\"><path fill=#fff d=\"M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.38-4.88A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2Z\"/></svg>';\n  var frame=document.createElement('iframe');\n  frame.src='${chatUrl}';\n  frame.style='position:fixed;bottom:96px;right:24px;width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9998;display:none';\n  var open=false;\n  btn.onclick=function(){open=!open;frame.style.display=open?'block':'none';btn.style.background=open?'#4c1d95':'#6d28d9';};\n  document.body.appendChild(frame);\n  document.body.appendChild(btn);\n})();\n</script>`;
            return (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">URL direta</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Partilha este link ou abre numa nova aba para testar.</p>
                  <CopyBox value={chatUrl} label="URL do chat" />
                  <a href={chatUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs mt-3 inline-block">Abrir em nova aba →</a>
                </div>

                <div className="card">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Opção 1 — iframe</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Cola este HTML onde queres que o chat appareça na página.</p>
                  <CopyBox value={iframe} label="Código HTML" />
                </div>

                <div className="card">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Opção 2 — Widget flutuante <span className="text-xs text-brand-600 font-normal">(recomendado)</span></h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Cola antes do <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">&lt;/body&gt;</code>. Appareçe como botão roxo no canto inferior direito.</p>
                  <CopyBox value={widget} label="Snippet JavaScript" />
                </div>

                <div className="card bg-blue-50 border-blue-200">
                  <p className="text-sm text-blue-700 space-y-1">
                    <strong>WordPress:</strong> Usa o plugin WPCode e cola o snippet da Opção 2.<br />
                    <strong>Shopify:</strong> <em>Online Store → Themes → Edit code → theme.liquid</em> → antes de <code>&lt;/body&gt;</code>.<br />
                    <strong>Wix / Squarespace:</strong> Bloco "HTML Embed" com o iframe da Opção 1.
                  </p>
                </div>
              </div>
            );
          })()}

          {/* ─── Histórico de conversas ─── */}
          {activeTab === 'history' && agent && (
            <ConversationHistory agentId={agent.id} />
          )}

          {/* ─── WhatsApp ─── */}
          {activeTab === 'whatsapp' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 1 — Conta Meta for Developers</h2>
                <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
                  <li>Vai a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">developers.facebook.com</a> e cria uma App do tipo <strong>Business</strong>.</li>
                  <li>Adiciona o produto <strong>WhatsApp</strong> à app.</li>
                  <li>Em <em>WhatsApp → Getting Started</em>, copia o <strong>Phone Number ID</strong> (número longo — não é o número de telefone).</li>
                  <li>Gera um <strong>Access Token</strong> (temporário para testes ou permanente via System User).</li>
                </ol>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 2 — Configurar Webhook no Meta</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Em <em>WhatsApp → Configuration → Webhook</em>:</p>
                <div className="space-y-3">
                  <CopyBox value={WEBHOOK_URL} label="Callback URL" />
                  <CopyBox value="agentify_whatsapp_verify_2025" label="Verify Token" />
                </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Subscreve o campo <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">messages</code>.</p>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 3 — Ligar este agente</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number ID <span className="text-gray-400 dark:text-gray-500 font-normal">(ID numérico do Meta)</span>
                    </label>
                    <input className="input" placeholder="ex: 123456789012345" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número de notificação <span className="text-gray-400 dark:text-gray-500 font-normal">(WhatsApp do dono — recebe alerta de pedidos pagos)</span>
                    </label>
                    <input className="input" placeholder="ex: 351912345678" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={wpEnabled}
                      onClick={() => setWpEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${wpEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${wpEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm text-gray-700 dark:text-gray-300">WhatsApp ativo neste agente</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button onClick={handleSaveWhatsApp} disabled={wpSaving} className="btn-primary">
                      {wpSaving ? 'A guardar...' : 'Guardar configuração'}
                    </button>
                    {wpMsg && <span className={`text-sm ${wpMsg.includes('Erro') ? 'text-red-500' : 'text-green-600'}`}>{wpMsg}</span>}
                  </div>
                </div>
              </div>

              {wpTokenOk ? (
                <div className="card bg-green-50 border-green-200">
                  <p className="text-sm text-green-700">
                    ✅ <strong>Token configurado.</strong> O backend está pronto para enviar e receber mensagens WhatsApp.
                  </p>
                </div>
              ) : (
                <div className="card bg-amber-50 border-amber-200">
                  <p className="text-sm text-amber-800">
                    <strong>⚠️ Falta no servidor:</strong> abre <code className="bg-amber-100 px-1 rounded">backend/.env</code> e preenche:
                  </p>
                  <pre className="mt-2 text-xs bg-amber-100 rounded p-3 font-mono">{`WHATSAPP_TOKEN="<token gerado no Meta>"`}</pre>
                  <p className="text-xs text-amber-700 mt-1">Reinicia o backend depois.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
