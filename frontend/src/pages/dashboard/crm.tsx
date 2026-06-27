import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';
import apiFetch from '../../utils/api';

interface CrmContact {
  id: string;
  tenantId: string;
  agentId: string | null;
  phone: string | null;
  name: string | null;
  email: string | null;
  status: 'lead' | 'cliente' | 'inativo' | 'vip';
  tags: string[];
  notes: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalConversations: number;
  totalMessages: number;
  avgSentiment: number | null;
}

const STATUS_COLORS: Record<string, string> = {
  lead:    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  cliente: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  inativo: 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
  vip:     'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
};

const STATUS_LABELS: Record<string, string> = {
  lead: '🔵 Lead', cliente: '🟢 Cliente', inativo: '⚪ Inativo', vip: '⭐ VIP',
};

export default function CrmPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const { data } = await apiFetch.get(`/api/crm?${params}`);
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: r } = await apiFetch.post('/api/crm/sync');
      setMsg(`Sincronizado — ${r.upserted ?? 0} contactos atualizados`);
      setTimeout(() => setMsg(''), 3000);
      load();
    } catch { setMsg('Erro ao sincronizar'); }
    finally { setSyncing(false); }
  };

  const openContact = (c: CrmContact) => {
    setSelected(c);
    setEditNotes(c.notes ?? '');
    setEditTags((c.tags ?? []).join(', '));
    setEditStatus(c.status);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const tagsArr = editTags.split(',').map(t => t.trim()).filter(Boolean);
      const { data: updated } = await apiFetch.patch(`/api/crm/${selected.id}`, { notes: editNotes, tags: tagsArr, status: editStatus });
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setSelected(updated);
      setMsg('Guardado!');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Erro ao guardar'); }
    finally { setSaving(false); }
  };

  const sentimentLabel = (v: number | null) => {
    if (v === null) return '—';
    if (v >= 0.6) return '😊 Positivo';
    if (v >= 0.3) return '😐 Neutro';
    return '😟 Negativo';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">👥 CRM de Contactos</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{total} contactos</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSync} disabled={syncing} className="btn-secondary text-sm">
              {syncing ? '⟳ Sincronizando…' : '🔄 Sincronizar conversas'}
            </button>
            <button onClick={() => router.back()} className="btn-secondary text-sm">← Voltar</button>
          </div>
        </div>

        {msg && <p className="text-xs text-green-600 dark:text-green-400 mb-3">{msg}</p>}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            className="input flex-1"
            placeholder="Pesquisar por nome, telemóvel ou email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select className="input w-44" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Todos os status</option>
            <option value="lead">🔵 Lead</option>
            <option value="cliente">🟢 Cliente</option>
            <option value="vip">⭐ VIP</option>
            <option value="inativo">⚪ Inativo</option>
          </select>
        </div>

        {/* Content */}
        <div className="flex gap-4 items-start">
          {/* Table */}
          <div className={`flex-1 card p-0 overflow-auto ${selected ? 'hidden lg:block' : ''}`}>
            {loading ? (
              <p className="p-8 text-center text-sm text-gray-400">A carregar…</p>
            ) : contacts.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-4xl mb-3">👥</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Nenhum contacto ainda.</p>
                <p className="text-xs text-gray-400 mt-1">Clica em "Sincronizar conversas" para importar clientes do histórico de conversas.</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 dark:border-gray-700">
                  <tr className="text-xs text-gray-500 dark:text-gray-400">
                    <th className="text-left px-4 py-3 font-medium">Contacto</th>
                    <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Status</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Última interação</th>
                    <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Conversas</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Tags</th>
                    <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Sentiment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {contacts.map(c => (
                    <tr
                      key={c.id}
                      onClick={() => openContact(c)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${selected?.id === c.id ? 'bg-brand-50 dark:bg-brand-900/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{c.name ?? c.phone ?? 'Anónimo'}</div>
                        {c.email && <div className="text-xs text-gray-400">{c.email}</div>}
                        {c.phone && c.name && <div className="text-xs text-gray-400">{c.phone}</div>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status]}`}>
                          {STATUS_LABELS[c.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-gray-400">
                        {new Date(c.lastSeenAt).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 dark:text-gray-400">
                        {c.totalConversations}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(c.tags ?? []).slice(0, 3).map(t => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {t}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 dark:text-gray-400">
                        {sentimentLabel(c.avgSentiment)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Detail panel */}
          {selected && (
            <div className="w-full lg:w-96 card shrink-0 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100 text-base">
                    {selected.name ?? selected.phone ?? 'Anónimo'}
                  </h2>
                  {selected.phone && <p className="text-xs text-gray-400">{selected.phone}</p>}
                  {selected.email && <p className="text-xs text-gray-400">{selected.email}</p>}
                </div>
                <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none">×</button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{selected.totalConversations}</div>
                  <div className="text-[10px] text-gray-400">Conversas</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-lg font-bold text-gray-900 dark:text-white">{selected.totalMessages}</div>
                  <div className="text-[10px] text-gray-400">Mensagens</div>
                </div>
                <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                  <div className="text-xs font-medium text-gray-900 dark:text-white">{sentimentLabel(selected.avgSentiment)}</div>
                  <div className="text-[10px] text-gray-400">Sentiment</div>
                </div>
              </div>

              <div className="text-xs text-gray-400 space-y-0.5">
                <div>Primeiro contacto: {new Date(selected.firstSeenAt).toLocaleDateString('pt-PT')}</div>
                <div>Último contacto: {new Date(selected.lastSeenAt).toLocaleDateString('pt-PT')}</div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <select className="input w-full" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="lead">🔵 Lead</option>
                  <option value="cliente">🟢 Cliente</option>
                  <option value="vip">⭐ VIP</option>
                  <option value="inativo">⚪ Inativo</option>
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tags (separadas por vírgula)</label>
                <input
                  className="input w-full"
                  placeholder="ex: urgente, renovação, produto-A"
                  value={editTags}
                  onChange={e => setEditTags(e.target.value)}
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Notas internas</label>
                <textarea
                  className="input w-full h-28 resize-none"
                  placeholder="Notas sobre este cliente (só visíveis para a tua equipa)…"
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                />
              </div>

              {msg && <p className="text-xs text-green-600 dark:text-green-400">{msg}</p>}

              <button onClick={handleSave} disabled={saving} className="btn-primary w-full text-sm">
                {saving ? 'A guardar…' : 'Guardar alterações'}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
