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
const INSTAGRAM_WEBHOOK_URL = `${API_URL}/api/webhooks/instagram`;

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
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'edit' | 'embed' | 'whatsapp' | 'instagram' | 'knowledge' | 'docs' | 'orders' | 'history' | 'skills' | 'integrations'>('overview');
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsMsg, setSkillsMsg] = useState('');
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [error, setError] = useState<string | null>(null);
  // WhatsApp state
  const [phoneId, setPhoneId] = useState('');
  const [notifyPhone, setNotifyPhone] = useState('');
  const [wpEnabled, setWpEnabled] = useState(false);
  const [wpToken, setWpToken] = useState('');
  const [wpTokenVisible, setWpTokenVisible] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpMsg, setWpMsg] = useState('');
  const [wpTokenOk, setWpTokenOk] = useState(true);
  const [tmSaving, setTmSaving] = useState(false);
  const [intSaving, setIntSaving] = useState(false);
  const [intMsg, setIntMsg] = useState('');
  // Instagram state
  const [igAccountId, setIgAccountId] = useState('');
  const [igEnabled, setIgEnabled] = useState(false);
  const [igToken, setIgToken] = useState('');
  const [igTokenVisible, setIgTokenVisible] = useState(false);
  const [igSaving, setIgSaving] = useState(false);
  const [igMsg, setIgMsg] = useState('');

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    if (!id) return;
    api.get(`/api/agents/${id}`).then(({ data }) => {
      setAgent(data);
      setEditForm({ name: data.name, description: data.description, systemPrompt: data.systemPrompt, model: data.model, temperature: data.temperature, maxTokens: data.maxTokens });
      setPhoneId(data.whatsappNumber ?? '');
      setNotifyPhone(data.notifyPhone ?? '');
      setWpEnabled(data.whatsappEnabled ?? false);
      // token is write-only — never returned from API, leave blank
      setIgAccountId(data.instagramAccountId ?? '');
      setIgEnabled(data.instagramEnabled ?? false);
      // instagram token is also write-only
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
      const payload: Record<string, unknown> = { whatsappNumber: phoneId, whatsappEnabled: wpEnabled, notifyPhone: notifyPhone || undefined };
      if (wpToken.trim()) payload.whatsappToken = wpToken.trim();
      const updated = await updateAgent(agent.id, payload);
      setAgent(updated);
      setWpMsg('Guardado com sucesso!');
      setTimeout(() => setWpMsg(''), 3000);
    } catch {
      setWpMsg('Erro ao guardar.');
    } finally {
      setWpSaving(false);
    }
  };

  const handleSaveInstagram = async () => {
    if (!agent) return;
    setIgSaving(true);
    setIgMsg('');
    try {
      const payload: Record<string, unknown> = { instagramAccountId: igAccountId, instagramEnabled: igEnabled, notifyPhone: notifyPhone || undefined };
      if (igToken.trim()) payload.instagramToken = igToken.trim();
      const updated = await updateAgent(agent.id, payload);
      setAgent(updated);
      setIgMsg('Guardado com sucesso!');
      setTimeout(() => setIgMsg(''), 3000);
    } catch {
      setIgMsg('Erro ao guardar.');
    } finally {
      setIgSaving(false);
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

  const handleToggleTestMode = async () => {
    if (agent.testMode) {
      if (!confirm('Ativar modo produção? Pagamentos passarão a ser reais e os agendamentos usarão a agenda real. Confirmas?')) return;
    }
    setTmSaving(true);
    try {
      const updated = await updateAgent(agent.id, { testMode: !agent.testMode });
      setAgent(updated);
    } catch { /* ignore */ }
    finally { setTmSaving(false); }
  };

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
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{agent.name}</h1>
                  {agent.testMode && (
                    <span className="text-xs bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 px-2 py-0.5 rounded-full font-medium border border-yellow-300 dark:border-yellow-700">🧪 Modo Teste</span>
                  )}
                </div>
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
              { key: 'instagram',  label: '📸 Instagram' },
              { key: 'history',    label: '📁 Histórico' },
              { key: 'skills',     label: '⚡ Skills' },
              { key: 'edit',       label: '✏️ Editar' },
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
            const planOrder = ['free','starter','business','enterprise'];
            const planIdx = planOrder.indexOf(plan);
            const isAdmin = !!tenant.isAdmin; // admins bypass all plan/addon gates (test mode)

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

            function TogglePill({ active, locked, disabled, onClick, label }: {
              active: boolean; locked: boolean; disabled: boolean; onClick: () => void; label: string;
            }) {
              return (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClick}
                  aria-label={label}
                  className={[
                    'shrink-0 w-11 h-6 rounded-full transition-colors duration-200 overflow-hidden flex items-center px-0.5',
                    locked ? 'opacity-40 cursor-not-allowed' : '',
                    active && !locked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600',
                  ].join(' ')}
                >
                  <span className={[
                    'w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    active && !locked ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')} />
                </button>
              );
            }

            function PlanBadge({ plan: p, label }: { plan: string; label: string }) {
              const cls = p === 'free'    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : p === 'starter'         ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400';
              return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
            }

            const SKILLS_DEF = [
              { key: 'skillHandoff',        label: 'Handoff para humano', icon: '🔀', desc: 'Transfere a conversa para um agente humano com resumo automático.',            minPlan: 'free',    field: 'skillHandoff',        addonPrice: null as string | null },
              { key: 'skillDataCollection', label: 'Recolha de dados',    icon: '📋', desc: 'Recolhe informação estruturada do utilizador (formulários conversacionais).', minPlan: 'free',    field: 'skillDataCollection', addonPrice: null },
              { key: 'skillScheduling',     label: 'Agendamento',         icon: '📅', desc: 'Agenda consultas, reuniões ou serviços automaticamente.',                      minPlan: 'starter', field: 'skillScheduling',     addonPrice: '€7/mês' },
              { key: 'skillFileUpload',     label: 'Envio de ficheiros',  icon: '📁', desc: 'Permite ao agente enviar documentos, catálogos e ficheiros ao utilizador.',    minPlan: 'starter', field: 'skillFileUpload',     addonPrice: '€5/mês' },
              { key: 'skillHumorDetection', label: 'Deteção de humor',    icon: '😊', desc: 'Analisa o sentimento do utilizador e adapta o tom do agente.',                 minPlan: 'starter', field: 'skillHumorDetection', addonPrice: '€9/mês' },
            ];

            const MB_WAY: Record<string, { monthly: string | null; credits: string | null }> = {
              free:       { monthly: null,          credits: null },
              starter:    { monthly: '+€15/mês',  credits: '50 crd/transação' },
              business:   { monthly: 'Incluído',   credits: '20 crd/transação' },
              enterprise: { monthly: 'Incluído',   credits: '10 crd/transação' },
            };
            const mbway = MB_WAY[plan] ?? MB_WAY.free;
            const mbwayAvail = mbway.monthly !== null;

            const wlIncl = isAdmin || planIdx >= planOrder.indexOf('enterprise');
            const wlAddon = plan === 'starter' ? '€5/mês' : plan === 'business' ? '€3/mês' : null;
            const wlAvail = isAdmin || wlIncl || wlAddon !== null;
            const wlActive = agent.whitelabelEnabled;
            const wlUrl = typeof window !== 'undefined' ? `${window.location.origin}/w/${agent.id}` : `/w/${agent.id}`;

            return (
              <div className="space-y-4">
              {/* Modo Teste / Producao */}
              <div className={`card border-2 ${agent.testMode ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/10' : 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{agent.testMode ? '🧪' : '🟢'}</span>
                      <h3 className={`text-sm font-semibold ${agent.testMode ? 'text-yellow-700 dark:text-yellow-300' : 'text-green-700 dark:text-green-400'}`}>
                        {agent.testMode ? 'Modo Teste (Sandbox)' : 'Modo Produção'}
                      </h3>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                      {agent.testMode
                        ? 'Pagamentos em sandbox, agendamentos na agenda de testes. Nenhuma ação real.'
                        : 'Pagamentos reais, agenda real. Certifica-te de que tudo está configurado corretamente.'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleTestMode}
                    disabled={tmSaving}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      agent.testMode
                        ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 hover:bg-yellow-300'
                        : 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 hover:bg-green-300'
                    }`}
                  >
                    {tmSaving ? 'A guardar...' : agent.testMode ? '🟢 Ativar produção' : '🧪 Voltar a testes'}
                  </button>
                </div>
              </div>

              {/* Observacao ao vivo */}
              <div className="card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">🔭 Observação ao vivo</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Vê as conversas a decorrer em tempo real (atualiza de 5 em 5 segundos). Só leitura.</p>
                  </div>
                  <button
                    onClick={() => router.push(`/dashboard/agents/${agent.id}/observe`)}
                    className="btn-secondary text-xs shrink-0"
                  >
                    Abrir →
                  </button>
                </div>
              </div>

                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">⚡ Skills do agente</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Ativa ou desativa capacidades. Skills com 🔒 requerem upgrade ou addon.</p>
                  </div>
                  {skillsMsg && <p className="text-xs text-green-600 dark:text-green-400 mb-3">{skillsMsg}</p>}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">

                    {SKILLS_DEF.map((sk) => {
                      const minIdx = planOrder.indexOf(sk.minPlan);
                      const locked = !isAdmin && planIdx < minIdx;
                      const active = !!((agent as unknown as Record<string, unknown>)[sk.field]);
                      return (
                        <div key={sk.key} className="flex items-start gap-3 py-3">
                          <span className="text-lg shrink-0 w-7 text-center mt-0.5">{sk.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{sk.label}</span>
                                {sk.minPlan === 'free' && <PlanBadge plan="free" label="Grátis" />}
                                {locked && sk.addonPrice && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon {sk.addonPrice}</span>}
                                {locked && !sk.addonPrice && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 {sk.minPlan[0].toUpperCase() + sk.minPlan.slice(1)}+</span>}
                                {!locked && sk.minPlan !== 'free' && <PlanBadge plan={sk.minPlan} label={sk.minPlan[0].toUpperCase() + sk.minPlan.slice(1) + '+'} />}
                                {active && !locked && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativa</span>}
                              </div>
                              <TogglePill active={active} locked={locked} disabled={skillsSaving} onClick={() => handleToggleSkill(sk.field, active)} label={(active ? 'Desativar ' : 'Ativar ') + sk.label} />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{sk.desc}</p>
                            {locked && sk.addonPrice && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar addon {sk.addonPrice} →</button>}
                            {locked && !sk.addonPrice && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Upgrade para {sk.minPlan} →</button>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagamentos MB Way */}
                    <div className="flex items-start gap-3 py-3">
                      <span className="text-lg shrink-0 w-7 text-center mt-0.5">💳</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Pagamentos MB Way</span>
                            {!mbwayAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                            {mbwayAvail && mbway.monthly !== 'Incluído' && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">{mbway.monthly}</span>}
                            {mbwayAvail && mbway.monthly === 'Incluído' && <PlanBadge plan="enterprise" label="Incluído" />}
                            {mbwayAvail && mbway.credits && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{mbway.credits}</span>}
                          </div>
                          <TogglePill active={mbwayAvail} locked={!isAdmin && !mbwayAvail} disabled={!isAdmin && !mbwayAvail} onClick={() => { if (!mbwayAvail && !isAdmin) router.push('/dashboard/plans'); }} label="Pagamentos MB Way" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Cobra via MB Way diretamente na conversa. Mensalidade + créditos por transação.</p>
                        {!mbwayAvail && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar no Starter+ →</button>}
                      </div>
                    </div>

                    {/* Vendas + Pedidos/KDS — addon disponível em todos os planos pagos */}
                    {(() => {
                      const vendasActive = agent.skillVendas;
                      // Addon disponível a partir do Starter (não free) — admins sempre podem
                      const vendasAvail = isAdmin || planIdx >= planOrder.indexOf('starter');
                      return (
                        <div className="flex items-start gap-3 py-3">
                          <span className="text-lg shrink-0 w-7 text-center mt-0.5">🏷️</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Vendas + Pedidos/KDS</span>
                                {!vendasAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                                {vendasAvail && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon +€15/mês</span>}
                                {vendasActive && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativa</span>}
                              </div>
                              <TogglePill
                                active={vendasActive}
                                locked={!vendasAvail}
                                disabled={skillsSaving || !vendasAvail}
                                onClick={() => handleToggleSkill('skillVendas', vendasActive)}
                                label={vendasActive ? 'Desativar Vendas' : 'Ativar Vendas'}
                              />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
                              Perfil completo de vendas: trata o cliente pelo nome, sugere o habitual dos recorrentes, upselling natural e cross-sell. Inclui painel KDS em tempo real.
                            </p>
                            {!vendasAvail && (
                              <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Upgrade para Starter+ →</button>
                            )}
                            {vendasAvail && !vendasActive && (
                              <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar addon +€15/mês →</button>
                            )}
                            {vendasActive && (
                              <div className="flex flex-wrap gap-3 mt-1">
                                <button onClick={() => setActiveTab('orders')} className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Abrir aba Pedidos →</button>
                                <a href="/dashboard/orders/live" target="_blank" rel="noopener noreferrer" className="text-[11px] text-gray-500 dark:text-gray-400 hover:underline">KDS autenticado ↗</a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Portal White-label */}
                    <div className="flex items-start gap-3 py-3">
                      <span className="text-lg shrink-0 w-7 text-center mt-0.5">🎨</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Portal White-label</span>
                            {!wlAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                            {wlAvail && !wlIncl && wlAddon && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon {wlAddon}/agente</span>}
                            {wlIncl && <PlanBadge plan="business" label="Incluído" />}
                            {wlActive && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativa</span>}
                          </div>
                          <TogglePill active={wlActive} locked={!wlAvail} disabled={skillsSaving || !wlAvail} onClick={() => handleToggleSkill('whitelabelEnabled', wlActive)} label={wlActive ? 'Desativar White-label' : 'Ativar White-label'} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Página pública do agente com a tua marca, sem branding Agentfy.</p>
                        {wlActive && <a href={wlUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-mono">{wlUrl} ↗</a>}
                        {wlAvail && !wlIncl && !wlActive && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar addon por {wlAddon}/agente →</button>}
                        {!wlAvail && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Upgrade para Starter+ →</button>}
                      </div>
                    </div>

                  </div>
                </div>

                {planIdx < planOrder.indexOf('business') && (
                  <div className="card p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">⚡ Addons e upgrades disponíveis</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ativa skills individualmente como addons mensais, ou faz upgrade do plano para as incluir todas.</p>
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">System Prompt</label>
                  <button type="button" onClick={() => router.push('/dashboard/prompts')} className="text-xs text-brand-600 hover:text-brand-700 dark:text-brand-400 underline">
                    📚 Ver biblioteca de prompts
                  </button>
                </div>
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
            <div className="space-y-4">
              <div className="card py-3 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">🛏️ Paineis KDS</p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">🔑 KDS com login (ti/equipa)</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Painel autenticado com gestão completa (mover pedidos, filtrar agentes).</p>
                    <a href="/dashboard/orders/live" target="_blank" rel="noopener noreferrer" className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-medium">Abrir KDS →</a>
                  </div>
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-0.5">📺 KDS público (cozinha / staff)</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Sem login. Partilha com a cozinha ou balcão.</p>
                    <CopyBox
                      value={typeof window !== 'undefined' ? `${window.location.origin}/orders/${agent.id}` : `/orders/${agent.id}`}
                      label="Link público KDS"
                    />
                  </div>
                </div>
              </div>
              <Orders agentId={agent.id} plan={tenant.plan ?? 'free'} />
            </div>
          )}

          {/* ─── Web Embed ─── */}
          {activeTab === 'embed' && (() => {
            const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.agentfy.com';
            const chatUrl = `${origin}/chat/${agent.id}`;
            const iframe = `<iframe\n  src="${chatUrl}"\n  width="420"\n  height="600"\n  style="border:none; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.15);"\n  title="${agent.name}"\n></iframe>`;
            const widget = `<!-- Agentfy Chat Widget -->\n<script>\n(function(){\n  var btn=document.createElement('div');\n  btn.style='position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#6d28d9;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999';\n  btn.innerHTML='<svg width=28 height=28 fill=none viewBox=\"0 0 24 24\"><path fill=#fff d=\"M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.38-4.88A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2Z\"/></svg>';\n  var frame=document.createElement('iframe');\n  frame.src='${chatUrl}';\n  frame.style='position:fixed;bottom:96px;right:24px;width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9998;display:none';\n  var open=false;\n  btn.onclick=function(){open=!open;frame.style.display=open?'block':'none';btn.style.background=open?'#4c1d95':'#6d28d9';};\n  document.body.appendChild(frame);\n  document.body.appendChild(btn);\n})();\n</script>`;
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
            <div>
              <div className="flex justify-end mb-3">
                <a
                  href={`/api/agents/${agent.id}/export-csv`}
                  download
                  className="btn-secondary text-xs flex items-center gap-1"
                >
                  📥 Exportar CSV
                </a>
              </div>
              <ConversationHistory agentId={agent.id} />
            </div>
          )}


          {/* --- Integracoes --- */}
          {activeTab === 'integrations' && (() => {
            const COST_PER_MSG = 0.06; // EUR estimado por mensagem proativa WhatsApp
            const estDaily = agent.proactiveMaxPerDay * COST_PER_MSG * 30;
            const estMonthly = Math.min(estDaily, agent.proactiveMonthBudget * COST_PER_MSG);

            const handleSaveIntegrations = async (patch: Record<string, unknown>) => {
              setIntSaving(true); setIntMsg('');
              try {
                const updated = await updateAgent(agent.id, patch);
                setAgent(updated);
                setIntMsg('Guardado!');
                setTimeout(() => setIntMsg(''), 2000);
              } catch { setIntMsg('Erro ao guardar.'); }
              finally { setIntSaving(false); }
            };

            return (
              <div className="space-y-5">
                {intMsg && <p className="text-xs text-green-600 dark:text-green-400">{intMsg}</p>}

                {/* Multi-lingua */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">🌍 Multi-língua</h3>
                  <p className="text-xs text-gray-400 mb-3">O agente deteta o idioma do cliente e responde na mesma língua, ou podes forçar um idioma fixo.</p>
                  <select
                    className="input w-full max-w-xs"
                    value={agent.languageMode ?? 'auto'}
                    onChange={(e) => handleSaveIntegrations({ languageMode: e.target.value })}
                  >
                    <option value="auto">🔄 Auto — deteta do cliente</option>
                    <option value="pt">🇵🇹 Português</option>
                    <option value="en">🇬🇧 English</option>
                    <option value="es">🇪🇸 Español</option>
                    <option value="fr">🇫🇷 Français</option>
                    <option value="de">🇩🇪 Deutsch</option>
                    <option value="it">🇮🇹 Italiano</option>
                  </select>
                </div>

                {/* Avaliacao */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">⭐ Avaliação pós-conversa</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Após fechar uma conversa, o agente pede avaliação (1-5 estrelas) ao cliente via WhatsApp/webchat.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ ratingEnabled: !agent.ratingEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.ratingEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.ratingEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {agent.ratingEnabled && (
                    <p className="text-[11px] text-green-600 dark:text-green-400">✓ Ativo — resultados visíveis no Histórico de conversas.</p>
                  )}
                </div>

                {/* Notificacoes Proativas */}
                <div className="card border-2 border-orange-200 dark:border-orange-800/50">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">📣 Notificações Proativas</h3>
                      <p className="text-xs text-gray-400 mt-0.5">O agente inicia conversas WhatsApp (confirmações, lembretes, follow-ups).</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ proactiveEnabled: !agent.proactiveEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.proactiveEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.proactiveEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3 mb-3 text-xs text-orange-700 dark:text-orange-300 space-y-1">
                    <p className="font-semibold">⚠️ Atenção — custo real por mensagem</p>
                    <p>Cada mensagem proativa WhatsApp custa ~€{COST_PER_MSG.toFixed(2)} (tarifa Meta). Mensagens em excesso geram cobranças significativas.</p>
                    <p>Define os limites abaixo. O agente para automaticamente ao atingir o máximo.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Máx. por dia</label>
                      <input type="number" min={1} max={500} className="input w-full"
                        value={agent.proactiveMaxPerDay}
                        onChange={(e) => setAgent(a => a ? { ...a, proactiveMaxPerDay: Number(e.target.value) } : a)}
                        onBlur={(e) => handleSaveIntegrations({ proactiveMaxPerDay: Number(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Máx. por mês</label>
                      <input type="number" min={1} max={5000} className="input w-full"
                        value={agent.proactiveMonthBudget}
                        onChange={(e) => setAgent(a => a ? { ...a, proactiveMonthBudget: Number(e.target.value) } : a)}
                        onBlur={(e) => handleSaveIntegrations({ proactiveMonthBudget: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                  <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500 dark:text-gray-400">
                    💰 Custo estimado: até <strong>€{(agent.proactiveMaxPerDay * COST_PER_MSG * 30).toFixed(0)}/mês</strong> (pelo limite diário) · limite mensal: <strong>€{(agent.proactiveMonthBudget * COST_PER_MSG).toFixed(0)}</strong>
                    <br/><span className="text-[10px]">Estimativa baseada em €{COST_PER_MSG}/msg · valores reais variam por país e tipo de mensagem</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400">
                    Este mês: <strong>{agent.proactiveSentMonth}</strong> enviadas · Hoje: <strong>{agent.proactiveSentToday}</strong>
                  </div>
                </div>

                {/* Follow-up Automatico */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">🔁 Follow-up automático</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Envia mensagem de follow-up X horas após uma conversa terminar sem conversão. Não conta como início de conversa — usa a janela de 24h gratuita da Meta.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ followUpEnabled: !agent.followUpEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.followUpEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.followUpEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {agent.followUpEnabled && (
                    <div className="space-y-3 mt-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Enviar após (horas)</label>
                        <input type="number" min={1} max={23} className="input w-32"
                          value={agent.followUpHours}
                          onChange={(e) => setAgent(a => a ? { ...a, followUpHours: Number(e.target.value) } : a)}
                          onBlur={(e) => handleSaveIntegrations({ followUpHours: Number(e.target.value) })}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Máx 23h para ficar dentro da janela gratuita</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem de follow-up</label>
                        <textarea className="input w-full h-20 resize-none" placeholder="Ex: Olá {nome}! Ainda posso ajudar com algo? 😊"
                          value={agent.followUpMessage ?? ''}
                          onChange={(e) => setAgent(a => a ? { ...a, followUpMessage: e.target.value } : a)}
                          onBlur={(e) => handleSaveIntegrations({ followUpMessage: e.target.value })}
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Usa {'{nome}'} para personalizar com o nome do cliente</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Alertas */}
                <div className="card">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">🔔 Alertas por email</h3>
                  <p className="text-xs text-gray-400 mb-3">Recebe avisos quando o agente tem anomalias, e relatório semanal com métricas.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Email para alertas</label>
                      <input type="email" className="input w-full" placeholder="email@empresa.com"
                        defaultValue={agent.alertEmail ?? ''}
                        onBlur={(e) => handleSaveIntegrations({ alertEmail: e.target.value || undefined })}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Alerta: handoffs/dia {'>'} </label>
                        <input type="number" min={1} className="input w-full" placeholder="ex: 5"
                          defaultValue={agent.alertHandoffThreshold ?? ''}
                          onBlur={(e) => handleSaveIntegrations({ alertHandoffThreshold: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Alerta: resolução {'<'} %</label>
                        <input type="number" min={1} max={100} className="input w-full" placeholder="ex: 60"
                          defaultValue={agent.alertResolutionThreshold ?? ''}
                          onBlur={(e) => handleSaveIntegrations({ alertResolutionThreshold: e.target.value ? Number(e.target.value) : undefined })}
                        />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox"
                        checked={agent.alertWeeklyReport}
                        onChange={(e) => handleSaveIntegrations({ alertWeeklyReport: e.target.checked })}
                        className="rounded"
                      />
                      <span className="text-xs text-gray-700 dark:text-gray-300">Receber relatório semanal com métricas do agente</span>
                    </label>
                  </div>
                </div>

                {/* CRM */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">👥 CRM de Contactos</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Agrega todos os clientes que interagiram, com notas, tags e histórico. Addon — incluído no White-label.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ crmEnabled: !agent.crmEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.crmEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.crmEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {agent.crmEnabled && (
                    <button onClick={() => router.push('/dashboard/crm')} className="btn-secondary text-xs mt-2">
                      Abrir CRM →
                    </button>
                  )}
                </div>

                {/* Google Calendar */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">📅 Google Calendar</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Liga a agenda real do cliente. Quando ativo, o skill de agendamento usa disponibilidade real.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ calendarEnabled: !agent.calendarEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.calendarEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.calendarEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {agent.calendarEnabled && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Calendar ID (Google)</label>
                        <input className="input w-full" placeholder="ex: primary ou nome@gmail.com"
                          defaultValue={agent.calendarId ?? ''}
                          onBlur={(e) => handleSaveIntegrations({ calendarId: e.target.value || undefined })}
                        />
                      </div>
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                        🔗 Para ligar a conta Google, vai às <strong>Definições da plataforma → Integrações → Google Calendar</strong> e completa o OAuth. Depois volta aqui e introduz o Calendar ID.
                      </div>
                    </div>
                  )}
                </div>

                {/* Instagram DM */}
                <div className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">📸 Instagram DM</h3>
                      <p className="text-xs text-gray-400 mt-0.5">Responde automaticamente a mensagens diretas no Instagram. Usa a mesma API Meta do WhatsApp.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSaveIntegrations({ instagramEnabled: !agent.instagramEnabled })}
                      className={`shrink-0 w-11 h-6 rounded-full transition-colors ${agent.instagramEnabled ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'} flex items-center px-0.5`}
                    >
                      <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${agent.instagramEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {agent.instagramEnabled && (
                    <div className="mt-3 space-y-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Instagram Account ID</label>
                        <input className="input w-full" placeholder="ex: 17841400008460056"
                          defaultValue={agent.instagramAccountId ?? ''}
                          onBlur={(e) => handleSaveIntegrations({ instagramAccountId: e.target.value || undefined })}
                        />
                      </div>
                      <div className="p-3 bg-pink-50 dark:bg-pink-900/20 rounded text-xs text-pink-700 dark:text-pink-300">
                        1. No Meta for Developers, adiciona o produto <strong>Instagram Graph API</strong> à tua app.<br/>
                        2. Liga a conta Instagram Business.<br/>
                        3. Adiciona o webhook URL: <code className="font-mono bg-pink-100 dark:bg-pink-900/40 px-1 rounded">{`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/instagram`}</code><br/>
                        4. O Token de acesso é o mesmo que usas no WhatsApp se for a mesma app Meta.
                      </div>
                    </div>
                  )}
                </div>

              </div>
            );
          })()}

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
                      Token por agente <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional — sobrepõe o token global do servidor)</span>
                    </label>
                    <div className="relative">
                      <input
                        className="input pr-20"
                        type={wpTokenVisible ? 'text' : 'password'}
                        placeholder={agent?.whatsappTokenConfigured ? '••••••••  (já configurado — deixa vazio para manter)' : 'EAAxxxxxxx... (Access Token do Meta)'}
                        value={wpToken}
                        onChange={(e) => setWpToken(e.target.value)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setWpTokenVisible(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                      >
                        {wpTokenVisible ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                      Usa isto quando este número pertence a uma conta Meta diferente do servidor principal. Gera em: Meta for Developers → App → WhatsApp → API Setup.
                    </p>
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
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {wpEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {wpMsg && (
                    <p className={`text-xs mt-1 ${wpMsg.includes('Erro') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{wpMsg}</p>
                  )}
                  <button onClick={handleSaveWhatsApp} disabled={wpSaving} className="btn-primary text-sm w-full mt-2">
                    {wpSaving ? 'A guardar...' : '💾 Guardar configuração WhatsApp'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Instagram DM ─── */}
          {activeTab === 'instagram' && (
            <div className="space-y-6">
              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 1 — Conta Meta for Developers</h2>
                <ol className="text-sm text-gray-600 dark:text-gray-300 space-y-1.5 list-decimal list-inside">
                  <li>Vai a <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-brand-600 underline">developers.facebook.com</a> e cria (ou usa) uma App do tipo <strong>Business</strong>.</li>
                  <li>Adiciona o produto <strong>Instagram Graph API</strong> à app.</li>
                  <li>Em <em>Instagram → Basic Display</em>, liga a tua conta <strong>Instagram Business</strong>.</li>
                  <li>Copia o <strong>Instagram Account ID</strong> (número numérico longo, ex: 17841400008460056).</li>
                  <li>Gera um <strong>Access Token</strong> permanente via System User — pode ser o mesmo que o WhatsApp se usarem a mesma app Meta.</li>
                </ol>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 2 — Configurar Webhook no Meta</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Em <em>Instagram → Webhooks</em>:</p>
                <div className="space-y-3">
                  <CopyBox value={INSTAGRAM_WEBHOOK_URL} label="Callback URL" />
                  <CopyBox value="agentify_instagram_verify_2025" label="Verify Token" />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Subscreve o campo <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">messages</code>.</p>
                <div className="mt-3 p-3 bg-pink-50 dark:bg-pink-900/20 border border-pink-200 dark:border-pink-800 rounded-lg text-xs text-pink-700 dark:text-pink-300">
                  ⚠️ Para receber DMs, a tua app Meta precisa estar em modo <strong>Live</strong> e ter a permissão <code className="bg-pink-100 dark:bg-pink-900/40 px-1 rounded">instagram_manage_messages</code> aprovada.
                </div>
              </div>

              <div className="card">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Passo 3 — Ligar este agente</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instagram Account ID <span className="text-gray-400 dark:text-gray-500 font-normal">(ID numérico da página/conta)</span>
                    </label>
                    <input className="input" placeholder="ex: 17841400008460056" value={igAccountId} onChange={(e) => setIgAccountId(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Access Token <span className="text-gray-400 dark:text-gray-500 font-normal">(opcional — sobrepõe o token global)</span>
                    </label>
                    <div className="relative">
                      <input
                        className="input pr-20"
                        type={igTokenVisible ? 'text' : 'password'}
                        placeholder={agent?.instagramTokenConfigured ? '••••••••  (já configurado — deixa vazio para manter)' : 'EAAxxxxxxx... (Access Token do Meta)'}
                        value={igToken}
                        onChange={(e) => setIgToken(e.target.value)}
                        autoComplete="off"
                      />
                      <button
                        type="button"
                        onClick={() => setIgTokenVisible(v => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1"
                      >
                        {igTokenVisible ? 'Ocultar' : 'Mostrar'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Número de notificação WhatsApp <span className="text-gray-400 dark:text-gray-500 font-normal">(recebe alerta de handoff + pedidos)</span>
                    </label>
                    <input className="input" placeholder="ex: 351912345678" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
                    <p className="text-[11px] text-gray-400 mt-1">Quando o agente transferir para humano, envias uma mensagem WhatsApp para este número com o resumo da conversa.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={igEnabled}
                      onClick={() => setIgEnabled((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${igEnabled ? 'bg-pink-500' : 'bg-gray-300'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${igEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {igEnabled ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                  {igMsg && (
                    <p className={`text-xs mt-1 ${igMsg.includes('Erro') ? 'text-red-500' : 'text-green-600 dark:text-green-400'}`}>{igMsg}</p>
                  )}
                  <button onClick={handleSaveInstagram} disabled={igSaving} className="btn-primary text-sm w-full mt-2" style={{ background: igEnabled ? '#e1306c' : undefined }}>
                    {igSaving ? 'A guardar...' : '💾 Guardar configuração Instagram'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
