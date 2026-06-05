import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import ChatWidget from '../../components/ChatWidget';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES } from '../../utils/constants';
import { Agent } from '../../types';
import api from '../../utils/api';

export default function AgentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { tenant } = useAuth();
  const { updateAgent, toggleAgent, deleteAgent } = useAgent();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'chat' | 'edit'>('overview');
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    if (!id) return;
    api.get(`/api/agents/${id}`).then(({ data }) => {
      setAgent(data);
      setEditForm({ name: data.name, description: data.description, systemPrompt: data.systemPrompt, model: data.model });
    }).catch(() => router.replace(ROUTES.agents)).finally(() => setLoading(false));
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
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700 font-bold text-xl">
                {agent.name[0]}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{agent.name}</h1>
                <p className="text-sm text-gray-500">{agent.model}</p>
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
          <div className="flex border-b border-gray-200 mb-6 gap-6">
            {(['overview', 'chat', 'edit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setActiveTab(t)}
                className={`pb-2 text-sm font-medium transition-colors capitalize ${
                  activeTab === t ? 'border-b-2 border-brand-600 text-brand-700' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'overview' ? 'Visão geral' : t === 'chat' ? 'Testar chat' : 'Editar'}
              </button>
            ))}
          </div>

          {/* Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
              <div className="card"><p className="text-sm text-gray-500">Conversas</p><p className="text-2xl font-bold">{agent.totalConversations}</p></div>
              <div className="card"><p className="text-sm text-gray-500">Mensagens</p><p className="text-2xl font-bold">{agent.totalMessages}</p></div>
              <div className="card"><p className="text-sm text-gray-500">Taxa de resolução</p><p className="text-2xl font-bold">{Math.round((agent.averageResolution ?? 0) * 100)}%</p></div>
              <div className="card col-span-full">
                <p className="text-sm text-gray-500 mb-2">System Prompt</p>
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans bg-gray-50 rounded-lg p-3 max-h-48 overflow-y-auto">
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
          )}

          {/* Chat test */}
          {activeTab === 'chat' && (
            <ChatWidget agentId={agent.id} tenantId={tenant.id} />
          )}

          {/* Edit */}
          {activeTab === 'edit' && (
            <div className="card space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input className="input" value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <input className="input" value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt</label>
                <textarea className="input resize-none" rows={10} value={editForm.systemPrompt ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, systemPrompt: e.target.value }))} />
              </div>
              {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <div className="flex gap-3">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'A guardar...' : 'Guardar'}</button>
                <button className="btn-secondary" onClick={() => setActiveTab('overview')}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
